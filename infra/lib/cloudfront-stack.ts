import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { CertificateStack } from "./certificate-stack";
import { ApiStack } from "./api-stack";
import { WebSocketStack } from "./websocket-stack";

interface CloudFrontStackProps extends cdk.StackProps {
  certificateStack: CertificateStack;
  apiStack: ApiStack;
  webSocketStack: WebSocketStack;
  appDomain: string;
  hostedZoneId: string;
  hostedZoneName: string;
}

export class CloudFrontStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
    });

    const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      certificate: props.certificateStack.certificate,
      domainNames: [props.appDomain],
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responsePagePath: "/index.html",
          responseHttpStatus: 200,
        },
        {
          httpStatus: 404,
          responsePagePath: "/index.html",
          responseHttpStatus: 200,
        },
      ],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket, { originAccessControl: oac }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.HttpOrigin(cdk.Fn.select(1, cdk.Fn.split("://", props.apiStack.api.apiEndpoint)), {
            httpPort: 80,
            httpsPort: 443,
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          compress: true,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        },
      },
    });

    new route53.ARecord(this, "SiteARecord", {
      zone: route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.hostedZoneName,
      }),
      recordName: props.appDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [s3deploy.Source.asset("../web/dist")],
      destinationBucket: siteBucket,
      distribution: distribution,
      distributionPaths: ["/*"],
    });

    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${props.appDomain}`,
      exportName: `${id}-CloudFrontUrl`,
    });

    new cdk.CfnOutput(this, "BucketName", {
      value: siteBucket.bucketName,
      exportName: `${id}-BucketName`,
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
      exportName: `${id}-DistributionId`,
    });
  }
}
