// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@tailwindcss/node';
import { describe, expect, it } from 'vitest';

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/styles');

// Compile the app stylesheet the way the Vite plugin does, for the given class names.
async function cssFor(candidates: string[]): Promise<string> {
  const source = readFileSync(resolve(stylesDir, 'main.css'), 'utf8');
  const compiler = await compile(source, { base: stylesDir, onDependency: () => {} });
  return compiler.build(candidates);
}

describe('token theme', () => {
  it('turns a token class into CSS', async () => {
    const css = await cssFor(['bg-surface', 'text-on-surface']);
    expect(css).toContain('.bg-surface');
    expect(css).toContain('var(--color-surface)');
  });

  it('has no default palette: bg-blue-500 makes no CSS', async () => {
    const css = await cssFor(['bg-blue-500', 'text-red-600']);
    expect(css).not.toContain('.bg-blue-500');
    expect(css).not.toContain('.text-red-600');
    expect(css).not.toContain('--color-blue-500');
  });

  it('switches token colors for a dark system theme', async () => {
    const css = await cssFor(['bg-surface']);
    expect(css).toMatch(/prefers-color-scheme: ?dark/);
  });
});
