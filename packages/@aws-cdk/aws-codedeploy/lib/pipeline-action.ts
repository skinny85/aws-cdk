import codepipeline = require('@aws-cdk/aws-codepipeline-api');
import iam = require('@aws-cdk/aws-iam');
import cdk = require('@aws-cdk/cdk');
import { IServerDeploymentGroup } from './deployment-group';

/**
 * Common properties for creating a {@link PipelineDeployAction},
 * either directly, through its constructor,
 * or through {@link IServerDeploymentGroup#addToPipeline}.
 */
export interface CommonPipelineDeployActionProps extends codepipeline.CommonActionProps {
  /**
   * The source to use as input for deployment.
   */
  inputArtifact: codepipeline.Artifact;
}

/**
 * Construction properties of the {@link PipelineDeployAction CodeDeploy deploy CodePipeline Action}.
 */
export interface PipelineDeployActionProps extends CommonPipelineDeployActionProps {
  /**
   * The CodeDeploy Deployment Group to deploy to.
   */
  deploymentGroup: IServerDeploymentGroup;
}

export class PipelineDeployAction extends codepipeline.DeployAction {
  private readonly deploymentGroup: IServerDeploymentGroup;

  constructor(id: string, props: PipelineDeployActionProps) {
    super(id, {
      runOrder: props.runOrder,
      artifactBounds: { minInputs: 1, maxInputs: 1, minOutputs: 0, maxOutputs: 0 },
      provider: 'CodeDeploy',
      inputArtifact: props.inputArtifact,
      configuration: {
        ApplicationName: props.deploymentGroup.application.applicationName,
        DeploymentGroupName: props.deploymentGroup.deploymentGroupName,
      },
    });

    this.deploymentGroup = props.deploymentGroup;
  }

  protected bind(pipeline: codepipeline.IPipeline, _parent: cdk.Construct): void {
    // permissions, based on:
    // https://docs.aws.amazon.com/codedeploy/latest/userguide/auth-and-access-control-permissions-reference.html

    pipeline.role.addToPolicy(new iam.PolicyStatement()
      .addResource(this.deploymentGroup.application.applicationArn)
      .addActions(
        'codedeploy:GetApplicationRevision',
        'codedeploy:RegisterApplicationRevision',
      ));

    pipeline.role.addToPolicy(new iam.PolicyStatement()
      .addResource(this.deploymentGroup.deploymentGroupArn)
      .addActions(
        'codedeploy:CreateDeployment',
        'codedeploy:GetDeployment',
      ));

    pipeline.role.addToPolicy(new iam.PolicyStatement()
      .addResource(this.deploymentGroup.deploymentConfig.deploymentConfigArn)
      .addActions(
        'codedeploy:GetDeploymentConfig',
      ));

    // grant the ASG Role permissions to read from the Pipeline Bucket
    for (const asg of this.deploymentGroup.autoScalingGroups || []) {
      pipeline.grantBucketRead(asg.role);
    }
  }
}
