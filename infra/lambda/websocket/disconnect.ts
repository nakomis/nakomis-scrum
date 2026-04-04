import { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
    try {
        const connectionId = event.requestContext.connectionId;
        if (!connectionId) {
            return { statusCode: 400, body: JSON.stringify({ message: "Connection ID is missing" }) };
        }

        const tableName = process.env.WS_CONNECTIONS_TABLE;
        if (!tableName) {
            return { statusCode: 500, body: JSON.stringify({ message: "WS_CONNECTIONS_TABLE environment variable is not set" }) };
        }

        // Scan the WsConnections table to find the item with this connectionId
        const scanCommand = new ScanCommand({
            TableName: tableName,
            FilterExpression: 'connectionId = :connectionId',
            ExpressionAttributeValues: {
                ':connectionId': connectionId
            }
        });
        const result = await client.send(scanCommand);
        if (!result.Items || result.Items.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ message: "Connection not found" }) };
        }

        // Get the sessionId from the item
        const { sessionId } = result.Items[0];

        // Delete the item using sessionId (PK) + connectionId (SK)
        const deleteCommand = new DeleteCommand({
            TableName: tableName,
            Key: {
                sessionId,
                connectionId
            }
        });
        await client.send(deleteCommand);

        return { statusCode: 200 };
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
    }
};
