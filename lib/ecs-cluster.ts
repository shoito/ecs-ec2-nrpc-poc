import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as cloudmap from "@aws-cdk/aws-servicediscovery";
import * as iam from "@aws-cdk/aws-iam";

export interface ExtendedStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class EcsClusterStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;

  constructor(scope: cdk.App, id: string, props: ExtendedStackProps) {
    super(scope, id, props);

    this.cluster = new ecs.Cluster(this, "poc-cluster", {
      clusterName: "poc-cluster",
      vpc: props.vpc,
      containerInsights: true,
      defaultCloudMapNamespace: {
        name: "poc.internal",
        type: cloudmap.NamespaceType.DNS_PRIVATE,
      },
    });

    const asg = this.cluster.addCapacity("poc-cluster-auto-scaling-group", {
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.A1,
        ec2.InstanceSize.LARGE
      ),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.ARM), // A1インスタンスはARMである必要がある
      desiredCapacity: 2, // ECS(EC2) ServiceのdesiredCountはこの値以下である必要がある
    });
    asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );
  }
}
