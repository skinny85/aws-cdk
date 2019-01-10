import codebuild = require('@aws-cdk/aws-codebuild');
import codecommit = require('@aws-cdk/aws-codecommit');
import s3 = require('@aws-cdk/aws-s3');
import cdk = require('@aws-cdk/cdk');
import codepipeline = require('../lib');

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-codepipeline-codebuild-multiple-inputs-outputs');

const repository = new codecommit.Repository(stack, 'MyRepo', {
  repositoryName: 'MyIntegTestTempRepo',
});
const bucket = new s3.Bucket(stack, 'MyBucket', {
  versioned: true,
  removalPolicy: cdk.RemovalPolicy.Destroy,
});

const pipeline = new codepipeline.Pipeline(stack, 'Pipeline', {
  artifactBucket: bucket,
});

const sourceAction1 = repository.asCodePipelineAction('Source1');
const sourceAction2 = bucket.asCodePipelineAction('Source2', {
  bucketKey: 'some/path',
});
pipeline.addStage(new codepipeline.Stage('Source', {
  actions: [
    sourceAction1,
    sourceAction2,
  ],
}));

const project = new codebuild.PipelineProject(stack, 'MyBuildProject');
const buildAction = project.asCodePipelineAction('Build1', {
  inputArtifact: sourceAction1.outputArtifact,
  additionalInputArtifacts: [
    sourceAction2.outputArtifact,
  ],
  additionalOutputArtifactNames: [
    'CustomOutput1',
  ],
});
const testAction = project.asCodePipelineTestAction('Build2', {
  inputArtifact: sourceAction2.outputArtifact,
  additionalInputArtifacts: [
    sourceAction1.outputArtifact,
  ],
  additionalOutputArtifactNames: [
    'CustomOutput2',
  ],
});
pipeline.addStage(new codepipeline.Stage('Build', {
  actions: [
    buildAction,
    testAction,
  ],
}));

// some assertions on the Action helper methods
if (buildAction.additionalOutputArtifacts().length !== 1) {
  throw new Error(`Expected build Action to have 1 additional output artifact, but was: ${buildAction.additionalOutputArtifacts()}`);
}
buildAction.additionalOutputArtifact('CustomOutput1'); // that it doesn't throw

if (testAction.outputArtifact) {
  throw new Error(`Expected test Action output Artifact to be undefined, was: ${testAction.outputArtifact}`);
}
if (testAction.additionalOutputArtifacts().length !== 1) {
  throw new Error(`Expected test Action to have 1 additional output artifact, but was: ${testAction.additionalOutputArtifacts()}`);
}
testAction.additionalOutputArtifact('CustomOutput2'); // that it doesn't throw

app.run();
