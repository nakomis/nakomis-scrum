import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";

export interface CertificateStackProps extends cdk.StackProps {
  appDomain: string;
  hostedZoneId: string;
  hostedZoneName: string;
}

export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName,
    });

    this.certificate = new acm.Certificate(this, "ScrumCertificate", {
      domainName: props.appDomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    new cdk.CfnOutput(this, "CertificateArn", {
      value: this.certificate.certificateArn,
      exportName: "NakomisScrumCertificateArn",
    });
  }
}
