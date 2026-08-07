#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://api.openai.com/v1';
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('OPENAI_API_KEY manquante. Définis-la côté serveur avant de lancer la génération.');
  process.exit(1);
}

const args = process.argv.slice(2);
const configPath = args[0] ?? './prompts/velvet-manifeste.json';
const outputDir = args[1] ?? './output';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createVideoJob(scene) {
  const form = new FormData();
  form.append('model', scene.model ?? 'sora-2-pro');
  form.append('prompt', scene.prompt);
  form.append('seconds', String(scene.seconds ?? 8));
  form.append('size', scene.size ?? '720x1280');

  if (scene.input_reference) {
    const bytes = await fs.readFile(scene.input_reference);
    const blob = new Blob([bytes]);
    form.append('input_reference', blob, path.basename(scene.input_reference));
  }

  const response = await fetch(`${API_BASE}/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Création vidéo impossible (${response.status}) : ${await response.text()}`);
  }

  return response.json();
}

async function waitForCompletion(videoId) {
  while (true) {
    const response = await fetch(`${API_BASE}/videos/${videoId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Lecture du job impossible (${response.status}) : ${await response.text()}`);
    }

    const job = await response.json();
    console.log(`[${videoId}] ${job.status} ${job.progress ?? 0}%`);

    if (job.status === 'completed') return job;
    if (job.status === 'failed') {
      throw new Error(`Génération échouée : ${job.error?.message ?? 'erreur inconnue'}`);
    }

    await sleep(10_000);
  }
}

async function downloadVideo(videoId, filePath) {
  const response = await fetch(`${API_BASE}/videos/${videoId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Téléchargement impossible (${response.status}) : ${await response.text()}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, bytes);
}

async function main() {
  const raw = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(raw);
  const scenes = config.scenes ?? [];

  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('Le fichier de configuration ne contient aucune scène.');
  }

  await fs.mkdir(outputDir, { recursive: true });

  for (const [index, scene] of scenes.entries()) {
    const safeName = scene.id ?? `scene-${String(index + 1).padStart(2, '0')}`;
    console.log(`\nCréation de ${safeName}...`);
    const job = await createVideoJob(scene);
    const completed = await waitForCompletion(job.id);
    const target = path.join(outputDir, `${safeName}.mp4`);
    await downloadVideo(completed.id, target);
    console.log(`Fichier généré : ${target}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
