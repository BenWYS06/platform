// Checks contract files against their JSON Schema.
// Every problem is returned as a one-line message; nothing here throws for a bad file.

import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

export const CONTRACTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

// One entry per contract file: its schema and the field that names an entry.
export const CONTRACTS = {
  'error-codes': { file: 'error-codes.json', schema: 'error-codes.schema.json', key: 'code' },
};

const ajv = new Ajv({ allErrors: true });
const validators = new Map();

function validatorFor(name) {
  if (!validators.has(name)) {
    const schemaPath = join(CONTRACTS_DIR, 'schemas', CONTRACTS[name].schema);
    validators.set(name, ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8'))));
  }
  return validators.get(name);
}

// Reads a JSON file. Returns { data } or { problem }.
export function readContractFile(filePath) {
  const label = basename(filePath);
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (err) {
    return { problem: `${label}: cannot read the file (${err.code ?? err.message})` };
  }
  if (text.charCodeAt(0) === 0xfeff) {
    return { problem: `${label}: starts with a UTF-8 BOM; save it as UTF-8 without BOM` };
  }
  try {
    return { data: JSON.parse(text) };
  } catch (err) {
    return { problem: `${label}: not valid JSON (${err.message})` };
  }
}

function describeEntry(data, index, key) {
  const id = data?.[index]?.[key];
  return typeof id === 'string' ? `entry ${index} (${key} "${id}")` : `entry ${index}`;
}

function schemaProblems(label, data, errors, key) {
  return errors.map((err) => {
    const [, index, field] = err.instancePath.split('/');
    let where = index === undefined ? 'top level' : describeEntry(data, Number(index), key);
    if (field) where += `, field "${field}"`;
    let message = err.message;
    if (err.keyword === 'additionalProperties') {
      message = `has unknown field "${err.params.additionalProperty}"`;
    }
    return `${label}: ${where} ${message}`;
  });
}

// Checks one file against the named contract. Returns a list of problems; empty means valid.
export function checkContract(name, filePath) {
  const contract = CONTRACTS[name];
  if (!contract) return [`unknown contract "${name}"`];
  filePath ??= join(CONTRACTS_DIR, contract.file);
  const label = basename(filePath);

  const { data, problem } = readContractFile(filePath);
  if (problem) return [problem];

  const validate = validatorFor(name);
  if (!validate(data)) return schemaProblems(label, data, validate.errors, contract.key);
  return [];
}
