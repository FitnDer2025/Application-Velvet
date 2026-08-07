import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import test from 'node:test';

const root = new URL('../../..', import.meta.url).pathname;
const webRoot = join(root, 'apps/beta/static');
const iosRoot = join(root, 'ios');
const functionsRoot = join(root, 'functions');
const finalMigrations = [
  join(root, 'infra/supabase/migrations/0045_zwit_visible_brand_consistency.sql'),
  join(root, 'supabase/migrations/20260806230500_zwit_visible_brand_consistency.sql')
];
const readableExtensions = new Set(['.html', '.js', '.mjs', '.json', '.svg', '.md', '.swift', '.plist', '.strings', '.xcstrings']);
const excludedDirectories = new Set(['.git', 'node_modules', 'DerivedData', '.build']);

function walk(directory) {
  if (!existsSync(directory)) return [];
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

function stripTechnicalVelvet(value) {
  let text = String(value).replace(/\\"/g, '"').replace(/\\'/g, "'");
  text = text
    .replace(/velvet:\/\/[^\s"'<>]*/gi, '')
    .replace(/(?:group\.)?com\.velvet[a-z0-9._-]*/gi, '')
    .replace(/\bVELVET_[A-Z0-9_]+\b/g, '')
    .replace(/\bVelvet[A-Z][A-Za-z0-9_]*\b/g, '')
    .replace(/\bvelvet[A-Z][A-Za-z0-9_]*\b/g, '')
    .replace(/\b(?:public\.)?velvet_[a-z0-9_.-]+\b/gi, '')
    .replace(/\bdata-[a-z0-9_-]*velvet[a-z0-9_-]*\b/gi, '')
    .replace(/\.velvet-[a-z0-9_-]+\b/gi, '')
    .replace(/\b(?:class|id)=["'][^"']*\bvelvet-[a-z0-9_-]+[^"']*["']/gi, '')
    .replace(/\bVelvet\/[A-Za-z0-9_./+%-]+\b/g, '')
    .replace(/\/[^\s"'<>]*velvet[^\s"'<>]*/gi, '')
    .replace(/\bX-Velvet-[A-Za-z0-9_-]+\b/gi, '')
    .replace(/\bVelvet-iOS\/[A-Za-z0-9_.-]+\b/gi, '')
    .replace(/\bvelvet(?:-[a-z0-9_]+)+\b/gi, '')
    .replace(/\bvelvet\.[a-z0-9_.-]+\b/gi, '');
  return text;
}

function isTechnical(value) {
  const text = String(value).trim();
  if (!text) return true;
  if (text === 'velvet') return true;
  if (/^velvet-\\\([^)]*\)\.[a-z0-9]+$/i.test(text)) return true;
  if (/^Velvet-\\\(/.test(text)) return true;
  if (/\\s|\[\^/.test(text)) return true;
  return !/\bvelvet\b/i.test(stripTechnicalVelvet(text));
}

function visibleVelvetFindings() {
  const findings = [];
  const files = [
    ...walk(webRoot),
    ...walk(iosRoot),
    ...walk(functionsRoot)
  ];

  for (const file of files) {
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

test('iOS possède une source visible de marque unique', () => {
  const brand = readFileSync(join(iosRoot, 'Velvet/DesignSystem/ZwitBrand.swift'), 'utf8');
  assert.match(brand, /static let name = "ZWIT"/);
  assert.match(brand, /static let controlLabel = "ZWIT CONTRÔLE"/);
  assert.match(brand, /static let memberLabel = "ZWIT"/);
  assert.match(brand, /static let proLabel = "ZWIT PRO"/);
  assert.match(brand, /static let splashAsset = "ZwitOfficialLogo"/);
  assert.match(brand, /static let widgetAsset = "ZwitOfficialLogo"/);
});

test('Watch et widgets utilisent tous le logo officiel', () => {
  const watch = readFileSync(join(iosRoot, 'VelvetWatch/VelvetWatchApp.swift'), 'utf8');
  const watchWidget = readFileSync(join(iosRoot, 'VelvetWatchWidget/VelvetWatchWidget.swift'), 'utf8');
  const phoneWidget = readFileSync(join(iosRoot, 'VelvetWidget/VelvetNotificationWidget.swift'), 'utf8');
  assert.doesNotMatch(watch, /Text\("V"\)/);
  assert.doesNotMatch(watchWidget, /Text\("V"\)/);
  assert.match(watch, /Image\(ZwitWatchBrand\.logoAsset\)/);
  assert.match(watchWidget, /Image\(ZwitWatchWidgetBrand\.logoAsset\)/);
  assert.match(phoneWidget, /Image\(ZwitWidgetBrand\.logoAsset\)/);
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

test('la date de conversation reste permanente sur Web, Web mobile et iOS', () => {
  const web = readFileSync(join(webRoot, 'assets/zwit-interaction-date-fix.js'), 'utf8');
  const ios = readFileSync(join(iosRoot, 'Velvet/DesignSystem/AppleShellComponents.swift'), 'utf8');
  assert.match(web, /badge\.classList\.add\('visible'\)/);
  assert.doesNotMatch(web, /badge\.classList\.remove\('visible'\)/);
  assert.doesNotMatch(web, /dateTimer/);
  assert.doesNotMatch(ios, /hideWorkItem/);
  assert.doesNotMatch(ios, /deadline:\s*\.now\(\) \+ 2/);
  assert.match(ios, /guard visible else/);
});

test('le logo de connexion est compact et le kit marketing est réduit', () => {
  const brand = readFileSync(join(webRoot, 'assets/zwit-brand-system.js'), 'utf8');
  const marketing = readFileSync(join(webRoot, 'assets/zwit-marketing-compact.css'), 'utf8');
  const marketingPage = readFileSync(join(webRoot, 'marketing/acces-prive/index.html'), 'utf8');
  assert.match(brand, /\.vg-mark\{position:relative!important;width:68px!important;height:68px!important/);
  assert.match(brand, /\.vg-mark img\[data-zwit-canonical-logo="compact"\]/);
  assert.match(marketing, /\.vwa-topbar\{min-height:58px!important/);
  assert.match(marketing, /\.vwa-marketing-shell\{padding:28px 0 72px!important/);
  assert.match(marketingPage, /zwit-marketing-compact\.css\?v=20260806-10/);
});

test('les données persistantes finales réécrivent les contenus visibles en Zwit', () => {
  for (const migration of finalMigrations) {
    assert.ok(existsSync(migration), `migration absente: ${relative(root, migration)}`);
    const sql = readFileSync(migration, 'utf8');
    assert.match(sql, /Annonce du lancement Zwit/);
    assert.match(sql, /Zwit ouvre bientôt ses portes/);
    assert.match(sql, /Découvrir Zwit/);
  }
});

test('aucune chaîne utilisateur des trois socles ne contient encore Velvet', () => {
  const findings = visibleVelvetFindings();
  if (findings.length) {
    console.error('\nOccurrences visibles restantes de Velvet :');
    findings.forEach((finding) => {
      console.error(`error: brand_visible_finding ${finding.path}:${finding.line} → ${finding.value}`);
    });
  }
  assert.deepEqual(findings, []);
});

// Ce contrat bloque toute régression de marque visible sur Web, Web mobile, iOS et fonctions de communication.
