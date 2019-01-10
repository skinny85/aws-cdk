// import { validateArtifactBounds, validateSourceAction } from '../lib/validation';
import { expect, haveResourceLike } from '@aws-cdk/assert';
import codebuild = require('@aws-cdk/aws-codebuild');
import codecommit = require('@aws-cdk/aws-codecommit');
import actions = require('@aws-cdk/aws-codepipeline-api');
import cdk = require('@aws-cdk/cdk');
import { Test } from 'nodeunit';
import codepipeline = require('../lib');

// tslint:disable:object-literal-key-quotes

export = {
  'artifact bounds validation': {

    'artifacts count exceed maximum'(test: Test) {
      const result = boundsValidationResult(1, 0, 0);
      test.deepEqual(result.length, 1);
      test.ok(result[0].match(/cannot have more than 0/), 'the validation should have failed');
      test.done();
    },

    'artifacts count below minimum'(test: Test) {
      const result = boundsValidationResult(1, 2, 2);
      test.deepEqual(result.length, 1);
      test.ok(result[0].match(/must have at least 2/), 'the validation should have failed');
      test.done();
    },

    'artifacts count within bounds'(test: Test) {
      const result = boundsValidationResult(1, 0, 2);
      test.deepEqual(result.length, 0);
      test.done();
    },
  },

  'action type validation': {

    'must be source and is source'(test: Test) {
      const result = actions.validateSourceAction(true, actions.ActionCategory.Source, 'test action', 'test stage');
      test.deepEqual(result.length, 0);
      test.done();
    },

    'must be source and is not source'(test: Test) {
      const result = actions.validateSourceAction(true, actions.ActionCategory.Deploy, 'test action', 'test stage');
      test.deepEqual(result.length, 1);
      test.ok(result[0].match(/may only contain Source actions/), 'the validation should have failed');
      test.done();
    },

    'cannot be source and is source'(test: Test) {
      const result = actions.validateSourceAction(false, actions.ActionCategory.Source, 'test action', 'test stage');
      test.deepEqual(result.length, 1);
      test.ok(result[0].match(/may only occur in first stage/), 'the validation should have failed');
      test.done();
    },

    'cannot be source and is not source'(test: Test) {
      const result = actions.validateSourceAction(false, actions.ActionCategory.Deploy, 'test action', 'test stage');
      test.deepEqual(result.length, 0);
      test.done();
    },
  },

  'automatically assigns artifact names to the Actions'(test: Test) {
    const stack = new cdk.Stack();
    const pipeline = new codepipeline.Pipeline(stack, 'pipeline');

    const repo = new codecommit.Repository(stack, 'Repo', {
      repositoryName: 'Repo',
    });
    const sourceAction = repo.asCodePipelineAction('CodeCommit');
    pipeline.addStage(new codepipeline.Stage('Source').addAction(sourceAction));

    const project = new codebuild.PipelineProject(stack, 'Project');
    pipeline.addStage(new codepipeline.Stage('Build', {
      actions: [
        project.asCodePipelineAction('CodeBuild', {
          inputArtifact: sourceAction.outputArtifact,
        }),
      ],
    }));

    expect(stack).to(haveResourceLike('AWS::CodePipeline::Pipeline', {
      "Stages": [
        {
          "Name": "Source",
          "Actions": [
            {
              "Name": "CodeCommit",
              "InputArtifacts": [],
              "OutputArtifacts": [
                {
                  "Name": "Artifact_CodeCommit_Repo",
                },
              ],
            }
          ],
        },
        {
          "Name": "Build",
          "Actions": [
            {
              "Name": "CodeBuild",
              "InputArtifacts": [
                {
                  "Name": "Artifact_CodeCommit_Repo",
                }
              ],
              "OutputArtifacts": [
                {
                  "Name": "Artifact_CodeBuild_Project",
                },
              ],
            }
          ],
        },
      ],
    }));

    test.done();
  },
};

function boundsValidationResult(numberOfArtifacts: number, min: number, max: number): string[] {
  const artifacts: actions.Artifact[] = [];
  for (let i = 0; i < numberOfArtifacts; i++) {
    artifacts.push(new actions.Artifact(`TestArtifact${i}`));
  }
  return actions.validateArtifactBounds('output', artifacts, min, max, 'testCategory', 'testProvider');
}
