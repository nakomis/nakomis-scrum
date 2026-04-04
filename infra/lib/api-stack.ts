import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { DynamoStack } from "./dynamo-stack";
import { CognitoStack } from "./cognito-stack";

export interface ApiStackProps extends cdk.StackProps {
  cognitoStack: CognitoStack;
  dynamoStack: DynamoStack;
  appDomain: string;
  allowedOrigins: string[];
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const authorizer = new authorizers.HttpJwtAuthorizer(
      "CognitoAuth",
      `https://cognito-idp.eu-west-2.amazonaws.com/${props.cognitoStack.userPool.userPoolId}`,
      { jwtAudience: [props.cognitoStack.userPoolClient.userPoolClientId] },
    );

    const bundling = { minify: true, sourceMap: true };
    const runtime = lambda.Runtime.NODEJS_20_X;

    const sessionsHandler = new nodejs.NodejsFunction(this, "SessionsHandler", {
      entry: "lambda/api/sessions.ts",
      functionName: "nakomis-scrum-api-sessions",
      runtime,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling,
    });
    sessionsHandler.addEnvironment("SESSION_TABLE", props.dynamoStack.sessionsTable.tableName);
    sessionsHandler.addEnvironment("SPIN_HISTORY_TABLE", props.dynamoStack.spinHistoryTable.tableName);
    props.dynamoStack.sessionsTable.grantReadWriteData(sessionsHandler);
    props.dynamoStack.spinHistoryTable.grantReadData(sessionsHandler);

    const nameListsHandler = new nodejs.NodejsFunction(this, "NameListsHandler", {
      entry: "lambda/api/name-lists.ts",
      functionName: "nakomis-scrum-api-name-lists",
      runtime,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling,
    });
    nameListsHandler.addEnvironment("NAME_LISTS_TABLE", props.dynamoStack.nameListsTable.tableName);
    props.dynamoStack.nameListsTable.grantReadWriteData(nameListsHandler);

    const magicLinkHandler = new nodejs.NodejsFunction(this, "MagicLinkHandler", {
      entry: "lambda/api/magic-link.ts",
      functionName: "nakomis-scrum-api-magic-link",
      runtime,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      bundling,
    });
    magicLinkHandler.addEnvironment("APP_DOMAIN", props.appDomain);
    magicLinkHandler.addEnvironment(
      "JWT_SECRET",
      ssm.StringParameter.valueForStringParameter(this, "/nakomis-scrum/jwt-secret"),
    );

    this.api = new apigwv2.HttpApi(this, "NakomisScrumApi", {
      corsPreflight: {
        allowOrigins: props.allowedOrigins,
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
        maxAge: cdk.Duration.days(1),
      },
    });

    this.api.addRoutes({ path: "/sessions", methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration("SessionsPost", sessionsHandler), authorizer });
    this.api.addRoutes({ path: "/sessions/{id}", methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration("SessionsGet", sessionsHandler), authorizer });
    this.api.addRoutes({ path: "/sessions/{id}/names", methods: [apigwv2.HttpMethod.PATCH], integration: new integrations.HttpLambdaIntegration("SessionsNamesPatch", sessionsHandler), authorizer });
    this.api.addRoutes({ path: "/sessions/{id}/spin", methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration("SessionsSpinPost", sessionsHandler), authorizer });
    this.api.addRoutes({ path: "/sessions/{id}/history", methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration("SessionsHistoryGet", sessionsHandler), authorizer });
    this.api.addRoutes({ path: "/orgs/{id}/name-lists", methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration("NameLists", nameListsHandler), authorizer });
    this.api.addRoutes({ path: "/orgs/{id}/name-lists/{listId}", methods: [apigwv2.HttpMethod.PUT], integration: new integrations.HttpLambdaIntegration("NameListsPut", nameListsHandler), authorizer });
    this.api.addRoutes({ path: "/sessions/{id}/magic-link", methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration("MagicLink", magicLinkHandler), authorizer });

    new cdk.CfnOutput(this, "ApiEndpoint", { value: this.api.apiEndpoint });
  }
}
