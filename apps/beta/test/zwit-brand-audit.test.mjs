import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import test from 'node:test';

const root = new URL('../../..', import.meta.url).pathname;
const webRoot = join(root, 'apps/beta/static');
const iosRoot = join(root, 'ios');
const readableExtensions = new Set(['.html', '.js', '.mjs', '.json', '.svg', '.md', '.swift', '.plist', '.strings', '.xcstrings']);
const excludedDirectories = new Set(['.git', 'node_modules', 'DerivedData', '.build']);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (excludedDirectories.has(entry)) continue;
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) files.push(...walk(path));
    else if (readableExtensions.has(extname(path))) files.push(path);
  }
  return files;
}

function literalValues(line) {
  const values = [];
  const quoted = /(["'`])((?:\\.|(?!\1).)*)\1/g;
  for (const match of line.matchAll(quoted)) values.push(match[2]);
  for (const match of line.matchAll(/<string>(.*?)<\/string>/g)) values.push(match[1]);
  for (const match of line.matchAll(/>([^<>]*\bvelvet\b[^<>]*)</gi)) values.push(match[1]);
  return values;
}

function isTechnical(value) {
  const text = String(value).trim();
  if (!text) return true;
  return [
    /^velvet:\/\//i,
    /^(?:group\.)?com\.velvet/i,
    /^VELVET_[A-Z0-9_]+$/,
    /^Velvet[A-Z][A-Za-z0-9_]*$/,
    /^velvet[A-Z][A-Za-z0-9_]*$/,
    /^velvet[._/-][A-Za-z0-9_./-]+$/i,
    /^\/[^\s]*velvet[^\s]*$/i,
    /\.(?:js|mjs|css|png|jpe?g|svg|swift|plist|entitlements|json)$/i,
    /^(?:bucket|table|storage|schema|key|kind|target|scheme):?\s*velvet/i
  ].some((pattern) => pattern.test(text));
}

function visibleVelvetFindings() {
  const findings = [];
  for (const file of [...walk(webRoot), ...walk(iosRoot)]) {
    const source = readFileSync(file, 'utf8');
    source.split(/\r?\n/).forEach((line, index) => {
      if (!/\bvelvet\b/i.test(line)) return;
      const literals = literalValues(line);
      for (const literal of literals) {
        if (!/\bvelvet\b/i.test(literal) || isTechnical(literal)) continue;
        findings.push({
          path: relative(root, file),
          line: index + 1,
          value: literal.trim().replace(/\s+/g, ' ').slice(0, 220)
        });
      }
    });
  }
  return findings;
}

test('la marque Web possède une source de vérité unique', () => {
  const brand = readFileSync(join(webRoot, 'assets/zwit-brand-system.js'), 'utf8');
  assert.match(brand, /name:\s*'ZWIT'/);
  assert.match(brand, /controlLabel:\s*'ZWIT CONTRÔLE'/);
  assert.match(brand, /memberLabel:\s*'ZWIT'/);
  assert.match(brand, /proLabel:\s*'ZWIT PRO'/);
  assert.match(brand, /logoTransparent:\s*fullLogo/);
  assert.match(brand, /splash:\s*fullLogo/);
  assert.match(brand, /email:\s*fullLogo/);
});

test('les scripts de marque et de conversation sont syntaxiquement valides', () => {
  for (const script of [
    'assets/zwit-brand-system.js',
    'assets/zwit-experience.js',
    'assets/zwit-experience-refinement.js',
    'assets/zwit-interaction-date-fix.js',
    'assets/velvet-production-surface.js'
  ]) {
    execFileSync(process.execPath, ['--check', join(webRoot, script)], { stdio: 'pipe' });
  }
});

test('la date de conversation disparaît automatiquement après deux secondes', () => {
  const web = readFileSync(join(webRoot, 'assets/zwit-interaction-date-fix.js'), 'utf8');
  const ios = readFileSync(join(iosRoot, 'Velvet/DesignSystem/AppleShellComponents.swift'), 'utf8');
  assert.match(web, /setTimeout\(\(\) => badge\.classList\.remove\('visible'\), 2000\)/);
  assert.match(ios, /deadline:\s*\.now\(\) \+ 2/);
});

test('aucune chaîne utilisateur des trois socles ne contient encore Velvet', () => {
  const findings = visibleVelvetFindings();
  if (findings.length) {
    console.error('\nOccurrences visibles restantes de Velvet :');
    findings.forEach((finding) => {
      console.error(`- ${finding.path}:${finding.line} → ${finding.value}`);
    });
  }
  assert.deepEqual(findings, []);
});

// Ce contrat est exécuté sur chaque PR pour empêcher toute régression de marque visible.
