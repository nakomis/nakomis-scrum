import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

/** Account hosting the shared deployment tracker (the nakomis prod account). */
const DEPLOYMENT_TRACKER_ACCOUNT = "637423226886";

export interface GithubCiStackProps extends cdk.StackProps {
  deployEnv: "sandbox" | "prod";
  /** ARN of the GitHub OIDC provider in this account. */
  githubOidcProviderArn: string;
}

export class GithubCiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GithubCiStackProps) {
    super(scope, id, props);

    const { deployEnv, githubOidcProviderArn } = props;

    const githubOidc = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "GithubOidc",
      githubOidcProviderArn,
    );

    const role = new iam.Role(this, "ScrumCiRole", {
      roleName: `nakomis-nakomis-scrum-github-ci-${deployEnv}`,
      assumedBy: new iam.WebIdentityPrincipal(githubOidc.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        },
        // GitHub issues either repo:OWNER@OWNER_ID/REPO@REPO_ID:CONTEXT (immutable
        // ids) or the older repo:OWNER/REPO:CONTEXT, depending on the repo. A list
        // is an OR, so accept both.
        StringLike: {
          "token.actions.githubusercontent.com:sub": [
            "repo:nakomis@1488244/nakomis-scrum@1201406146:*",
            "repo:nakomis/nakomis-scrum:*",
          ],
        },
      }),
      description: `Assumed by nakomis-scrum GitHub Actions CI (${deployEnv})`,
      inlinePolicies: {
        CdkDeploy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["sts:AssumeRole"],
              resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
            }),
          ],
        }),
        // web/deployscripts/set-env.sh reads stack outputs to build the SPA config.
        StackOutputs: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["cloudformation:DescribeStacks"],
              resources: [`arn:aws:cloudformation:${this.region}:${this.account}:stack/NakomisScrum*/*`],
            }),
          ],
        }),
        // The tracker is a REST API in the prod account, so the sandbox role calls
        // it cross-account and needs this identity grant as well as the tracker's
        // resource-policy allow-list.
        DeploymentTracker: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["execute-api:Invoke"],
              resources: [
                `arn:aws:execute-api:eu-west-2:${DEPLOYMENT_TRACKER_ACCOUNT}:*/*/*/deployments/*`,
              ],
            }),
          ],
        }),
      },
    });

    new cdk.CfnOutput(this, "ScrumCiRoleArn", {
      value: role.roleArn,
      description: `IAM role for nakomis-scrum GitHub Actions CI (${deployEnv})`,
    });
  }
}
