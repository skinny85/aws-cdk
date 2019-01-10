import cloudformation = require('@aws-cdk/aws-cloudformation');
import s3 = require('@aws-cdk/aws-s3');
import cdk = require('@aws-cdk/cdk');
import codepipeline = require('../lib');

const app = new cdk.App();

const region = 'us-west-2'; // hardcode the region
const stack = new cdk.Stack(app, 'aws-cdk-codepipeline-cloudformation-cross-region', {
  env: {
    region,
  },
});

const bucket = new s3.Bucket(stack, 'MyBucket', {
  versioned: true,
  removalPolicy: cdk.RemovalPolicy.Destroy,
});

const sourceAction = bucket.asCodePipelineAction('S3', {
  bucketKey: 'some/path',
});

new codepipeline.Pipeline(stack, 'MyPipeline', {
  artifactBucket: bucket,
  stages: [
    new codepipeline.Stage('Source', {
      actions: [sourceAction],
    }),
    new codepipeline.Stage('CFN', {
      actions: [
        new cloudformation.PipelineCreateUpdateStackAction('CFN_Deploy', {
          stackName: 'aws-cdk-codepipeline-cross-region-deploy-stack',
          templatePath: sourceAction.outputArtifact.atPath('template.yml'),
          adminPermissions: false,
          region,
        }),
      ],
    }),
  ],
});

app.run();
