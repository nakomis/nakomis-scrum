import * as cdk from "aws-cdk-lib";
import { CertificateStack } from "../lib/certificate-stack";
import { CognitoStack } from "../lib/cognito-stack";
import { DynamoStack } from "../lib/dynamo-stack";
import { ApiStack } from "../lib/api-stack";
import { WebSocketStack } from "../lib/websocket-stack";
import { CloudFrontStack } from "../lib/cloudfront-stack";

if (!process.env.CDK_ENV) {
  throw new Error("CDK_ENV must be set to 'sandbox' or 'prod'");
}

const app = new cdk.App();

const isProd = process.env.CDK_ENV === "prod";

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-west-2",
};

const certEnv: cdk.Environment = { account: env.account, region: "us-east-1" };

const rootDomain = isProd ? "nakomis.com" : "sandbox.nakomis.com";
const appDomain = `scrum.${rootDomain}`;
const nakomAdminPoolId = "eu-west-2_Fqgp2dltb"; // always the prod admin pool

// NOTE: cert stack uses fromHostedZoneAttributes to avoid replacing an already-validated
// certificate when the zone lookup resolves differently. The hostedZoneId here must match
// whatever zone ID was used when the certificate was originally created — changing it forces
// cert replacement and breaks the cross-region ExportsWriter. The CloudFront stack uses
// fromLookup independently for the ARecord, which is what actually matters for DNS routing.
// Sandbox: keep the zone ID that was used when the certificate was originally created
// (Z0078393YEDJ63T1OVLB — the now-deleted spurious zone). Changing this forces ACM to
// replace the certificate, which breaks the cross-region ExportsWriter. The cert is already
// validated; the zone ID here has no runtime effect. Update this only when intentionally
// replacing the certificate (e.g. on a clean prod deployment).
const certHostedZoneId = isProd ? "Z019437529YGFB53BDUGR" : "Z0078393YEDJ63T1OVLB";

const certificateStack = new CertificateStack(app, "NakomisScrumCertificate", {
  env: certEnv,
  crossRegionReferences: true,
  appDomain,
  hostedZoneId: certHostedZoneId,
  hostedZoneName: rootDomain,
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

// Dependencies
apiStack.addDependency(cognitoStack);
apiStack.addDependency(dynamoStack);
webSocketStack.addDependency(dynamoStack);
cloudFrontStack.addDependency(certificateStack);

cdk.Tags.of(app).add("Project", "nakomis-scrum");
cdk.Tags.of(app).add("Environment", process.env.CDK_ENV ?? "sandbox");
