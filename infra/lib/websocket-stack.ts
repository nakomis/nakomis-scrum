import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import { DynamoStack } from "./dynamo-stack";

export interface WebSocketStackProps extends cdk.StackProps {
  dynamoStack: DynamoStack;
  appDomain: string;
}

export class WebSocketStack extends cdk.Stack {
  public readonly webSocketApi: apigwv2.WebSocketApi;
  public readonly stage: apigwv2.WebSocketStage;

  constructor(scope: Construct, id: string, props: WebSocketStackProps) {
    super(scope, id, props);

    const bundling = { minify: true, sourceMap: true };
    const runtime = lambda.Runtime.NODEJS_20_X;

    const connectHandler = new nodejs.NodejsFunction(this, "ConnectHandler", {
      runtime,
      entry: "lambda/websocket/connect.ts",
      functionName: "nakomis-scrum-ws-connect",
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling,
    });

    const disconnectHandler = new nodejs.NodejsFunction(this, "DisconnectHandler", {
      runtime,
      entry: "lambda/websocket/disconnect.ts",
      functionName: "nakomis-scrum-ws-disconnect",
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling,
    });

    const messageHandler = new nodejs.NodejsFunction(this, "MessageHandler", {
      runtime,
      entry: "lambda/websocket/message.ts",
      functionName: "nakomis-scrum-ws-message",
      timeout: cdk.Duration.seconds(29),
      memorySize: 512,
      bundling,
    });

    props.dynamoStack.wsConnectionsTable.grantWriteData(connectHandler);
    props.dynamoStack.wsConnectionsTable.grantWriteData(disconnectHandler);
    props.dynamoStack.wsConnectionsTable.grantReadWriteData(messageHandler);
    props.dynamoStack.sessionsTable.grantReadData(messageHandler);
    props.dynamoStack.spinHistoryTable.grantWriteData(messageHandler);

    this.webSocketApi = new apigwv2.WebSocketApi(this, "ScrumWsApi", {
      apiName: "nakomis-scrum-ws",
      connectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration("ConnectInt", connectHandler) },
      disconnectRouteOptions: { integration: new integrations.WebSocketLambdaIntegration("DisconnectInt", disconnectHandler) },
      defaultRouteOptions: { integration: new integrations.WebSocketLambdaIntegration("MessageInt", messageHandler) },
    });

    this.stage = new apigwv2.WebSocketStage(this, "ProdStage", {
      webSocketApi: this.webSocketApi,
      stageName: "prod",
      autoDeploy: true,
    });

    messageHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ["execute-api:ManageConnections"],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/prod/POST/@connections/*`],
    }));

    const tableEnvConnect = { WS_CONNECTIONS_TABLE: props.dynamoStack.wsConnectionsTable.tableName };
    Object.entries(tableEnvConnect).forEach(([k, v]) => connectHandler.addEnvironment(k, v));
    Object.entries(tableEnvConnect).forEach(([k, v]) => disconnectHandler.addEnvironment(k, v));

    messageHandler.addEnvironment("WS_CALLBACK_URL", this.stage.callbackUrl);
    messageHandler.addEnvironment("WS_CONNECTIONS_TABLE", props.dynamoStack.wsConnectionsTable.tableName);
    messageHandler.addEnvironment("SESSIONS_TABLE", props.dynamoStack.sessionsTable.tableName);
    messageHandler.addEnvironment("SPIN_HISTORY_TABLE", props.dynamoStack.spinHistoryTable.tableName);

    new cdk.CfnOutput(this, "WsApiEndpoint", { value: this.stage.url });
    new cdk.CfnOutput(this, "WsApiId", { value: this.webSocketApi.apiId });
  }
}
