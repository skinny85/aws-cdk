import cfn = require('@aws-cdk/aws-cloudformation');
import codecommit = require('@aws-cdk/aws-codecommit');
import cdk = require('@aws-cdk/cdk');
import codepipeline = require('../lib');

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-codepipeline-cloudformation');

/// !show
// Source stage: read from repository
const repo = new codecommit.Repository(stack, 'TemplateRepo', {
  repositoryName: 'template-repo'
});
const source = new codecommit.PipelineSourceAction('Source', {
  repository: repo,
  outputArtifactName: 'SourceArtifact',
  pollForSourceChanges: true,
});
const sourceStage = new codepipeline.Stage('Source', {
  actions: [source],
});

// Deployment stage: create and deploy changeset with manual approval
const stackName = 'OurStack';
const changeSetName = 'StagedChangeSet';

const prodStage = new codepipeline.Stage('Deploy', {
  actions: [
    new cfn.PipelineCreateReplaceChangeSetAction('PrepareChanges', {
      stackName,
      changeSetName,
      adminPermissions: true,
      templatePath: source.outputArtifact.atPath('template.yaml'),
    }),
    new codepipeline.ManualApprovalAction('ApproveChanges'),
    new cfn.PipelineExecuteChangeSetAction('ExecuteChanges', {
      stackName,
      changeSetName,
    }),
  ],
});

new codepipeline.Pipeline(stack, 'Pipeline', {
  stages: [
      sourceStage,
      prodStage,
  ],
});
/// !hide

app.run();
