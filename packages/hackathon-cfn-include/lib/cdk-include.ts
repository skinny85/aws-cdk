import * as core from '@aws-cdk/core';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ICfnTemplate } from './cfn-template';

/* eslint-disable @typescript-eslint/no-require-imports */

export class CdkInclude {
  public static includeJsonTemplate(scope: core.Construct, filePath: string): ICfnTemplate {
    const resources: { [logicalId: string]: core.CfnResource } = {};

    // read the map of CloudFormation type to their L1 class created by the build script
    const cfnType2L1Class = fs.readJsonSync(path.join(__dirname, '..', 'cfn-types-2-classes.json'));

    const template = fs.readJsonSync(filePath);
    for (const [logicalId, resourceConfig] of Object.entries(template.Resources || {})) {
      const l1ClassFqn = cfnType2L1Class[(resourceConfig as any).Type];
      if (l1ClassFqn) {
        const [moduleName, ...className] = l1ClassFqn.split('.');
        const module = require(moduleName);
        const jsClassFromModule = module[className.join('.')];
        resources[logicalId] = new jsClassFromModule(scope, logicalId);
      }
    }

    return new CfnTemplate(resources);
  }
}

class CfnTemplate implements ICfnTemplate {
  constructor(private readonly resources: { [logicalId: string]: core.CfnResource }) {
  }

  public getResource(logicalId: string): core.CfnResource {
    const ret = this.resources[logicalId];
    if (!ret) {
      throw new Error(`Resource with logical ID '${logicalId}' was found in the template`);
    }
    return ret;
  }
}
