/**
 * Parser for the artifact environment field.
 *
 * Account validation is relaxed to allow account aliasing in the future.
 */
const AWS_ENV_REGEX = /aws\:\/\/([a-z0-9A-Z\-\@\.\_]+)\/([a-z\-0-9]+)/;

/**
 * Models an AWS execution environment, for use within the CDK toolkit.
 */
export interface Environment {
  /** The arbitrary name of this environment (user-set, or at least user-meaningful) */
  readonly name: string;

  /** The AWS account this environment deploys into */
  readonly account: string;

  /** The AWS region name where this environment deploys into */
  readonly region: string;

  /**
   * The IAM role to assume before performing SDK calls to deploy the stack this environment belongs to
   * (like CreateChangeSet).
   *
   * @default - no role will be assumed - the default credentials of the CLI will be used
   */
  readonly assumeRole?: string;

  /**
   * The IAM role to pass to CloudFormation to actually perform the deployment of the stack this environment belongs to.
   * Since this is usually a role with very wide permissions
   * (most likely, AdministratorAccess),
   * it's usually only assumable by the CloudFormation service principal.
   * This role can be overridden from the CLI by providing the --role-arn option.
   *
   * @default - no role will be passed to CloudFormation - the default CLI credentials, or the --role-arn, will be used
   */
  readonly passRole?: string;
}

export const UNKNOWN_ACCOUNT = 'unknown-account';
export const UNKNOWN_REGION = 'unknown-region';

export class EnvironmentUtils {
  public static parse(environment: string, assumeRole?: string, passRole?: string): Environment {
    const env = AWS_ENV_REGEX.exec(environment);
    if (!env) {
      throw new Error(
        `Unable to parse environment specification "${environment}". ` +
        `Expected format: aws://account/region`);
    }

    const [ , account, region ] = env;
    if (!account || !region) {
      throw new Error(`Invalid environment specification: ${environment}`);
    }

    return { account, region, name: environment, assumeRole, passRole };
  }

  public static format(account: string, region: string): string {
    return `aws://${account}/${region}`;
  }
}
