import codepipeline = require('@aws-cdk/aws-codepipeline');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/cdk');
import path = require('path');

export interface LambdaDeployActionProps extends codepipeline.CommonActionProps {
  readonly inputArtifact?: codepipeline.Artifact;
}

export class LambdaDeployAction extends codepipeline.Action {
  private func?: lambda.Function;

  constructor(props: LambdaDeployActionProps) {
    super({
      // we're actually just a Pipeline invoke function in disguise
      ...props,
      category: codepipeline.ActionCategory.Invoke,
      provider: 'Lambda',
      artifactBounds: codepipeline.defaultBounds(),
      configuration: {
        FunctionName: new cdk.Token(() => this.func!.functionName),
        UserParameters: new cdk.Token(() => this.userParameters()),
      }
    });

    // handle input artifacts
    if (props.inputArtifact) {
      this.addInputArtifact(props.inputArtifact);
    }
  }

  protected bind(info: codepipeline.ActionBind): void {
    // allow pipeline to list functions
    info.role.addToPolicy(new iam.PolicyStatement()
      .addAction('lambda:ListFunctions')
      .addAllResources());

    this.func = new lambda.Function(info.scope, 'Lambda', {
      runtime: lambda.Runtime.NodeJS810,
      handler: 'lambda-deploy-lambda.handler',
      code: lambda.Code.asset(path.join(__dirname, '../../resources/lambda-deploy-action')),
    });

    // allow Pipeline to invoke this Lambda Function
    info.role.addToPolicy(new iam.PolicyStatement()
      .addAction('lambda:InvokeFunction')
      .addResource(this.func.functionArn));

    // allow Lambda to put job results for this Pipeline
    this.func.addToRolePolicy(new iam.PolicyStatement()
      .addActions(
        'codepipeline:PutJobSuccessResult',
        'codepipeline:PutJobFailureResult',
      )
      .addAllResources());
  }

  private userParameters(): any {
    return undefined;
  }
}
