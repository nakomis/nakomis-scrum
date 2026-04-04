import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const SESSION_TABLE = process.env.SESSION_TABLE!;
const SPIN_HISTORY_TABLE = process.env.SPIN_HISTORY_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const routeKey = event.routeKey;
  const sessionId = event.pathParameters?.id;
  const authorizationHeader = event.headers.Authorization;
  const jwtPayloadBase64 = authorizationHeader ? authorizationHeader.split('.')[1] : '';
  const adminId = JSON.parse(Buffer.from(jwtPayloadBase64, 'base64').toString()).sub;

  try {
    switch (routeKey) {
      case "POST /sessions": {
        const { orgId, nameListId } = JSON.parse(event.body!);
        const newSessionId = crypto.randomUUID();
        const createdAt = Date.now();
        await ddb.send(new PutCommand({
          TableName: SESSION_TABLE,
          Item: { sessionId: newSessionId, orgId, adminId, status: "active", nameListSnapshot: [], createdAt }
        }));
        return { statusCode: 201, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: newSessionId }) };
      }
      case "GET /sessions/{id}": {
        const session = await ddb.send(new GetCommand({ TableName: SESSION_TABLE, Key: { sessionId } }));
        if (!session.Item) return { statusCode: 404, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Session not found" }) };
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(session.Item) };
      }
      case "PATCH /sessions/{id}/names": {
        const { names } = JSON.parse(event.body!);
        await ddb.send(new UpdateCommand({
          TableName: SESSION_TABLE,
          Key: { sessionId },
          UpdateExpression: 'set #nameListSnapshot = :names',
          ExpressionAttributeNames: { '#nameListSnapshot': 'nameListSnapshot' },
          ExpressionAttributeValues: { ':names': names }
        }));
        const updatedSession = await ddb.send(new GetCommand({ TableName: SESSION_TABLE, Key: { sessionId } }));
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedSession.Item) };
      }
      case "POST /sessions/{id}/spin": {
        const session = await ddb.send(new GetCommand({ TableName: SESSION_TABLE, Key: { sessionId } }));
        if (!session.Item || !Array.isArray(session.Item.nameListSnapshot) || session.Item.nameListSnapshot.length === 0) {
          return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Invalid session or empty name list" }) };
        }
        const winner = session.Item.nameListSnapshot[Math.floor(Math.random() * session.Item.nameListSnapshot.length)];
        await ddb.send(new PutCommand({
          TableName: SPIN_HISTORY_TABLE,
          Item: { sessionId, sk: `${Date.now()}#${crypto.randomUUID()}`, winner, nameSnapshot: JSON.stringify(session.Item.nameListSnapshot), timestamp: Date.now() }
        }));
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ winner }) };
      }
      case "GET /sessions/{id}/history": {
        const history = await ddb.send(new QueryCommand({
          TableName: SPIN_HISTORY_TABLE,
          KeyConditionExpression: 'sessionId = :sessionId',
          ExpressionAttributeValues: { ':sessionId': sessionId }
        }));
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(history.Items) };
      }
      default:
        return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method not allowed" }) };
    }
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
