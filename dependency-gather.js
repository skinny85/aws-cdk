/* ******************************************* */
/* ***************** imports ***************** */
/* ******************************************* */

const fs = require('fs');
const path = require('path');

/* **************************************************** */
/* ***************** global variables ***************** */
/* **************************************************** */

let cdkPackages = 0;
let privatePackages = [];
let deprecatedPackages = [];
let unstablePackages = [];
let stablePackages = [];

/* **************************************** */
/* ***************** main ***************** */
/* **************************************** */

// in the first run, classify all packages
traverseDirectory('.', function (packageJson) {
    // console.log(`packageJsonPath: ${packageJsonPath}`);
    cdkPackages++;

    const packageName = packageJson.name;
    const classification = classifyCdkPackage(packageJson);
    let groupToUpdate;
    switch (classification) {
        case 'private': groupToUpdate = privatePackages; break;
        case 'deprecated': groupToUpdate = deprecatedPackages; break;
        case 'stable': groupToUpdate = stablePackages; break;
        case 'unstable': groupToUpdate = unstablePackages; break;
        default: console.log('❌  Failed to classify package: ' + packageJsonPath);
    }
    if (groupToUpdate) {
        groupToUpdate.push(packageName);
    }
});
console.log(`Found ${cdkPackages} CDK packages: ` +
    `${privatePackages.length} private, ${stablePackages.length} stable, ${unstablePackages.length} unstable, ${deprecatedPackages.length} deprecated`);

// in the second, analyze their dependencies
traverseDirectory('.', function (packageJson) {
    const packageName = packageJson.name;
    if (stablePackages.indexOf(packageName) === -1) {
        return;
    }
    for (dependency of Object.keys(packageJson.dependencies || {})) {
        if (unstablePackages.indexOf(dependency) !== -1) {
            console.log(`⚠️  Stable package '${packageName}' depends on unstable package '${dependency}'`);
        }
    }
    for (dependency of Object.keys(packageJson.devDependencies || {})) {
        if (unstablePackages.indexOf(dependency) !== -1) {
            console.log(`⚠️  Stable package '${packageName}' depends on unstable package '${dependency}'`);
        }
    }
});
traverseDirectory('.', function (packageJson) {
    const packageName = packageJson.name;
    if (unstablePackages.indexOf(packageName) === -1) {
        return;
    }
    for (dependency of Object.keys(packageJson.dependencies || {})) {
        if (unstablePackages.indexOf(dependency) !== -1) {
            console.log(`ℹ️️  Unstable package '${packageName}' depends on unstable package '${dependency}'`);
        }
    }
    for (dependency of Object.keys(packageJson.devDependencies || {})) {
        if (unstablePackages.indexOf(dependency) !== -1) {
            console.log(`ℹ️️  Unstable package '${packageName}' depends on unstable package '${dependency}'`);
        }
    }
});

/* **************************************************** */
/* ***************** helper functions ***************** */
/* **************************************************** */

function classifyCdkPackage(packageJson) {
    if (packageJson.private) {
        return "private";
    }
    if (packageJson.stability === 'deprecated') {
        return 'deprecated';
    }
    // a package is considered 'stable' if its stability is 'stable' or its maturity is 'cfn-only'
    if (packageJson.stability === 'stable' || packageJson.maturity === 'cfn-only') {
        return 'stable';
    }
    // a package is considered 'unstable' if its stability is 'experimental' or its maturity is 'developer-preview'
    if (packageJson.stability === 'experimental' || packageJson.maturity === 'developer-preview') {
        return 'unstable';
    }
    // all other cases are (deliberately) not classified
}

function traverseDirectory(rootDir, callback) {
    // don't recurse into node_modules - there's no point
    if (rootDir.endsWith('node_modules')) {
        return;
    }

    const packageJsonPath = path.resolve(path.join(rootDir, 'package.json'));
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = require(packageJsonPath);
        if (isCdkPackage(packageJson)) {
            callback(packageJson);
        }
    }

    // recurse
    const dirContents = fs.readdirSync(rootDir);
    for (fileOrDir of dirContents) {
        const fileOrDirPath = path.resolve(path.join(rootDir, fileOrDir));
        if (fs.statSync(fileOrDirPath).isDirectory()) {
            traverseDirectory(fileOrDirPath, callback);
        }
    }
}

function isCdkPackage(packageJson) {
    return packageJson.homepage === 'https://github.com/aws/aws-cdk';
}
