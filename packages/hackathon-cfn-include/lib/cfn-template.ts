import * as core from '@aws-cdk/core';

export interface ICfnTemplate {
  getResource(logicalId: string): core.CfnResource;
}
