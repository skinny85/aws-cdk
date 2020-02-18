import '@aws-cdk/assert/jest';
import * as core from '@aws-cdk/core';
import * as path from 'path';
import { CdkInclude } from '../lib';

// tslint:disable:object-literal-key-quotes

jest.setTimeout(600_000); // loading the JSII type system is slooooooow

describe('CDK Include', () => {
  test('can ingest a template with only an S3 Bucket, and output it unchanged', async () => {
    const stack = new core.Stack();

    await CdkInclude.includeJsonTemplate(stack,
      path.join(__dirname, 'test-templates', 'only-empty-bucket.json'));

    expect(stack).toMatchTemplate({
      "Resources": {
        "Bucket": {
          "Type": "AWS::S3::Bucket",
        },
      },
    });
  });
});
