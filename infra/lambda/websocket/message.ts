import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
} from 'aws-lambda';
import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { createLogger } from '../shared/logger';

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const apigwClient = new ApiGatewayManagementApiClient({ endpoint: process.env.WS_CALLBACK_URL! });

const WS_CONNECTIONS_TABLE = process.env.WS_CONNECTIONS_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const SPIN_HISTORY_TABLE = process.env.SPIN_HISTORY_TABLE!;

// Session ID placed on the request context by the Lambda authoriser
type AuthorisedRequestContext = APIGatewayProxyWebsocketEventV2['requestContext'] & {
  authorizer?: { lambda?: { session_id?: string } };
};

function sessionIdFrom(event: APIGatewayProxyWebsocketEventV2): string | undefined {
  return (event.requestContext as AuthorisedRequestContext).authorizer?.lambda?.session_id;
}

async function broadcastMessage(sessionId: string, message: object) {
  const params = {
    TableName: WS_CONNECTIONS_TABLE,
    IndexName: 'sessionId-index',
    KeyConditionExpression: '#sessionId = :sessionId',
    ExpressionAttributeNames: { '#sessionId': 'sessionId' },
    ExpressionAttributeValues: { ':sessionId': sessionId },
  };

  const command = new QueryCommand(params);
  const connections = await ddbDocClient.send(command);

  for (const connection of connections.Items || []) {
    const connectionId = connection.connectionId;
    try {
      const postToConnectionCommand = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(message),
      });
      await apigwClient.send(postToConnectionCommand);
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 410) {
        const deleteCommand = new DeleteCommand({
          TableName: WS_CONNECTIONS_TABLE,
          Key: { sessionId: connection.sessionId, connectionId: connection.connectionId },
        });
        await ddbDocClient.send(deleteCommand);
      }
    }
  }
}

async function getRoleFromConnection(sessionId: string, connectionId: string): Promise<string> {
  const command = new GetCommand({
    TableName: WS_CONNECTIONS_TABLE,
    Key: { sessionId, connectionId },
  });
  const result = await ddbDocClient.send(command);
  return (result.Item && result.Item.role) || 'guest';
}

async function handleJoin(
  event: APIGatewayProxyWebsocketEventV2,
  displayName: string
): Promise<void> {
  const connectionId = event.requestContext.connectionId;
  const sessionId = sessionIdFrom(event);

  const command = new PutCommand({
    TableName: WS_CONNECTIONS_TABLE,
    Item: {
      sessionId,
      connectionId,
      displayName,
      role: 'participant',
      ttl: Math.floor(Date.now() / 1000) + 86400,
    },
  });
  await ddbDocClient.send(command);

  const message = { type: 'participant_joined', displayName, connectionId };
  await broadcastMessage(sessionId!, message);
}

async function handleSpin(
  event: APIGatewayProxyWebsocketEventV2,
  names: string[]
): Promise<void> {
  const sessionId = sessionIdFrom(event)!;
  const connectionId = event.requestContext.connectionId;
  const role = await getRoleFromConnection(sessionId, connectionId);

  if (role !== 'admin') {
    throw new Error('Only admin can perform spin');
  }

  const winner = names[Math.floor(Math.random() * names.length)];
  const timestamp = Date.now();
  const spinId = crypto.randomUUID();

  await ddbDocClient.send(new PutCommand({
    TableName: SPIN_HISTORY_TABLE,
    Item: {
      sessionId,
      'timestamp#spinId': `${timestamp}#${spinId}`,
      winner,
      nameSnapshot: JSON.stringify(names),
      timestamp,
    },
  }));

  const message = { type: 'spin_result', winner, names, timestamp };
  await broadcastMessage(sessionId, message);
}

async function handleUpdateNames(
  event: APIGatewayProxyWebsocketEventV2,
  names: string[]
): Promise<void> {
  const sessionId = sessionIdFrom(event)!;
  const connectionId = event.requestContext.connectionId;
  const role = await getRoleFromConnection(sessionId, connectionId);

  if (role !== 'admin') {
    throw new Error('Only admin can update names');
  }

  await ddbDocClient.send(new UpdateCommand({
    TableName: SESSIONS_TABLE,
    Key: { sessionId },
    UpdateExpression: 'set nameListSnapshot = :names',
    ExpressionAttributeValues: { ':names': names },
  }));

  const message = { type: 'names_updated', names };
  await broadcastMessage(sessionId, message);
}

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event, context) => {
  const logger = createLogger(context, {
    route: event.requestContext.routeKey,
    connectionId: event.requestContext.connectionId,
    sessionId: sessionIdFrom(event),
  });
  try {
    const body = JSON.parse(event.body || '{}');
    const { type, displayName, names } = body;
    // Only the message type is logged; the body itself may carry participant names
    logger.info('Handling WebSocket message', { action: typeof type === 'string' ? type : undefined });

    switch (type) {
      case 'join':
        await handleJoin(event, displayName);
        break;
      case 'spin':
        if (names && Array.isArray(names)) {
          await handleSpin(event, names);
        }
        break;
      case 'update_names':
        if (names && Array.isArray(names)) {
          await handleUpdateNames(event, names);
        }
        break;
      default:
        throw new Error('Unknown message type');
    }

    return { statusCode: 200, body: '' };
  } catch (error) {
    logger.error('Error handling WebSocket message', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};