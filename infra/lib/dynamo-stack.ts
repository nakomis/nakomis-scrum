import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export interface DynamoStackProps extends cdk.StackProps {
  isProd: boolean;
}

export class DynamoStack extends cdk.Stack {
  public readonly orgsTable: dynamodb.Table;
  public readonly adminsTable: dynamodb.Table;
  public readonly nameListsTable: dynamodb.Table;
  public readonly sessionsTable: dynamodb.Table;
  public readonly wsConnectionsTable: dynamodb.Table;
  public readonly spinHistoryTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoStackProps) {
    super(scope, id, props);
    const removalPolicy = props.isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    this.orgsTable = new dynamodb.Table(this, "OrgsTable", {
      partitionKey: { name: "orgId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy,
    });

    this.adminsTable = new dynamodb.Table(this, "AdminsTable", {
      partitionKey: { name: "adminId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy,
    });
    this.adminsTable.addGlobalSecondaryIndex({
      indexName: "orgId-index",
      partitionKey: { name: "orgId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.nameListsTable = new dynamodb.Table(this, "NameListsTable", {
      partitionKey: { name: "orgId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "listId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy,
    });

    this.sessionsTable = new dynamodb.Table(this, "SessionsTable", {
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy,
    });
    this.sessionsTable.addGlobalSecondaryIndex({
      indexName: "orgId-index",
      partitionKey: { name: "orgId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.sessionsTable.addGlobalSecondaryIndex({
      indexName: "adminId-index",
      partitionKey: { name: "adminId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.wsConnectionsTable = new dynamodb.Table(this, "WsConnectionsTable", {
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: "ttl",
      removalPolicy,
    });

    this.spinHistoryTable = new dynamodb.Table(this, "SpinHistoryTable", {
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp#spinId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy,
    });

    new cdk.CfnOutput(this, "OrgsTableArn", { value: this.orgsTable.tableArn, exportName: "NakomisScrumOrgsTableArn" });
    new cdk.CfnOutput(this, "AdminsTableArn", { value: this.adminsTable.tableArn, exportName: "NakomisScrumAdminsTableArn" });
    new cdk.CfnOutput(this, "NameListsTableArn", { value: this.nameListsTable.tableArn, exportName: "NakomisScrumNameListsTableArn" });
    new cdk.CfnOutput(this, "SessionsTableArn", { value: this.sessionsTable.tableArn, exportName: "NakomisScrumSessionsTableArn" });
    new cdk.CfnOutput(this, "WsConnectionsTableArn", { value: this.wsConnectionsTable.tableArn, exportName: "NakomisScrumWsConnectionsTableArn" });
    new cdk.CfnOutput(this, "SpinHistoryTableArn", { value: this.spinHistoryTable.tableArn, exportName: "NakomisScrumSpinHistoryTableArn" });
  }
}
