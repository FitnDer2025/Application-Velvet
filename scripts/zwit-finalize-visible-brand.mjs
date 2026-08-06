import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SELF = 'scripts/zwit-finalize-visible-brand.mjs';
const excludedPrefixes = [
  '.git/',
  'node_modules/',
  'infra/supabase/migrations/',
  'supabase/migrations/'
];
const textExtensions = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.svg',
  '.md', '.json', '.yaml', '.yml', '.swift', '.plist', '.xml', '.txt'
]);

const replacements = [
  ['Vidéos sociales Velvet', 'Vidéos sociales Zwit'],
  ['Velvet Marketing Membre', 'Zwit Marketing Membre'],
  ['Velvet Marketing Pro', 'Zwit Marketing Pro'],
  ['VELVET PRO · CONCENTRATEUR MARKETING', 'ZWIT PRO · CONCENTRATEUR MARKETING'],
  ['VELVET PRO', 'ZWIT PRO'],
  ['Velvet Membres', 'Zwit Membres'],
  ['Velvet Contrôle', 'Zwit Contrôle'],
  ['Velvet Control', 'Zwit Control'],
  ['Velvet IA', 'Zwit IA'],
  ['Continuer sur Velvet', 'Continuer sur Zwit'],
  ['Velvet n’ajoute aucune envie ni expérience que tu n’as pas déclarée', 'Zwit n’ajoute aucune envie ni expérience que tu n’as pas déclarée'],
  ['Le début de son histoire Velvet', 'Le début de son histoire Zwit'],
  ['Les professionnels au cœur de Velvet.', 'Les professionnels au cœur de Zwit.'],
  ['Ce qui doit rester reconnaissable comme Velvet.', 'Ce qui doit rester reconnaissable comme Zwit.'],
  ['Découvrez la soirée et réservez votre place sur Velvet.', 'Découvrez la soirée et réservez votre place sur Zwit.'],
  ['grâce à Velvet.', 'grâce à Zwit.'],
  ['rejoindre Velvet.', 'rejoindre Zwit.'],
  ['J’accepte les conditions d’utilisation de Velvet.', 'J’accepte les conditions d’utilisation de Zwit.'],
  ['les quatre univers Velvet', 'les quatre univers Zwit'],
  ['une invitation Velvet', 'une invitation Zwit'],
  ['Contacte l’équipe Velvet.', 'Contacte l’équipe Zwit.'],
  ['contacte l’équipe Velvet.', 'contacte l’équipe Zwit.'],
  ['sécuriser ton accès Velvet.', 'sécuriser ton accès Zwit.'],
  ['Crée d’abord ton profil Velvet.', 'Crée d’abord ton profil Zwit.'],
  ['La réaction n’a pas pu être confirmée dans la mémoire Velvet.', 'La réaction n’a pas pu être confirmée dans la mémoire Zwit.'],
  ['La recherche n’a pas pu être enregistrée dans Velvet.', 'La recherche n’a pas pu être enregistrée dans Zwit.'],
  ['avant d’accéder à Velvet.', 'avant d’accéder à Zwit.'],
  ['Réessaie ou contacte l’équipe Velvet.', 'Réessaie ou contacte l’équipe Zwit.'],
  ["title: 'Zwit Membre', icon: 'V'", "title: 'Zwit Membre', icon: 'Z'"],
  ['<i>V</i><div><b>Promouvoir Zwit Membre', '<i>Z</i><div><b>Promouvoir Zwit Membre'],
  ['<span>V</span><b>ZWIT', '<span>Z</span><b>ZWIT'],
  ['BuildableName = \\"Zwit\\.app\\"', 'BuildableName = \\"Velvet\\.app\\"'],
  ['BuildableName = "Zwit\\.app"', 'BuildableName = "Velvet\\.app"']
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(ROOT, absolute).replaceAll('\\', '/');
    if (excludedPrefixes.some((prefix) => relative === prefix.slice(0, -1) || relative.startsWith(prefix))) continue;
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile() && relative !== SELF && textExtensions.has(path.extname(entry.name).toLowerCase())) files.push({ absolute, relative });
  }
  return files;
}

const changed = [];
for (const file of await walk(ROOT)) {
  const fileStat = await stat(file.absolute);
  if (fileStat.size > 5_000_000) continue;
  let source;
  try {
    source = await readFile(file.absolute, 'utf8');
  } catch {
    continue;
  }
  let next = source;
  for (const [before, after] of replacements) next = next.split(before).join(after);
  if (next !== source) {
    await writeFile(file.absolute, next, 'utf8');
    changed.push(file.relative);
  }
}

console.log(`Passe finale Zwit : ${changed.length} fichiers corrigés.`);
for (const file of changed) console.log(`- ${file}`);
