import * as cdk from "aws-cdk-lib";
import { CertificateStack } from "../lib/certificate-stack";
import { CognitoStack } from "../lib/cognito-stack";
import { DynamoStack } from "../lib/dynamo-stack";
import { ApiStack } from "../lib/api-stack";
import { WebSocketStack } from "../lib/websocket-stack";
import { CloudFrontStack } from "../lib/cloudfront-stack";

const app = new cdk.App();

const isProd = process.env.CDK_ENV === "prod";

const env: cdk.Environment = {
  account: isProd ? "637423226886" : "975050268859",
  region: "eu-west-2",
};

const certEnv: cdk.Environment = { account: env.account, region: "us-east-1" };

const appDomain = isProd ? "scrum.nakomis.com" : "scrum.sandbox.nakomis.com";
const hostedZoneId = isProd ? "Z019437529YGFB53BDUGR" : "Z03586633NXU18LFL0JTL";
const hostedZoneName = isProd ? "nakomis.com" : "sandbox.nakomis.com";
const nakomAdminPoolId = "eu-west-2_Fqgp2dltb"; // always the prod admin pool

const certificateStack = new CertificateStack(app, "NakomisScrumCertificate", {
  env: certEnv,
  appDomain,
  hostedZoneId,
  hostedZoneName,
});

const cognitoStack = new CognitoStack(app, "NakomisScrumCognito", {
  env,
  isProd,
  nakomAdminPoolId,
  domainPrefix: `nakomis-scrum${isProd ? "" : "-sandbox"}`,
  appDomain,
});

const dynamoStack = new DynamoStack(app, "NakomisScrumDynamo", { env, isProd });

const apiStack = new ApiStack(app, "NakomisScrumApi", {
  env,
  cognitoStack,
  dynamoStack,
  appDomain,
  allowedOrigins: [`https://${appDomain}`, "http://localhost:5173"],
});

const webSocketStack = new WebSocketStack(app, "NakomisScrumWebSocket", {
  env,
  dynamoStack,
  appDomain,
});

const cloudFrontStack = new CloudFrontStack(app, "NakomisScrumCloudFront", {
  env,
  certificateStack,
  apiStack,
  webSocketStack,
  appDomain,
  hostedZoneId,
  hostedZoneName,
});

// Dependencies
apiStack.addDependency(cognitoStack);
apiStack.addDependency(dynamoStack);
webSocketStack.addDependency(dynamoStack);
cloudFrontStack.addDependency(certificateStack);

cdk.Tags.of(app).add("Project", "nakomis-scrum");
cdk.Tags.of(app).add("Environment", process.env.CDK_ENV ?? "sandbox");
