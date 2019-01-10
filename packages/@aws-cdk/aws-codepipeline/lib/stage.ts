import cpapi = require('@aws-cdk/aws-codepipeline-api');
import events = require('@aws-cdk/aws-events');
import cdk = require('@aws-cdk/cdk');
import { CfnPipeline } from './codepipeline.generated';
import { Pipeline } from './pipeline';

/**
 * Allows you to control where to place a new Stage when it's added to the Pipeline.
 * Note that you can provide only one of the below properties -
 * specifying more than one will result in a validation error.
 *
 * @see #rightBefore
 * @see #justAfter
 * @see #atIndex
 */
export interface StagePlacement {
  /**
   * Inserts the new Stage as a parent of the given Stage
   * (changing its current parent Stage, if it had one).
   */
  readonly rightBefore?: Stage;

  /**
   * Inserts the new Stage as a child of the given Stage
   * (changing its current child Stage, if it had one).
   */
  readonly justAfter?: Stage;

  /**
   * Inserts the new Stage at the given index in the Pipeline,
   * moving the Stage currently at that index,
   * and any subsequent ones, one index down.
   * Indexing starts at 0.
   * The maximum allowed value is {@link Pipeline#stageCount},
   * which will insert the new Stage at the end of the Pipeline.
   */
  readonly atIndex?: number;
}

/**
 * The construction properties for {@link Stage}.
 */
export interface StageProps {
  actions?: cpapi.Action[];
}

/**
 * A Stage in a Pipeline.
 * Stages are added to a Pipeline by constructing a new Stage,
 * and passing the Pipeline it belongs to through the {@link StageProps#pipeline} attribute.
 *
 * @example
 *   // add a Stage to a Pipeline
 *   new Stage(this, 'MyStage', {
 *     pipeline: myPipeline,
 *   });
 */
export class Stage implements cpapi.IStage {
  public readonly stageName: string;
  private readonly _actions = new Array<cpapi.Action>();

  /**
   * The Pipeline this Stage is a part of.
   */
  private pipeline?: Pipeline;
  private parent?: cdk.Construct;

  /**
   * Create a new Stage.
   */
  constructor(stageName: string, props: StageProps = {}) {
    cpapi.validateName('Stage', stageName);
    this.stageName = stageName;

    for (const action of props.actions || []) {
      this.addAction(action);
    }
  }

  /**
   * Get a duplicate of this stage's list of actions.
   */
  public get actions(): cpapi.Action[] {
    return this._actions.slice();
  }

  public validate(): string[] {
    return this.validateHasActions();
  }

  public render(): any {
    return {
      name: this.stageName,
      actions: this._actions.map(action => this.renderAction(action)),
    };
  }

  public addAction(action: cpapi.Action): cpapi.IStage {
    // check for duplicate Actions and names
    if (this._actions.find(a => a.actionName === action.actionName)) {
      throw new Error(`Stage ${this.stageName} already contains an Action with name '${action.actionName}'`);
    }

    this._actions.push(action);
    if (this.stageIsAttachedToPipeline()) {
      this.attachActionToPipeline(action);
    }

    return this;
  }

  public onStateChange(name: string, target?: events.IEventRuleTarget, options?: events.EventRuleProps) {
    const rule = new events.EventRule(this.getParent('onStateChange'), name, options);
    rule.addTarget(target);
    rule.addEventPattern({
      detailType: [ 'CodePipeline Stage Execution State Change' ],
      source: [ 'aws.codepipeline' ],
      resources: [ this.pipeline!.pipelineArn ],
      detail: {
        stage: [ this.stageName ],
      },
    });
    return rule;
  }

  // ignore unused private method (it's actually used in Pipeline)
  // @ts-ignore
  private _attachStageToPipeline(pipeline: Pipeline): void {
    if (this.stageIsAttachedToPipeline()) {
      throw new Error(`Stage '${this.stageName}' has been added to a Pipeline twice`);
    }
    this.pipeline = pipeline;
    this.parent = new cdk.Construct(pipeline, this.stageName);
    for (const action of this._actions) {
      this.attachActionToPipeline(action);
    }
  }

  private stageIsAttachedToPipeline() {
    return this.pipeline !== undefined;
  }

  private attachActionToPipeline(action: cpapi.Action) {
    const actionParent = new cdk.Construct(this.parent!, action.actionName);
    (action as any)._attachActionToPipeline(this.pipeline, this, actionParent);
  }

  private getParent(methodName: string): cdk.Construct {
    if (this.parent) {
      return this.parent;
    } else {
      throw new Error(`Cannot call method '${methodName}' until the Stage has been added to a Pipeline with addStage`);
    }
  }

  // ignore unused private method (it's actually used in Action)
  // @ts-ignore
  private _actionAddedToStage(action: cpapi.Action): void {
    (this.pipeline as any)._attachActionToRegion(this, action);
  }

  private renderAction(action: cpapi.Action): CfnPipeline.ActionDeclarationProperty {
    return {
      name: action.actionName,
      inputArtifacts: action._inputArtifacts.map(a => ({ name: a.artifactName })),
      actionTypeId: {
        category: action.category.toString(),
        version: action.version,
        owner: action.owner,
        provider: action.provider,
      },
      configuration: action.configuration,
      outputArtifacts: action._outputArtifacts.map(a => ({ name: a.artifactName })),
      runOrder: action.runOrder,
    };
  }

  private validateHasActions(): string[] {
    if (this._actions.length === 0) {
      return [`Stage '${this.stageName}' must have at least one Action`];
    }
    return [];
  }
}
