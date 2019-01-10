import actions = require('@aws-cdk/aws-codepipeline-api');
import sns = require('@aws-cdk/aws-sns');
import cdk = require('@aws-cdk/cdk');

/**
 * Construction properties of the {@link ManualApprovalAction}.
 */
export interface ManualApprovalActionProps extends actions.CommonActionProps {
  /**
   * Optional SNS topic to send notifications to when an approval is pending.
   */
  notificationTopic?: sns.ITopic;

  /**
   * A list of email addresses to subscribe to notifications when this Action is pending approval.
   * If this has been provided, but not `notificationTopic`,
   * a new Topic will be created.
   */
  notifyEmails?: string[];

  /**
   * Any additional information that you want to include in the notification email message.
   */
  additionalInformation?: string;
}

/**
 * Manual approval action.
 */
export class ManualApprovalAction extends actions.Action {
  /**
   * The SNS Topic passed when constructing the Action.
   * If no Topic was passed, but `notifyEmails` were provided,
   * a new Topic will be created.
   */
  private _notificationTopic?: sns.ITopic;
  private readonly props: ManualApprovalActionProps;

  constructor(name: string, props: ManualApprovalActionProps = {}) {
    super(name, {
      category: actions.ActionCategory.Approval,
      provider: 'Manual',
      artifactBounds: { minInputs: 0, maxInputs: 0, minOutputs: 0, maxOutputs: 0 },
      configuration: new cdk.Token(() => this.actionConfiguration()),
      ...props,
    });

    this.props = props;
  }

  public get notificationTopic(): sns.ITopic | undefined {
    return this._notificationTopic;
  }

  protected bind(pipeline: actions.IPipeline, parent: cdk.Construct): void {
    if (this.props.notificationTopic) {
      this._notificationTopic = this.props.notificationTopic;
    } else if ((this.props.notifyEmails || []).length > 0) {
      this._notificationTopic = new sns.Topic(parent, 'TopicResource');
    }

    if (this._notificationTopic) {
      this._notificationTopic.grantPublish(pipeline.role);
      for (const notifyEmail of this.props.notifyEmails || []) {
        this._notificationTopic.subscribeEmail(`Subscription-${notifyEmail}`, notifyEmail);
      }
    }
  }

  private actionConfiguration(): any {
    return this._notificationTopic
      ? {
        NotificationArn: this._notificationTopic.topicArn,
        CustomData: this.props.additionalInformation,
      }
      : undefined;
  }
}
