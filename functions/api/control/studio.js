import { json, readJson } from '../auth/_shared.js';
import { memberSession } from '../members/_shared.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const INTERNAL_ENVIRONMENTS = new Set(['development', 'dev', 'staging', 'preview', 'internal', 'test']);

async function access(request, env) {
  const session = await memberSession(request, env, { allowUnverified: true });
  if (session.response) return session;
  if (!session.account.roles.some((role) => CONTROL_ROLES.has(role))) {
    return { response: json({ error: 'studio_access_required' }, 403) };
  }
  return session;
}

function environmentName(env) {
  return String(env.VELVET_ENVIRONMENT || env.ENVIRONMENT || '').trim().toLowerCase();
}

function assertCaptureEnvironment(env) {
  const name = environmentName(env);
  if (!INTERNAL_ENVIRONMENTS.has(name) || String(env.VELVET_INTERNAL_TEST_AGENTS || '') !== 'enabled') {
    throw new Error('studio_capture_environment_disabled');
  }
  if (name === 'production') throw new Error('studio_capture_forbidden_in_production');
  return name;
}

function localPrompt(brief = {}) {
  const audience = String(brief.audience || 'membres et professionnels');
  const objective = String(brief.objective || 'présenter la valeur de Zwit');
  const feature = String(brief.feature || 'confiance, événements et expérience unifiée');
  const channel = String(brief.channel || 'Instagram');
  const format = String(brief.format || '9:16');
  const tone = String(brief.tone || 'premium');
  return {
    title: 'Zwit — Là où les plus belles rencontres commencent',
    hook: 'Le libertinage évolue. Zwit réunit enfin les personnes, les lieux et les expériences dans un même écosystème de confiance.',
    masterPrompt: [
      `Créer une publicité sociale ${format} pour ${channel}, destinée à ${audience}.`,
      `Objectif : ${objective}.`,
      `Mettre en avant : ${feature}.`,
      `Ton : ${tone}, cinématographique, élégant, humain, jamais vulgaire.`,
      'Montrer prioritairement la véritable interface Zwit : profils, recherche, carte, événements, messagerie, établissements et Zwit Pro.',
      'Respecter la palette Noir Zwit #0D0D0D, Bordeaux Zwit #641B36, Or Champagne #C6A96A et Blanc cassé #F4F4F2.',
      'Principes obligatoires : confiance avant les fonctionnalités, qualité plutôt que quantité, consentement intégré, discrétion et promesses vérifiables.',
      'Personnes fictives majeures uniquement. Aucun contenu explicite, aucune donnée réelle, aucun logo tiers, aucun texte déformé.',
      'Rythme fluide, transitions sobres, lumière chaude et premium, profondeur légère, sous-titres lisibles.',
      'Terminer sur le logo Zwit et la signature : Là où les plus belles rencontres commencent.'
    ].join(' '),
    negativePrompt: 'nudité, sexualité explicite, vulgarité, mineur, personne réelle identifiable, interface inventée, promesse non disponible, couleurs criardes, texte illisible, watermark, logo tiers',
    voiceOver: 'Pendant des années, les rencontres se sont limitées à des profils et des messages. Zwit réunit enfin les personnes, les établissements et les événements dans une expérience pensée autour de la confiance, de la discrétion et du consentement. Velvet. Là où les plus belles rencontres commencent.',
    scenes: [
      { seconds: '0–4', visual: 'Ruban bordeaux formant le V Zwit sur fond noir', message: 'Le libertinage évolue.' },
      { seconds: '4–12', visual: 'Capture réelle de la découverte et de la recherche membres', message: 'Des rencontres de qualité.' },
      { seconds: '12–20', visual: 'Carte, établissements et événements proches', message: 'Des lieux et des expériences.' },
      { seconds: '20–29', visual: 'Messagerie, albums privés et indice de confiance', message: 'La confiance intégrée.' },
      { seconds: '29–38', visual: 'Zwit Pro : événement, réservations et pilotage', message: 'Un écosystème complet.' },
      { seconds: '38–45', visual: 'Logo et signature officielle', message: 'Là où les plus belles rencontres commencent.' }
    ],
    provider: 'velvet-local-brand-engine'
  };
}

async function openAiPrompt(env, brief) {
  const key = String(env.OPENAI_API_KEY || '');
  if (!key) return null;
  const model = String(env.VELVET_STUDIO_TEXT_MODEL || 'gpt-5-mini');
  const instructions = `Tu es le directeur créatif de Zwit, réseau social premium français dédié aux rencontres libres. Réponds uniquement en JSON valide avec les clés title, hook, masterPrompt, negativePrompt, voiceOver, scenes. scenes est un tableau d'objets seconds, visual, message. Respecte impérativement confiance, consentement, discrétion, élégance, personnes fictives majeures, absence de contenu explicite et fidélité aux capacités réelles du produit.`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, instructions, input: JSON.stringify(brief), text: { format: { type: 'json_object' } } })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || 'studio_prompt_generation_failed');
  const text = payload?.output_text || payload?.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
  if (!text) throw new Error('studio_prompt_missing');
  return { ...JSON.parse(text), provider: model };
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  const session = await access(request, env);
  if (session.response) return session.response;
  try {
    const body = await readJson(request);
    if (body.action === 'generate_prompt') {
      const generated = await openAiPrompt(env, body.brief || {}).catch(() => null);
      return json({ prompt: generated || localPrompt(body.brief || {}), generative: Boolean(generated) });
    }
    if (body.action === 'capture_session') {
      const environment = assertCaptureEnvironment(env);
      const token = randomToken();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      return json({
        token,
        expiresAt,
        environment,
        syntheticOnly: true,
        url: `/membres/?velvet_capture=${encodeURIComponent(token)}`
      });
    }
    return json({ error: 'studio_action_unknown' }, 400);
  } catch (error) {
    return json({ error: error?.message || 'studio_request_failed' }, 400);
  }
}
