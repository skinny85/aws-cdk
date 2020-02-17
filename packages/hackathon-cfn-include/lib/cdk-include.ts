import * as s3 from '@aws-cdk/aws-s3';
import * as core from '@aws-cdk/core';
import * as fs from 'fs-extra';

export class CdkInclude {
  public static includeJsonTemplate(scope: core.Construct, path: string): void {
    const template = fs.readJsonSync(path);
    for (const [logicalId, resourceConfig] of Object.entries(template.Resources || {})) {
      switch ((resourceConfig as any).Type) {
        case 'AWS::S3::Bucket':
          new s3.CfnBucket(scope, logicalId);
          break;
      }
    }
  }
}
