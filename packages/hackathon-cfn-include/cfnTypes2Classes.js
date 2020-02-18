/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

// if the file already exists, skip
// (as this is quite a slow process)
if (fs.existsSync('./cfn-types-2-classes.json')) {
  process.exit(0);
}

// this file is a build tool - silence an ESLint warning
const jsii_reflect = require('jsii-reflect'); // eslint-disable-line import/no-extraneous-dependencies

const packageJson = require('./package.json');
const dependencies = packageJson.dependencies || {};

async function main() {
  const constructLibrariesRoot = path.resolve('..', '..', 'packages', '@aws-cdk');
  const constructLibrariesDirs = fs.readdirSync(constructLibrariesRoot);
  let errors = false;

  const typeSystem = new jsii_reflect.TypeSystem();
  const cfnType2L1Class = {};
  // load the @aws-cdk/core assembly first, to find the CfnResource class
  await typeSystem.load(path.resolve(constructLibrariesRoot, 'core'), { validate: false });
  const cfnResourceClass = typeSystem.findClass('@aws-cdk/core.CfnResource');

  for (const constructLibraryDir of constructLibrariesDirs) {
    const absConstructLibraryDir = path.resolve(constructLibrariesRoot, constructLibraryDir);
    const libraryPackageJson = require(path.join(absConstructLibraryDir, 'package.json'));

    // skip non-JSII modules
    // if (!libraryPackageJson.jsii) {
    // change the logic to check the existence of the .jsii file
    // ToDo this should probably be removed after the hackathon
    if (!fs.existsSync(path.resolve(absConstructLibraryDir, '.jsii'))) {
      continue;
    }

    const libraryDependencyVersion = dependencies[libraryPackageJson.name];
    const libraryVersion = `${libraryPackageJson.version}`;

    if (libraryPackageJson.deprecated) {
      if (libraryDependencyVersion) {
        console.error(`Incorrect dependency on deprecated package: ${libraryPackageJson.name}`);
        errors = true;
        delete dependencies[libraryPackageJson.name];
      }
      continue;
    }

    if (!libraryDependencyVersion) {
      console.error(`Missing dependency on package: ${libraryPackageJson.name}`);
      errors = true;
    } else if (libraryDependencyVersion !== libraryVersion) {
      console.error(`Incorrect dependency version for package ${libraryPackageJson.name}: expecting '${libraryVersion}', got: '${libraryDependencyVersion}'`);
      errors = true;
    }

    dependencies[libraryPackageJson.name] = libraryVersion;

    // we already loaded @aws-cdk/core above
    if (constructLibraryDir === 'core') {
      continue;
    }

    const assembly = await typeSystem.load(absConstructLibraryDir, { validate: false });
    for (let i = 0; i < assembly.classes.length; i++) {
      const classs = assembly.classes[i];
      if (classs.extends(cfnResourceClass)) {
        const properties = classs.spec.properties;
        const cfnResourceTypeNameProp = (properties || []).find(p => p.name === 'CFN_RESOURCE_TYPE_NAME');
        if (cfnResourceTypeNameProp) {
          const [moduleName, ...className] = classs.fqn.split('.');
          const module = require(moduleName);
          const jsClassFromModule = module[className.join('.')];
          cfnType2L1Class[jsClassFromModule.CFN_RESOURCE_TYPE_NAME] = classs.fqn;
        }
      }
    }
  }

  fs.writeFileSync(path.join(__dirname, 'cfn-types-2-classes.json'), JSON.stringify(cfnType2L1Class, undefined, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify(packageJson, undefined, 2) + '\n');

  if (errors) {
    console.error('errors found. updated package.json');
    process.exit(1);
  }
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
