import path from 'path';
import readline from 'readline';
import ini from 'ini';
import {SETTINGS_FILE, AWS_CREDENTIALS_PATH, AWS_CONFIG_PATH} from './constants.js';
import {readFile, writeFile} from './file.js';
import {jsonStringify} from './transform.js';


export const settingsInput = [
  'profileName', // Name of local aws-cli profile, default lambdasync
  'lambdaName', // Name of lambda function on AWS
  'accessKey', // AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
  'secretKey', // AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  'region' // us-east-1
];

export const settingsFields = [
  'profileName',
  'lambdaName',
  'region'
];

const settingsPath = path.join(process.cwd(), SETTINGS_FILE);

export function getSettings() {
  return readFile(settingsPath, JSON.parse);
}

export function putSettings(settings) {
  return writeFile(
    settingsPath,
    filterSettings(settings, settingsFields),
    jsonStringify);
}

export function getAwsSettings() {
  return Promise.all([
    readFile(AWS_CREDENTIALS_PATH, ini.parse),
    readFile(AWS_CONFIG_PATH, ini.parse)
  ]);
}


export function filterSettings(obj, fields) {
  return Object.keys(obj)
    .filter(key => fields.indexOf(key) !== -1)
    .reduce((res, key) => (res[key] = obj[key], res), {});
}
