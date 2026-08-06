import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'docs', '04-OPERATIONS', 'ZWIT-REBRAND-REPORT.md');

const ignoredDirectories = new Set([
  '.git', 'node_modules', '.wrangler', 'dist', 'build', 'coverage', '.next', '.cache',
]);

const ignoredPathFragments = [
  `${path.sep}.github${path.sep}`,
  `${path.sep}infra${path.sep}supabase${path.sep}migrations${path.sep}`,
  `${path.sep}supabase${path.sep}migrations${path.sep}`,
  `${path.sep}scripts${path.sep}zwit-rebrand.mjs`,
  `${path.sep}apps${path.sep}beta${path.sep}test${path.sep}zwit-brand-inventory.test.mjs`,
];

const protectedBasenames = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'Podfile.lock',
]);

const textExtensions = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.json', '.jsonc', '.webmanifest', '.md', '.txt', '.xml', '.plist', '.swift',
  '.yml', '.yaml', '.svg', '.strings', '.xcconfig',
]);

const technicalExtensions = new Set(['.pbxproj', '.entitlements']);
const brandAssetPattern = /(velvet.*(?:logo|icon)|(?:logo|icon).*velvet)\.svg$/i;

function isIgnored(filePath) {
  return ignoredPathFragments.some((fragment) => filePath.includes(fragment))
    || protectedBasenames.has(path.basename(filePath))
    || technicalExtensions.has(path.extname(filePath).toLowerCase())
    || /(^|[/\\])\.env(?:\.|$)/.test(filePath)
    || /wrangler(?:\.[^.]+)?\.(?:toml|jsonc?)$/i.test(filePath);
}

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute, files);
      continue;
    }
    if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function replaceVisibleBrand(content) {
  // A technical separator next to the name protects repository names, URLs,
  // namespaces and identifiers. Spaces and punctuation remain replaceable.
  return content
    .replace(/(?<![A-Za-z0-9_./:@-])VELVET(?![A-Za-z0-9_./:@-])/g, 'ZWIT')
    .replace(/(?<![A-Za-z0-9_./:@-])Velvet(?![A-Za-z0-9_./:@-])/g, 'Zwit');
}

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
  <title id="title">Zwit</title>
  <desc id="desc">Monogramme Z premium en ruban</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#19171a"/>
      <stop offset="1" stop-color="#0d0c0e"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1d8aa"/>
      <stop offset="0.46" stop-color="#c8975b"/>
      <stop offset="1" stop-color="#7d1834"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity=".42"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="118" fill="url(#bg)"/>
  <path d="M126 132h270l-65 76H229l158 172H116l65-76h105L126 132Z" fill="url(#ribbon)" filter="url(#shadow)"/>
  <path d="M126 132h270l-65 76H229l-43-47h131l25-29H126Z" fill="#f7e5c2" opacity=".32"/>
  <circle cx="386" cy="112" r="10" fill="#7d1834"/>
</svg>\n`;

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 300" role="img" aria-labelledby="title desc">
  <title id="title">Zwit</title>
  <desc id="desc">Logo Zwit, identité premium et discrète</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#19171a"/>
      <stop offset="1" stop-color="#0d0c0e"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1d8aa"/>
      <stop offset="0.46" stop-color="#c8975b"/>
      <stop offset="1" stop-color="#7d1834"/>
    </linearGradient>
  </defs>
  <rect width="980" height="300" rx="72" fill="url(#bg)"/>
  <g transform="translate(58 42) scale(.42)">
    <path d="M126 132h270l-65 76H229l158 172H116l65-76h105L126 132Z" fill="url(#ribbon)"/>
    <circle cx="386" cy="112" r="10" fill="#7d1834"/>
  </g>
  <text x="310" y="176" fill="#f4ede4" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="128" font-weight="600" letter-spacing="22">ZWIT</text>
  <text x="317" y="225" fill="#c8975b" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="25" font-weight="500" letter-spacing="10">CHUT.</text>
</svg>\n`;

const files = await walk(ROOT);
const changedFiles = [];
const protectedReferences = [];
const brandAssets = [];
const binaryBrandCandidates = [];

for (const absolute of files) {
  const relative = path.relative(ROOT, absolute);
  const extension = path.extname(absolute).toLowerCase();
  const basename = path.basename(absolute);

  if (/velvet|logo|icon|appicon|favicon/i.test(relative)) {
    if (textExtensions.has(extension)) brandAssets.push(relative);
    else if (/\.(png|jpe?g|webp|ico|pdf)$/i.test(extension)) binaryBrandCandidates.push(relative);
  }

  if (isIgnored(absolute) || !textExtensions.has(extension)) continue;
  if ((await stat(absolute)).size > 1_500_000) continue;

  const before = await readFile(absolute, 'utf8');
  const after = replaceVisibleBrand(before);
  if (after !== before) {
    await writeFile(absolute, after, 'utf8');
    changedFiles.push(relative);
  }

  const protectedMatches = after.match(/[A-Za-z0-9_./:@-]*Velvet[A-Za-z0-9_./:@-]*|[A-Za-z0-9_./:@-]*VELVET[A-Za-z0-9_./:@-]*/g) || [];
  for (const match of protectedMatches) {
    if (match !== 'Zwit' && match !== 'ZWIT') protectedReferences.push(`${relative}: ${match}`);
  }

  if (brandAssetPattern.test(basename)) {
    await writeFile(absolute, iconSvg, 'utf8');
    if (!changedFiles.includes(relative)) changedFiles.push(relative);
  }
}

const assetDirectory = path.join(ROOT, 'apps', 'beta', 'static', 'assets');
await mkdir(assetDirectory, { recursive: true });
await writeFile(path.join(assetDirectory, 'zwit-icon.svg'), iconSvg, 'utf8');
await writeFile(path.join(assetDirectory, 'zwit-logo.svg'), logoSvg, 'utf8');
changedFiles.push(
  path.relative(ROOT, path.join(assetDirectory, 'zwit-icon.svg')),
  path.relative(ROOT, path.join(assetDirectory, 'zwit-logo.svg')),
);

const unique = (values) => [...new Set(values)].sort();
await mkdir(path.dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, `# Rapport de rebranding Zwit\n\nGénéré automatiquement le ${new Date().toISOString()}.\n\n## Fichiers textuels modifiés (${unique(changedFiles).length})\n\n${unique(changedFiles).map((item) => `- \`${item}\``).join('\n') || '- Aucun'}\n\n## Références techniques protégées\n\nCes références n’ont volontairement pas été renommées.\n\n${unique(protectedReferences).slice(0, 500).map((item) => `- \`${item.replaceAll('`', '\\`')}\``).join('\n') || '- Aucune'}\n\n## Assets de marque repérés\n\n${unique(brandAssets).map((item) => `- \`${item}\``).join('\n') || '- Aucun'}\n\n## Assets binaires à contrôler visuellement\n\n${unique(binaryBrandCandidates).map((item) => `- \`${item}\``).join('\n') || '- Aucun'}\n`, 'utf8');

console.log(`Zwit rebrand: ${unique(changedFiles).length} fichiers modifiés.`);
console.log(`Rapport: ${path.relative(ROOT, REPORT_PATH)}`);
