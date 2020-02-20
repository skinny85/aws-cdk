import '@aws-cdk/assert/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
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

  test('allows referring to a bucket defined in the template in your CDK code', () => {
    const stack = new core.Stack();

    const cfnTemplate = includeJsonTemplate(stack, 'only-empty-bucket.json');
    const bucket = cfnTemplate.getResource('Bucket') as s3.CfnBucket;

    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.AnyPrincipal(),
    });
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:*'],
      resources: [bucket.attrArn],
    }));

    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      "PolicyDocument": {
        "Statement": [
          {
            "Action": "s3:*",
            "Resource": {
              "Fn::GetAtt": [
                "Bucket",
                "Arn",
              ],
            },
          },
        ],
      },
    });
  });

  test('allows creating an L2 Bucket from the L1 Bucket extracted from the ingested template', () => {
    const stack = new core.Stack();

    const cfnTemplate = includeJsonTemplate(stack, 'only-empty-bucket.json');
    const cfnBucket = cfnTemplate.getResource('Bucket') as s3.CfnBucket;
    const bucket = s3.Bucket.fromCfnBucket(cfnBucket);

    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.AnyPrincipal(),
    });
    bucket.grantRead(role);

    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      "PolicyDocument": {
        "Statement": [
          {
            "Action": [
              "s3:GetObject*",
              "s3:GetBucket*",
              "s3:List*",
            ],
            "Resource": [
              {
                "Fn::GetAtt": [
                  "Bucket",
                  "Arn",
                ],
              },
              {
                "Fn::Join": [
                  "",
                  [
                    {
                      "Fn::GetAtt": [
                        "Bucket",
                        "Arn",
                      ],
                    },
                    "/*",
                  ],
                ],
              },
            ],
          },
        ],
      },
    });
  });

  test('can ingest a template with a Bucket Ref-erencing a KMS Key', () => {
    const stack = new core.Stack();

    includeJsonTemplate(stack, 'bucket-with-encryption-key.json');

    expect(stack).toMatchTemplate({
      "Resources": {
        "Key": {
          "Type": "AWS::KMS::Key",
          "Properties": {
            "KeyPolicy": {
              "Statement": [
                {
                  "Action": [
                    "kms:*"
                  ],
                  "Effect": "Allow",
                  "Principal": {
                    "AWS": {
                      "Fn::Join": ["", [
                        "arn:",
                        { "Ref": "AWS::Partition" },
                        ":iam::",
                        { "Ref": "AWS::AccountId" },
                        ":root",
                      ]],
                    },
                  },
                  "Resource": "*",
                },
              ],
              "Version": "2012-10-17",
            },
          },
          "DeletionPolicy": "Delete",
          "UpdateReplacePolicy": "Delete",
        },
        "Bucket": {
          "Type": "AWS::S3::Bucket",
          "Properties": {
            "BucketEncryption": {
              "ServerSideEncryptionConfiguration": [
                {
                  "ServerSideEncryptionByDefault": {
                    "KMSMasterKeyID": {
                      "Fn::GetAtt": [
                        "Key",
                        "Arn",
                      ],
                    },
                    "SSEAlgorithm": "aws:kms",
                  },
                },
              ],
            },
          },
          "DeletionPolicy": "Retain",
          "UpdateReplacePolicy": "Retain",
        },
      },
    });
  });

  test("populates the L2 Bucket's, created from the L1 Bucket extracted from the ingested template, " +
      "encryptionKey property from the template's Fn::GetAtt expression", () => {
    const stack = new core.Stack();

    const cfnTemplate = includeJsonTemplate(stack, 'bucket-with-encryption-key.json');
    const cfnBucket = cfnTemplate.getResource('Bucket') as s3.CfnBucket;
    const bucket = s3.Bucket.fromCfnBucket(cfnBucket);

    expect(bucket.encryptionKey).toBeDefined();
  });

  test('renders changes in the KeyPolicy of the L2 KMS Key, created from the l1 Key extracted from the ingested template', () => {
    const stack = new core.Stack();

    const cfnTemplate = includeJsonTemplate(stack, 'bucket-with-encryption-key.json');
    const cfnKey = cfnTemplate.getResource('Key') as kms.CfnKey;
    const key = kms.Key.fromCfnKey(cfnKey);

    key.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:*'],
      principals: [new iam.AnyPrincipal()],
      resources: ['*'],
    }));

    expect(stack).toHaveResourceLike('AWS::KMS::Key', {
      "KeyPolicy": {
        "Statement": [
          {
            "Action": "kms:*",
            "Principal": {
              "AWS": {
                "Fn::Join": ["", [
                  "arn:",
                  { "Ref": "AWS::Partition" },
                  ":iam::",
                  { "Ref": "AWS::AccountId" },
                  ":root",
                ]],
              },
            },
            "Resource": "*",
          },
          {
            "Action": "s3:*",
            "Principal": "*",
            "Resource": "*",
          },
        ],
      },
    });
  });
});

function includeJsonTemplate(scope: core.Construct, testTemplate: string): ICfnTemplate {
  return CdkInclude.includeJsonTemplate(scope,
    path.join(__dirname, 'test-templates', testTemplate));
}
