import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTRACTS, CONTRACTS_DIR } from '../lib/check.mjs';

// Parsed copy of a real contract file, safe to change in a test.
export function loadReal(name) {
  return JSON.parse(readFileSync(join(CONTRACTS_DIR, CONTRACTS[name].file), 'utf8'));
}

// Writes text to a new temp folder under the contract's file name; returns the path.
export function writeTemp(name, text) {
  const dir = mkdtempSync(join(tmpdir(), 'openbox-contracts-'));
  const filePath = join(dir, CONTRACTS[name].file);
  writeFileSync(filePath, text, 'utf8');
  return filePath;
}

export function writeTempJson(name, data) {
  return writeTemp(name, JSON.stringify(data, null, 2));
}
