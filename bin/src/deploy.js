const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const {description} = require('../../package.json');
const {
  promisedExec,
  stripLambdaVersion,
  markdown,
  markdownProperty,
  functionExists
} = require('./util');
const {updateSettings} = require('./settings');
const {
  LAMBDASYNC_BIN,
  LAMBDASYNC_SRC,
  TARGET_ROOT,
  PROMPT_CONFIRM_OVERWRITE_FUNCTION
} = require('./constants.js');
const aws = require('./aws.js');

const targetOptions = {cwd: TARGET_ROOT};
let lambda;
let settings;

function deploy(deploySettings) {
  settings = deploySettings;
  const AWS = aws(settings);
  lambda = new AWS.Lambda();

  return functionExists(lambda, settings.lambdaName)
    .then(functionExists => {
      // If function doesn't already exist, or if it was already deployed
      // by lambdasync lets just deploy it
      if (!functionExists) {
        return doDeploy('new');
      }
      if (settings.lambdaArn) {
        return doDeploy('update');
      }
      // Otherwise if first deploy of existing function let's ask to make sure
      return inquirer.prompt([PROMPT_CONFIRM_OVERWRITE_FUNCTION])
        .then(function (result) {
          if (result.confirm) {
            return doDeploy('update');
          }
          console.log('You answered no, aborting deploy');
        });
    });
}

function doDeploy(type) {
  const deployFunc = type === 'new' ? createFunction : updateFunctionCode;
  return zip()
    .then(deployFunc)
    .then(handleSuccess)
    .catch(err => {
      console.log('No config found, first run: lambdasync init');
      console.error(err);
      return err;
    });
}

function handleSuccess(result) {
  promisedExec(LAMBDASYNC_BIN + '/rimraf deploy.zip', targetOptions);
  return updateSettings({
    lambdaArn: stripLambdaVersion(result.FunctionArn),
    lambdaRole: result.Role
  })
    .then(settings => {
      let template = fs.readFileSync(path.join(LAMBDASYNC_SRC, 'markdown', 'function-success.md'), 'utf8');
      template += markdownProperty({
        key: 'apiGatewayUrl',
        label: 'API URL'
      }, settings);
      console.log(markdown({
        templateString: template,
        data: settings
      }));
      return settings;
    });
}

function zip() {
  return promisedExec(LAMBDASYNC_BIN + '/bestzip ./deploy.zip ./*', targetOptions);
}

function updateFunctionCode() {
  return new Promise((resolve, reject) => {
    lambda.updateFunctionCode({
      FunctionName: settings.lambdaName,
      Publish: true,
      ZipFile: fs.readFileSync('./deploy.zip')
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

function createFunction() {
  return new Promise((resolve, reject) => {
    lambda.createFunction({
      Code: {
        ZipFile: fs.readFileSync('./deploy.zip')
      },
      FunctionName: settings.lambdaName,
      Handler: 'index.handler',
      Role: settings.lambdaRole,
      Runtime: 'nodejs6.10', /* required */
      Description: description, // package.json description
      MemorySize: 128, // default
      Publish: true,
      Timeout: 3
    }, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

module.exports = deploy;
