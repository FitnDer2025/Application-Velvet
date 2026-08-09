import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const runtimeRoots = [
  'apps/beta/static',
  'apps/beta/worker',
  'functions'
];
const runtimeFiles = [
  'apps/web/velvet-auth-beta-rc1.html',
  'apps/web/velvet-members-beta-live.html',
  'apps/web/velvet-pro-beta-rc1.html',
  'apps/web/velvet-control-intelligence-beta-final.html'
];
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '']);
const violations = [];
const warnings = [];

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await walk(child));
    else if (textExtensions.has(extname(entry.name))) files.push(child);
  }
  return files;
}

const files = [
  ...runtimeFiles.map((path) => join(root, path)),
  ...(await Promise.all(runtimeRoots.map((path) => walk(join(root, path))))).flat()
];

for (const path of [...new Set(files)]) {
  const name = relative(root, path);
  const source = await readFile(path, 'utf8');
  if (/['"]unsafe-eval['"]/.test(source)) violations.push(`${name}: CSP unsafe-eval interdite`);
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(source)) violations.push(`${name}: exécution dynamique interdite`);
  if (/images\.unsplash\.com/i.test(source)) violations.push(`${name}: dépendance image externe non maîtrisée`);
  if (/(?:SUPABASE_SERVICE_ROLE_KEY|CALLBACK_SECRET|DATABASE_URL)\s*[:=]\s*['"](?:eyJ|postgres(?:ql)?:\/\/|[A-Za-z0-9_-]{32,})/i.test(source)) {
    violations.push(`${name}: secret ou URL sensible potentiellement codé en dur`);
  }
  if (/['"]unsafe-inline['"]/.test(source)) warnings.push(`${name}: CSP unsafe-inline encore transitoire`);
}

if (violations.length) {
  console.error(`Échec du scan sécurité (${violations.length})\n- ${violations.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Scan sécurité réussi sur ${new Set(files).size} fichiers runtime.`);
}
if (warnings.length) console.log(`Avertissement suivi : ${[...new Set(warnings)].join(' ; ')}`);
