import * as core from '@aws-cdk/core';
import * as codemaker from 'codemaker';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ICfnTemplate } from './cfn-template';

/* eslint-disable @typescript-eslint/no-require-imports */

export class CdkInclude {
  public static includeJsonTemplate(scope: core.Construct, filePath: string): ICfnTemplate {
    // read the map of CloudFormation type to their L1 class created by the build script
    const cfnType2L1Class = fs.readJsonSync(path.join(__dirname, '..', 'cfn-types-2-classes.json'));

    // read the template into a JS object
    const template = fs.readJsonSync(filePath);

    return new CfnTemplate(scope, cfnType2L1Class, template);
  }
}

class CfnTemplate implements ICfnTemplate {
  private readonly resources: { [logicalId: string]: core.CfnResource } = {};

  constructor(private readonly scope: core.Construct,
              private readonly cfnType2L1Class: any,
              private readonly template: any) {
    for (const logicalId of Object.keys(template.Resources || {})) {
      this.getOrCreateResource(logicalId);
    }
  }

  public getResource(logicalId: string): core.CfnResource {
    const ret = this.resources[logicalId];
    if (!ret) {
      throw new Error(`Resource with logical ID '${logicalId}' was not found in the template`);
    }
    return ret;
  }

  private getOrCreateResource(logicalId: string): core.CfnResource {
    const ret = this.resources[logicalId];
    if (ret) {
      return ret;
    }
    const resourceConfig: any = this.template.Resources[logicalId];
    // parse the L1
    const l1ClassFqn = this.cfnType2L1Class[resourceConfig.Type];
    if (l1ClassFqn) {
      const [moduleName, ...className] = l1ClassFqn.split('.');
      const module = require(moduleName);
      const jsClassFromModule = module[className.join('.')];
      const l1Instance = new jsClassFromModule(this.scope, logicalId,
        this.template2JsValue(resourceConfig.Properties, true));
      this.resources[logicalId] = l1Instance;

      // handle all non-property configuration
      // (retention policies, conditions, metadata, etc.)
      const cfnOptions: core.ICfnResourceOptions = l1Instance.cfnOptions;
      cfnOptions.deletionPolicy = toCfnDeletionPolicy(resourceConfig.DeletionPolicy);
      cfnOptions.updateReplacePolicy = toCfnDeletionPolicy(resourceConfig.UpdateReplacePolicy);
      // ToDo handle:
      // 1. Condition
      // 2. Metadata
      // 3. CreationPolicy
      // 4. UpdatePolicy

      return l1Instance;
    } else {
      throw new Error(`Unrecognized CFN type: '${resourceConfig.Type}'`);
    }
  }

  private template2JsValue(value: any, normalizeKeys: boolean): any {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(el => this.template2JsValue(el, normalizeKeys));
    }
    if (typeof value === 'object') {
      // An object can be one of 3 things:
      // 1. A CFN intrinsic - in this case, turn it into a tokenized string
      // 2. A complex property value - in that case, simply turn it into an object (recursively),
      //   normalizing the property names to fit our L1s
      // 3. An arbitrary JSON value - in this case, turn it into an object _without_ normalizing the property names.
      //   The problem is, we don't have enough information currently to decisively
      //   distinguish between #2 and #3. We would probably need to consult the CFN schema to be sure.
      //   For the purposes of the hackathon, simply try to guess based on some popular properties with `any` type.
      //   ToDo this should probably be the first thing fixed after the hackathon
      const cfnIntrinsic = this.serializeIfCfnIntrinsic(value, normalizeKeys);
      if (cfnIntrinsic) {
        return cfnIntrinsic;
      }
      const ret: any = {};
      for (const [key, val] of Object.entries(value)) {
        ret[normalizeKeys ? normalizePropName(key) : key] = this.template2JsValue(val,
          normalizeKeys ? this.shouldNormalizeKey(key) : false);
      }
      return ret;
    }
  }

  private serializeIfCfnIntrinsic(object: any, normalizeKeys: boolean): any {
    const key = this.looksLikeCfnIntrinsic(object);
    switch (key) {
      case undefined:
        return undefined;
      case 'Ref':
        const specialCaseRefs = this.specialCaseRefs(object[key]);
        return specialCaseRefs
          ? specialCaseRefs
          : core.Fn.ref(object[key]);
      case 'Fn::GetAtt': {
        // Fn::GetAtt takes a 2-element list as its argument
        const value = object[key];
        const logicalId = value[0];
        const getAtt = core.Fn.getAtt(logicalId, value[1]);
        return new core.MagicResolvable(getAtt, this.getOrCreateResource(logicalId));
      }
      case 'Fn::Join': {
        // Fn::Join takes a 2-element list as its argument,
        // where the first element is the delimiter,
        // and the second is the list of elements to join
        const value = this.template2JsValue(object[key], normalizeKeys);
        return core.Fn.join(value[0], value[1]);
      }
    }
  }

  private looksLikeCfnIntrinsic(object: object): string | undefined {
    const objectKeys = Object.keys(object);
    // a CFN intrinsic is always an object with a single key
    if (objectKeys.length !== 1) {
      return undefined;
    }

    const key = objectKeys[0];
    return key === 'Ref' || key.startsWith('Fn::') ? key : undefined;
  }

  private specialCaseRefs(value: any): any {
    switch (value) {
      case 'AWS::AccountId': return core.Aws.ACCOUNT_ID;
      case 'AWS::Region': return core.Aws.REGION;
      case 'AWS::Partition': return core.Aws.PARTITION;
      case 'AWS::URLSuffix': return core.Aws.URL_SUFFIX;
      case 'AWS::NotificationARNs': return core.Aws.NOTIFICATION_ARNS;
      case 'AWS::StackId': return core.Aws.STACK_ID;
      case 'AWS::StackName': return core.Aws.STACK_NAME;
      case 'AWS::NoValue': return core.Aws.NO_VALUE;
      default: return undefined;
    }
  }

  private shouldNormalizeKey(key: string): boolean {
    switch (key) {
      case 'KeyPolicy':
      case 'PolicyDocument':
      case 'AssumeRolePolicyDocument':
        return false;
      default:
        return true;
    }
  }
}

function toCfnDeletionPolicy(policy: any): core.CfnDeletionPolicy | undefined {
  switch (policy) {
    case undefined: return undefined;
    case 'Delete': return core.CfnDeletionPolicy.DELETE;
    case 'Retain': return core.CfnDeletionPolicy.RETAIN;
    case 'Snapshot': return core.CfnDeletionPolicy.SNAPSHOT;
    default: throw new Error(`Unrecognized DeletionPolicy '${policy}'`);
  }
}

function normalizePropName(propName: string): string {
  return codemaker.toCamelCase(propName);
}
