import * as core from '@aws-cdk/core';
import * as jsii_spec from '@jsii/spec';
import * as fs from 'fs-extra';
import * as jsii_reflect from 'jsii-reflect';
import * as path from 'path';

/* eslint-disable @typescript-eslint/no-require-imports */

export class CdkInclude {
  public static async includeJsonTemplate(scope: core.Construct, filePath: string): Promise<void> {
    // load all of the JSII types
    const typeSystem = new jsii_reflect.TypeSystem();
    const packageJson = require('../package.json');

    const loadPromises = [];
    for (const depName of Object.keys(packageJson.dependencies || {})) {
      const jsiiModuleDir = path.dirname(require.resolve(`${depName}/package.json`));
      if (!fs.existsSync(path.resolve(jsiiModuleDir, '.jsii'))) {
        continue;
      }
      loadPromises.push(typeSystem.load(jsiiModuleDir, { validate: true }));
    }
    await Promise.all(loadPromises);

    // create a map of CloudFormation type to their L1 class
    const cfnType2L1Class: { [type: string]: any } = {};
    const cfnResourceClass = typeSystem.findClass('@aws-cdk/core.CfnResource');
    for (const classs of typeSystem.classes) {
      if (classs.extends(cfnResourceClass)) {
        if (jsii_spec.isClassType(classs.spec)) {
          const properties = classs.spec.properties;
          const cfnResourceTypeNameProp = (properties || []).find(p => p.name === 'CFN_RESOURCE_TYPE_NAME');
          if (cfnResourceTypeNameProp) {
            const [moduleName, ...className] = classs.fqn.split('.');
            const module = require(moduleName);
            const jsClassFromModule = module[className.join('.')];
            cfnType2L1Class[jsClassFromModule.CFN_RESOURCE_TYPE_NAME] = jsClassFromModule;
          }
        }
      }
    }

    const template = fs.readJsonSync(filePath);
    for (const [logicalId, resourceConfig] of Object.entries(template.Resources || {})) {
      const l1Class = cfnType2L1Class[(resourceConfig as any).Type];
      if (l1Class) {
        new l1Class(scope, logicalId);
      }
    }
  }
}
