import { APIGatewayProxyWebsocketHandlerV2, APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { createLogger } from '../shared/logger';

// $connect events carry the query string, which the WebSocket event type omits
type ConnectEvent = APIGatewayProxyWebsocketEventV2 & {
    queryStringParameters?: Record<string, string | undefined>;
};

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event, context): Promise<APIGatewayProxyResultV2> => {
    const qs = (event as ConnectEvent).queryStringParameters || {};
    const logger = createLogger(context, {
        route: event.requestContext.routeKey,
        connectionId: event.requestContext.connectionId,
        sessionId: qs.sessionId,
        role: qs.role,
    });
    logger.info('Handling WebSocket connect');
    try {
        const { sessionId, role, token } = qs as { sessionId?: string; role?: string; token?: string };

        if (!sessionId || !role || !token) {
            return { statusCode: 400, body: 'Missing required query parameters' };
        }

        let userId;
        if (role === 'participant') {
            const [header, payloadPart, signature] = token.split('.');
            const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());

            if (payload.type !== 'magic-link' || payload.exp < Date.now() / 1000) {
                return { statusCode: 403 };
            }

            const expectedSignature = crypto.createHmac('sha256', process.env.JWT_SECRET!).update(header + '.' + payloadPart).digest('base64url');
            if (signature !== expectedSignature || payload.sessionId !== sessionId) {
                return { statusCode: 403 };
            }

            userId = payload.sub;
        } else if (role === 'admin') {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
            // userId is resolved for both roles but not yet persisted on the connection item
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            userId = payload.sub;
        } else {
            return { statusCode: 400, body: 'Invalid role' };
        }

        const item = {
            sessionId,
            connectionId: event.requestContext.connectionId,
            role,
            ttl: Math.floor(Date.now() / 1000) + 86400,
            ...(role === 'participant' && { displayName: qs.displayName })
        };

        await ddbDocClient.send(new PutCommand({
            TableName: process.env.WS_CONNECTIONS_TABLE!,
            Item: item
        }));

        return { statusCode: 200 };
    } catch (error) {
        logger.error('Error handling WebSocket connect', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};
