import s3 = require('@aws-cdk/aws-s3');
import cdk = require('@aws-cdk/cdk');
import codepipeline = require('../lib');

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-codepipeline-manual-approval');

const bucket = new s3.Bucket(stack, 'Bucket');

const pipeline = new codepipeline.Pipeline(stack, 'Pipeline', {
  artifactBucket: bucket,
});

const sourceStage = new codepipeline.Stage('Source');
sourceStage.addAction(new s3.PipelineSourceAction('S3', {
  bucket,
  bucketKey: 'file.zip',
}));

const approveStage = new codepipeline.Stage('Approve');
approveStage.addAction(new codepipeline.ManualApprovalAction('ManualApproval', {
  notifyEmails: ['adamruka85@gmail.com'],
}));

pipeline
  .addStage(sourceStage)
  .addStage(approveStage);

app.run();
