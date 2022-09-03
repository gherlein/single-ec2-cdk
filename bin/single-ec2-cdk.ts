#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SingleEc2CdkStack } from '../lib/single-ec2-cdk-stack';

const app = new cdk.App();
new SingleEc2CdkStack(app, 'SingleEc2CdkStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  stackName: process.env.STACKNAME
});