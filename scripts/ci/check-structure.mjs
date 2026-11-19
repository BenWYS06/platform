// Job: CI check (d). Node services keep the feature layout of D-012: no layer folders
// (src/routes, src/services, src/repositories, src/models), and every file under
// src/modules/ is index.ts or <name>.<role>.ts (tests: <name>.<role>.test.ts).
// Usage: node scripts/ci/check-structure.mjs [repo root]   (default: current folder)
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles, report } from './files.mjs';

const root = process.argv[2] ?? process.cwd();
const LAYER_DIRS = ['routes', 'services', 'repositories', 'models'];
const MODULE_FILE = /^(index|[a-z][A-Za-z0-9]*\.(routes|service|repository|model|middleware|scripts|util)(\.test)?)\.ts$/;

const servicesDir = join(root, 'apps', 'server');
const nodeServices = existsSync(servicesDir)
  ? readdirSync(servicesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(servicesDir, e.name, 'package.json')))
      .map((e) => e.name)
  : [];

const problems = [];
for (const name of nodeServices) {
  const src = `apps/server/${name}/src`;
  for (const dir of LAYER_DIRS) {
    if (existsSync(join(root, src, dir))) problems.push(`${src}/${dir}: layer folder, use src/modules/<feature>/ (D-012)`);
  }
  for (const path of listFiles(root, [`${src}/modules`])) {
    const file = path.slice(path.lastIndexOf('/') + 1);
    if (!MODULE_FILE.test(file)) problems.push(`${path}: name is not <name>.<role>.ts (D-012)`);
  }
}

report('check-structure', problems, `${nodeServices.length} Node service(s) in the feature layout`);
