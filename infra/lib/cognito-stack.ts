import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ssm from "aws-cdk-lib/aws-ssm";

export interface CognitoStackProps extends cdk.StackProps {
  isProd: boolean;
  nakomAdminPoolId: string;
  domainPrefix: string;
  appDomain: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly cognitoDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, "ScrumUsers", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: { minLength: 12, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: true },
      removalPolicy: props.isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      standardAttributes: { email: { required: true, mutable: true } },
    });

    const oidcProvider = new cognito.UserPoolIdentityProviderOidc(this, "NakomAdminProvider", {
      userPool: this.userPool,
      name: "nakom-admin",
      clientId: ssm.StringParameter.valueForStringParameter(this, "/nakomis-scrum/nakom-admin-oidc-client-id"),
      clientSecret: ssm.StringParameter.valueForStringParameter(this, "/nakomis-scrum/nakom-admin-oidc-client-secret"),
      issuerUrl: `https://cognito-idp.eu-west-2.amazonaws.com/${props.nakomAdminPoolId}`,
      scopes: ["openid", "email", "profile"],
      attributeMapping: {
        email: cognito.ProviderAttribute.other("email"),
      },
    });

    this.userPoolClient = new cognito.UserPoolClient(this, "ScrumUsersClient", {
      userPool: this.userPool,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`https://${props.appDomain}/auth/callback`, "http://localhost:5173/auth/callback"],
        logoutUrls: [`https://${props.appDomain}/auth/signout`, "http://localhost:5173/auth/signout"],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.custom("nakom-admin"),
      ],
    });

    this.userPoolClient.node.addDependency(oidcProvider);

    this.cognitoDomain = this.userPool.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix: props.domainPrefix },
    });

    new cdk.CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "CognitoDomain", { value: this.cognitoDomain.domainName });
  }
}
