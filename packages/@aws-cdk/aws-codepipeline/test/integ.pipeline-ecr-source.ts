import ecr = require('@aws-cdk/aws-ecr');
import s3 = require('@aws-cdk/aws-s3');
import cdk = require('@aws-cdk/cdk');
import codepipeline = require('../lib');

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-codepipeline-ecr-source');

const repository = new ecr.Repository(stack, 'MyEcrRepo');
const sourceStage = new codepipeline.Stage('Source');
sourceStage.addAction(repository.asCodePipelineAction('ECR_Source'));

const approveStage = new codepipeline.Stage('Approve');
approveStage.addAction(new codepipeline.ManualApprovalAction('ManualApproval'));

const bucket = new s3.Bucket(stack, 'MyBucket', {
  removalPolicy: cdk.RemovalPolicy.Destroy,
});
new codepipeline.Pipeline(stack, 'MyPipeline', {
  artifactBucket: bucket,
  stages: [
      sourceStage,
      approveStage,
  ],
});

app.run();
