import events = require('@aws-cdk/aws-events');
import iam = require('@aws-cdk/aws-iam');
import cdk = require('@aws-cdk/cdk');
import { Artifact } from './artifact';
import validation = require('./validation');

export enum ActionCategory {
  Source = 'Source',
  Build = 'Build',
  Test = 'Test',
  Approval = 'Approval',
  Deploy = 'Deploy',
  Invoke = 'Invoke'
}

/**
 * Specifies the constraints on the number of input and output
 * artifacts an action can have.
 *
 * The constraints for each action type are documented on the
 * {@link https://docs.aws.amazon.com/codepipeline/latest/userguide/reference-pipeline-structure.html Pipeline Structure Reference} page.
 */
export interface ActionArtifactBounds {
  readonly minInputs: number;
  readonly maxInputs: number;
  readonly minOutputs: number;
  readonly maxOutputs: number;
}

export function defaultBounds(): ActionArtifactBounds {
  return {
    minInputs: 0,
    maxInputs: 5,
    minOutputs: 0,
    maxOutputs: 5
  };
}

/**
 * The abstract view of an AWS CodePipeline as required and used by Actions.
 * It extends {@link events.IEventRuleTarget},
 * so this interface can be used as a Target for CloudWatch Events.
 */
export interface IPipeline extends cdk.IConstruct, events.IEventRuleTarget {
  /**
   * The name of the Pipeline.
   */
  readonly pipelineName: string;

  /**
   * The ARN of the Pipeline.
   */
  readonly pipelineArn: string;

  /**
   * The service Role of the Pipeline.
   */
  readonly role: iam.Role;

  /**
   * Grants read permissions to the Pipeline's S3 Bucket to the given Identity.
   *
   * @param identity the IAM Identity to grant the permissions to
   */
  grantBucketRead(identity?: iam.IPrincipal): void;

  /**
   * Grants read & write permissions to the Pipeline's S3 Bucket to the given Identity.
   *
   * @param identity the IAM Identity to grant the permissions to
   */
  grantBucketReadWrite(identity?: iam.IPrincipal): void;
}

/**
 * The abstract interface of a Pipeline Stage that is used by Actions.
 */
export interface IStage {
  /**
   * The physical, human-readable name of this Pipeline Stage.
   */
  readonly stageName: string;

  readonly actions: Action[];
  addAction(action: Action): IStage;
  render(): any;
}

/**
 * Common properties shared by all Actions.
 */
export interface CommonActionProps {
  /**
   * The runOrder property for this Action.
   * RunOrder determines the relative order in which multiple Actions in the same Stage execute.
   *
   * @default 1
   * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/reference-pipeline-structure.html
   */
  runOrder?: number;
}

/**
 * Construction properties of the low-level {@link Action Action class}.
 */
export interface ActionProps extends CommonActionProps {
  category: ActionCategory;
  provider: string;

  /**
   * The region this Action resides in.
   *
   * @default the Action resides in the same region as the Pipeline
   */
  region?: string;

  artifactBounds: ActionArtifactBounds;
  configuration?: any;
  version?: string;
  owner?: string;
}

/**
 * Low-level class for generic CodePipeline Actions.
 * It is recommended that concrete types are used instead, such as {@link codecommit.PipelineSourceAction} or
 * {@link codebuild.PipelineBuildAction}.
 */
export abstract class Action {
  /**
   * The category of the action.
   * The category defines which action type the owner
   * (the entity that performs the action) performs.
   */
  public readonly category: ActionCategory;

  /**
   * The service provider that the action calls.
   */
  public readonly provider: string;

  /**
   * The AWS region the given Action resides in.
   * Note that a cross-region Pipeline requires replication buckets to function correctly.
   * You can provide their names with the {@link PipelineProps#crossRegionReplicationBuckets} property.
   * If you don't, the CodePipeline Construct will create new Stacks in your CDK app containing those buckets,
   * that you will need to `cdk deploy` before deploying the main, Pipeline-containing Stack.
   *
   * @default the Action resides in the same region as the Pipeline
   */
  public readonly region?: string;

  /**
   * The action's configuration. These are key-value pairs that specify input values for an action.
   * For more information, see the AWS CodePipeline User Guide.
   *
   * http://docs.aws.amazon.com/codepipeline/latest/userguide/reference-pipeline-structure.html#action-requirements
   */
  public readonly configuration?: any;

  /**
   * The order in which AWS CodePipeline runs this action.
   * For more information, see the AWS CodePipeline User Guide.
   *
   * https://docs.aws.amazon.com/codepipeline/latest/userguide/reference-pipeline-structure.html#action-requirements
   */
  public readonly runOrder: number;

  public readonly owner: string;
  public readonly version: string;
  public readonly actionName: string;

  private readonly _actionInputArtifacts = new Array<Artifact>();
  private readonly _actionOutputArtifacts = new Array<Artifact>();
  private readonly artifactBounds: ActionArtifactBounds;

  private pipeline?: IPipeline;
  private stage?: IStage;
  private parent?: cdk.Construct;

  constructor(actionName: string, props: ActionProps) {
    validation.validateName('Action', actionName);

    this.owner = props.owner || 'AWS';
    this.version = props.version || '1';
    this.category = props.category;
    this.provider = props.provider;
    this.region = props.region;
    this.configuration = props.configuration;
    this.artifactBounds = props.artifactBounds;
    this.runOrder = props.runOrder === undefined ? 1 : props.runOrder;
    this.actionName = actionName;
  }

  public validate(): string[] {
    return validation.validateArtifactBounds('input', this._actionInputArtifacts, this.artifactBounds.minInputs,
        this.artifactBounds.maxInputs, this.category, this.provider)
      .concat(validation.validateArtifactBounds('output', this._actionOutputArtifacts, this.artifactBounds.minOutputs,
        this.artifactBounds.maxOutputs, this.category, this.provider)
    );
  }

  public onStateChange(name: string, target?: events.IEventRuleTarget, options?: events.EventRuleProps) {
    const rule = new events.EventRule(this.getParent('onStateChange'), name, options);
    rule.addTarget(target);
    rule.addEventPattern({
      detailType: [ 'CodePipeline Stage Execution State Change' ],
      source: [ 'aws.codepipeline' ],
      resources: [ this.pipeline!.pipelineArn ],
      detail: {
        stage: [ this.stage!.stageName ],
        action: [ this.actionName ],
      },
    });
    return rule;
  }

  public get _inputArtifacts(): Artifact[] {
    return this._actionInputArtifacts.slice();
  }

  public get _outputArtifacts(): Artifact[] {
    return this._actionOutputArtifacts.slice();
  }

  protected addOutputArtifact(name: string): Artifact {
    const artifact = new Artifact(name);
    this._actionOutputArtifacts.push(artifact);
    return artifact;
  }

  protected addInputArtifact(artifact: Artifact): Action {
    this._actionInputArtifacts.push(artifact);
    return this;
  }

  protected abstract bind(pipeline: IPipeline, parent: cdk.Construct): void;

  // ignore unused private method (it's actually used in Stage)
  // @ts-ignore
  private _attachActionToPipeline(pipeline: IPipeline, stage: IStage, parent: cdk.Construct): void {
    // ToDo add some validations that this wasn't called multiple times

    this.pipeline = pipeline;
    this.stage = stage;
    this.parent = parent;

    this.bind(pipeline, parent);

    (stage as any)._actionAddedToStage(this);
  }

  private getParent(methodName: string): cdk.Construct {
    if (this.parent) {
      return this.parent;
    } else {
      throw new Error(`Cannot call method '${methodName}' until the Action has been added to a Pipeline with addAction`);
    }
  }
}

// export class ElasticBeanstalkDeploy extends DeployAction {
//   constructor(scope: Stage, id: string, applicationName: string, environmentName: string) {
//     super(scope, id, 'ElasticBeanstalk', { minInputs: 1, maxInputs: 1, minOutputs: 0, maxOutputs: 0 }, {
//       ApplicationName: applicationName,
//       EnvironmentName: environmentName
//     });
//   }
// }

// export class OpsWorksDeploy extends DeployAction {
//   constructor(scope: Stage, id: string, app: string, stack: string, layer?: string) {
//     super(scope, id, 'OpsWorks', { minInputs: 1, maxInputs: 1, minOutputs: 0, maxOutputs: 0 }, {
//       Stack: stack,
//       App: app,
//       Layer: layer,
//     });
//   }
// }

// export class ECSDeploy extends DeployAction {
//   constructor(scope: Stage, id: string, clusterName: string, serviceName: string, fileName?: string) {
//     super(scope, id, 'ECS', { minInputs: 1, maxInputs: 1, minOutputs: 0, maxOutputs: 0 }, {
//       ClusterName: clusterName,
//       ServiceName: serviceName,
//       FileName: fileName,
//     });
//   }
// }
