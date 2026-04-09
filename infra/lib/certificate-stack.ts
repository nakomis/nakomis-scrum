import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";

export interface CertificateStackProps extends cdk.StackProps {
  appDomain: string;
  rootDomain: string;
}

export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.rootDomain,
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
