// Job: list repo files for the CI check scripts, skipping build output and installed packages.
import { readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', 'target', 'dist', 'build', 'coverage', '.gradle', '.git']);

// Files under root/<dir> for each dir that exists, as paths relative to root with '/'.
export function listFiles(root, dirs) {
  const out = [];
  const walk = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const path = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path);
      } else if (entry.isFile()) {
        out.push(relative(root, path).split(sep).join('/'));
      }
    }
  };
  for (const dir of dirs) {
    const abs = join(root, dir);
    if (existsSync(abs)) walk(abs);
  }
  return out.sort();
}

// True for test code: test folders and *.test.* / *Test.java style names.
export function isTestFile(path) {
  return (
    /(^|\/)(test|tests|__tests__|src\/test)\//.test(path) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /Tests?\.(java|kt)$/.test(path)
  );
}

// Print the problems and exit 1, or print the success line.
export function report(name, problems, okMessage) {
  if (problems.length > 0) {
    console.error(`${name}: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`${name}: ${okMessage}`);
}
