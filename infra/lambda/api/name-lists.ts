import { APIGatewayProxyHandlerV2, APIGatewayProxyEventV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import * as crypto from "crypto";

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandlerV2 = async (event: APIGatewayProxyEventV2) => {
  const { routeKey, pathParameters, body } = event;
  const orgId = pathParameters?.id;

  if (!orgId) return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Missing orgId" }) };

  try {
    switch (routeKey) {
      case "GET /orgs/{id}/name-lists":
        const queryResult = await documentClient.send(new QueryCommand({ TableName: process.env.NAME_LISTS_TABLE, KeyConditionExpression: "#orgId = :orgId", ExpressionAttributeNames: { "#orgId": "orgId" }, ExpressionAttributeValues: { ":orgId": orgId } }));
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(queryResult.Items) };

      case "POST /orgs/{id}/name-lists":
        if (!body) return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Missing body" }) };
        const requestBody = JSON.parse(body);
        const newListId = crypto.randomUUID();
        await documentClient.send(new PutCommand({ TableName: process.env.NAME_LISTS_TABLE, Item: { orgId, listId: newListId, name: requestBody.name, names: requestBody.names, createdAt: Date.now() } }));
        return { statusCode: 201, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listId: newListId }) };

      case "PUT /orgs/{id}/name-lists/{listId}":
        if (!body) return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Missing body" }) };
        const updateBody = JSON.parse(body);
        let updateExpr = "";
        const exprValues: Record<string, unknown> = {};
        if (updateBody.name) { updateExpr += "#name = :name, "; exprValues[":name"] = updateBody.name; }
        if (updateBody.names) { updateExpr += "names = :names, "; exprValues[":names"] = updateBody.names; }
        if (!updateExpr) return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "No updates provided" }) };
        updateExpr = updateExpr.slice(0, -2);
        await documentClient.send(new UpdateCommand({ TableName: process.env.NAME_LISTS_TABLE, Key: { orgId, listId: pathParameters?.listId }, UpdateExpression: `SET ${updateExpr}`, ExpressionAttributeNames: { "#name": "name" }, ExpressionAttributeValues: exprValues }));
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) };

      default:
        return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Method not allowed" }) };
    }
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
