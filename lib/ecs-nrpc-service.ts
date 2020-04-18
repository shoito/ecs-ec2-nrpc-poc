import * as cdk from "@aws-cdk/core";
import * as ecs from "@aws-cdk/aws-ecs";
import * as elb from "@aws-cdk/aws-elasticloadbalancingv2";
import * as cloudmap from "@aws-cdk/aws-servicediscovery";

export interface ExtendedStackProps extends cdk.StackProps {
  cluster: ecs.Cluster;
  listener: elb.ApplicationListener;
}

export class EcsNrpcServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: ExtendedStackProps) {
    super(scope, id, props);

    const PORT = 80;

    const logDriver = new ecs.AwsLogDriver({
      streamPrefix: "poc",
    });

    const sourceVolumeName = "nginx";
    const hostSourcePath = "/var/cache/nginx";
    const taskDef = new ecs.Ec2TaskDefinition(
      this,
      "poc-ecs-ec2-nrpc-task-def",
      {
        family: "poc-ecs-ec2-nrpc-task",
        networkMode: ecs.NetworkMode.AWS_VPC,
        volumes: [
          {
            name: sourceVolumeName,
            host: {
              sourcePath: hostSourcePath,
            },
          },
          // {
          //   name: sourceVolumeName,
          //   dockerVolumeConfiguration: {
          //     driver: "local",
          //     scope: ecs.Scope.TASK,
          //   },
          // },
        ],
      }
    );

    const container = taskDef.addContainer("poc-ecs-ec2-nrpc-container", {
      image: ecs.ContainerImage.fromAsset("./containers/nrpc"),
      memoryLimitMiB: 512,
      cpu: 256,
      logging: logDriver,
    });

    container.addMountPoints({
      sourceVolume: sourceVolumeName,
      containerPath: hostSourcePath,
      readOnly: false,
    });

    container.addPortMappings({
      containerPort: PORT,
      hostPort: PORT,
      protocol: ecs.Protocol.TCP,
    });

    const service = new ecs.Ec2Service(this, "poc-ecs-ec2-nrpc-service", {
      serviceName: "poc-ecs-ec2-nrpc-service",
      cluster: props.cluster,
      taskDefinition: taskDef,
      desiredCount: 2, // ECS ClusterのdesiredCapacityはこの値以上である必要がある
      healthCheckGracePeriod: cdk.Duration.minutes(1),
      deploymentController: { type: ecs.DeploymentControllerType.ECS },
    });

    service.enableCloudMap({
      name: "poc-ecs-ec2-nrpc-service",
      dnsRecordType: cloudmap.DnsRecordType.SRV,
      dnsTtl: cdk.Duration.seconds(60),
    });

    props.listener.addTargets("poc-ecs-ec2-nrpc-tg", {
      targetGroupName: "poc-ecs-ec2-nrpc-tg",
      protocol: elb.ApplicationProtocol.HTTP,
      port: PORT,
      healthCheck: {
        path: "/health",
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(10),
      },
      targets: [service],
    });
  }
}
