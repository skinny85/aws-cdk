import '@aws-cdk/assert/jest';
import * as s3 from '@aws-cdk/aws-s3';
import * as core from '@aws-cdk/core';
import * as path from 'path';
import { CdkInclude, ICfnTemplate } from '../lib';

// tslint:disable:object-literal-key-quotes

describe('CDK Include', () => {
  test('can ingest a template with only an empty S3 Bucket, and output it unchanged', () => {
    const stack = new core.Stack();

    includeJsonTemplate(stack, 'only-empty-bucket.json');

    expect(stack).toMatchTemplate({
      "Resources": {
        "Bucket": {
          "Type": "AWS::S3::Bucket",
        },
      },
    });
  });

  test('can ingest a template with only an empty S3 Bucket, and change its property', () => {
    const stack = new core.Stack();

    const cfnTemplate = includeJsonTemplate(stack, 'only-empty-bucket.json');

    const bucket = cfnTemplate.getResource('Bucket') as s3.CfnBucket;
    bucket.bucketName = 'my-bucket-name';

    expect(stack).toMatchTemplate({
      "Resources": {
        "Bucket": {
          "Type": "AWS::S3::Bucket",
          "Properties": {
            "BucketName": "my-bucket-name",
          },
        },
      },
    });
  });

  test('can ingest a template with only an S3 Bucket with complex properties, and output it unchanged', () => {
    const stack = new core.Stack();

    const cfnTemplate = includeJsonTemplate(stack, 'only-bucket-complex-props.json');
    const bucket = cfnTemplate.getResource('Bucket') as s3.CfnBucket;

    expect((bucket.corsConfiguration as any).corsRules).toHaveLength(1);
    expect(stack).toMatchTemplate({
      "Resources": {
        "Bucket": {
          "Type": "AWS::S3::Bucket",
          "Properties": {
            "CorsConfiguration": {
              "CorsRules": [
                {
                  "AllowedMethods": ["GET"],
                  "AllowedOrigins": ["*"],
                  "MaxAge": 10,
                },
              ],
            },
          },
        },
      },
    });
  });
});

function includeJsonTemplate(scope: core.Construct, testTemplate: string): ICfnTemplate {
  return CdkInclude.includeJsonTemplate(scope,
    path.join(__dirname, 'test-templates', testTemplate));
}
