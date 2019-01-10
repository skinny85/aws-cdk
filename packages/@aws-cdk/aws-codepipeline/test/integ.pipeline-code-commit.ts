import codecommit = require('@aws-cdk/aws-codecommit');
import cdk = require('@aws-cdk/cdk');
import codepipeline = require('../lib');

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-codepipeline-codecommit');

const repo = new codecommit.Repository(stack, 'MyRepo', { repositoryName: 'my-repo' });

new codepipeline.Pipeline(stack, 'Pipeline', {
  stages: [
    new codepipeline.Stage('source', {
      actions: [
        repo.asCodePipelineAction('source', {
          outputArtifactName: 'SourceArtifact',
        }),
      ],
    }),
    new codepipeline.Stage('build', {
      actions: [
        new codepipeline.ManualApprovalAction('manual'),
      ],
    }),
  ],
});

app.run();
