import * as core from '@aws-cdk/core';
import * as fs from 'fs-extra';
import * as path from 'path';

/* eslint-disable @typescript-eslint/no-require-imports */

export class CdkInclude {
  public static includeJsonTemplate(scope: core.Construct, filePath: string): void {
    // read the map of CloudFormation type to their L1 class created by the build script
    const cfnType2L1Class = fs.readJsonSync(path.join(__dirname, '..', 'cfn-types-2-classes.json'));

    const template = fs.readJsonSync(filePath);
    for (const [logicalId, resourceConfig] of Object.entries(template.Resources || {})) {
      const l1ClassFqn = cfnType2L1Class[(resourceConfig as any).Type];
      if (l1ClassFqn) {
        const [moduleName, ...className] = l1ClassFqn.split('.');
        const module = require(moduleName);
        const jsClassFromModule = module[className.join('.')];
        new jsClassFromModule(scope, logicalId);
      }
    }
  }
}
