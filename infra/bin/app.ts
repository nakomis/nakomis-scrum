import * as cdk from "aws-cdk-lib";
import * as fs from 'fs';
import { CertificateStack } from "../lib/certificate-stack";
import { CognitoStack } from "../lib/cognito-stack";
import { DynamoStack } from "../lib/dynamo-stack";
import { ApiStack } from "../lib/api-stack";
import { WebSocketStack } from "../lib/websocket-stack";
import { CloudFrontStack } from "../lib/cloudfront-stack";
import { GithubCiStack } from "../lib/github-ci-stack";

const npmEnvironment = process.env.NPM_ENVIRONMENT;
if (!npmEnvironment) {
  throw new Error("NPM_ENVIRONMENT is not set. Use `npm run deploy-sandbox` or `npm run deploy-prod`.");
}
if (npmEnvironment !== "sandbox" && npmEnvironment !== "prod") {
  throw new Error(`Unknown NPM_ENVIRONMENT "${npmEnvironment}". Must be "sandbox" or "prod".`);
}

const app = new cdk.App();

const deployEnv: "sandbox" | "prod" = npmEnvironment;
const isProd = deployEnv === "prod";

const accountId = isProd ? "637423226886" : "975050268859";

const env: cdk.Environment = {
  account: accountId,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-west-2",
};

const certEnv: cdk.Environment = { account: env.account, region: "us-east-1" };

const rootDomain = isProd ? "nakomis.com" : "sandbox.nakomis.com";
const appDomain = `scrum.${rootDomain}`;
const nakomAdminPoolId = "eu-west-2_Fqgp2dltb"; // always the prod admin pool

const certificateStack = new CertificateStack(app, "NakomisScrumCertificate", {
  env: certEnv,
  crossRegionReferences: true,
  appDomain,
  rootDomain,
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
  crossRegionReferences: true,
  certificateStack,
  apiStack,
  webSocketStack,
  appDomain,
  rootDomain,
});

new GithubCiStack(app, "NakomisScrumGithubCi", {
  env,
  deployEnv,
  githubOidcProviderArn: `arn:aws:iam::${accountId}:oidc-provider/token.actions.githubusercontent.com`,
  description: `GitHub Actions OIDC deploy role for nakomis-scrum (${deployEnv})`,
});

// Dependencies
apiStack.addDependency(cognitoStack);
apiStack.addDependency(dynamoStack);
webSocketStack.addDependency(dynamoStack);
cloudFrontStack.addDependency(certificateStack);

const { version: infraVersion } = JSON.parse(fs.readFileSync('./version.json', 'utf-8'));
cdk.Tags.of(app).add('MH-Project', 'nakomis-scrum');
cdk.Tags.of(app).add('MH-Version', infraVersion);
cdk.Tags.of(app).add('Environment', deployEnv);
