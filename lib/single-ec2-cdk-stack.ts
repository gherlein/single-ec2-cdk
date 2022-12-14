import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
//import * as aws from 'aws-sdk';


import * as fs from 'fs'
import { InstanceClass, InstanceSize } from 'aws-cdk-lib/aws-ec2';
import * as os from 'os';

interface Config {
  stackName: string,
  ec2Name: string,
  nickName: string,
  ec2Class: string,
  ec2Size: string,
  keyName: string,
  keyFile: string,
  userDataFile: string
  cdkOut: string,
}

const config: Config = require('../configs/config.json');
const defaultUserData: string = "./userdata/user_script.sh";
config.userDataFile = config.userDataFile.replace(/^~/, os.homedir());
console.log("using configuration: ", config);

export class SingleEc2CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    console.log("keyName: ", config.keyName);
    console.log("ec2Name: ", config.ec2Name);

    const vpc = new ec2.Vpc(this, 'CDKVPC', {
      cidr: '10.0.0.0/16',
    });

    const role = new iam.Role(
      this,
      config.ec2Name + '-role',
      { assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com') }
    )

    const ssmPolicyDoc = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["ssm:UpdateInstanceInformation",
            "ssmmessages:CreateControlChannel",
            "ssmmessages:CreateDataChannel",
            "ssmmessages:OpenControlChannel",
            "ssmmessages:OpenDataChannel"],
          resources: ["*"],
        }),
      ],
    });
    const ssmPolicy = new iam.Policy(this, 'ssmPolicy', {
      document: ssmPolicyDoc
    });
    role.attachInlinePolicy(ssmPolicy);

    const securityGroup = new ec2.SecurityGroup(this, config.ec2Name + 'sg',
      {
        vpc: vpc,
        allowAllOutbound: true, // will let your instance send outboud traffic
        securityGroupName: config.ec2Name + '-sg',
      }
    )

    // open the SSH port
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
    )
    /* Uncomment this block if you plan on exposing any standard web server
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080),
    )
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
    )

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
    )
    */
    const instance = new ec2.Instance(this, config.ec2Name as string, {
      vpc: vpc,
      role: role,
      securityGroup: securityGroup,
      instanceName: config.ec2Name,
      instanceType: ec2.InstanceType.of(
        config.ec2Class as InstanceClass,
        config.ec2Size as InstanceSize,
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      keyName: config.keyName,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(100),
        },
      ],
    });

    const arn: string = "arn:aws:ec2:" + process.env.CDK_DEFAULT_REGION + ":" + process.env.CDK_DEFAULT_ACCOUNT + ":instance/" + instance.instanceId;
    const tagPolicyDoc = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["ec2:DescribeTags"], // needed by the set-dns script we install
          resources: [arn],
        }),
      ],
    });
    const tagPolicy = new iam.Policy(this, 'tagPollicy', {
      document: tagPolicyDoc
    });
    role.attachInlinePolicy(tagPolicy);



    // add all our configs as tags
    cdk.Tags.of(instance).add('ec2Name', config.ec2Name);
    cdk.Tags.of(instance).add('nickName', config.nickName);
    cdk.Tags.of(instance).add('keyName', config.keyName);
    cdk.Tags.of(instance).add('keyFile', config.keyFile);
    cdk.Tags.of(instance).add('ec2Name', config.ec2Name);

    new cdk.CfnOutput(this, 'ec2-instance-ip-address', {
      value: instance.instancePublicIp
    })
    new cdk.CfnOutput(this, 'ec2-instance-id', {
      value: instance.instanceId
    })
    new cdk.CfnOutput(this, 'ec2-instance-public-dnsname', {
      value: instance.instancePublicDnsName
    })


    let localUserData: string = fs.readFileSync(defaultUserData, 'utf8');

    var userData: string = "";
    if (config.userDataFile) {
      userData = fs.readFileSync(config.userDataFile, 'utf8');
    }
    const totalUserData: string = localUserData + userData;
    console.log("creating userdata script: ");
    console.log(totalUserData);
    instance.addUserData(totalUserData);

  }
}

