import { json, supabase } from '../auth/_shared.js';
import {
  memberSession,
  restJson,
  withSession
} from './_shared.js';
import { signedMediaUrl } from './media.js';

const ALLOWED_TYPES = new Map([
  ['image/jpeg','jpg'],
  ['image/png','png'],
  ['image/webp','webp']
]);
const ROLES = new Set(['couple_gallery','individual_gallery','individual_portrait']);
const MAX_BYTES = 4 * 1024 * 1024;
export const DEFAULT_MEDIA_MODERATION_POLICY = Object.freeze({
  automationMode: 'active',
  publicAutoConfidence: 0.86,
  privateAutoConfidence: 0.86,
  migrationPending: true
});

async function ownedProfile(env, access) {
  const rows = await restJson(
    env,
    `/rest/v1/member_profiles?select=id,profile_type,admission_status,profile_members!inner(user_id,status),individual_profiles(id,linked_user_id,first_name)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
    access.session
  );
  return rows?.[0] || null;
}

function parseAiJson(value) {
  const text = String(value?.answer || value?.response || value || '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('ai_response_invalid');
  return JSON.parse(match[0]);
}

function imageDataUrl(bytes) {
  let mime = 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    mime = 'image/png';
  } else if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    mime = 'image/webp';
  }
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function boundedConfidence(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0.8 && parsed <= 0.98
    ? parsed
    : fallback;
}

export function normalizeMediaModerationPolicy(row = {}) {
  return {
    automationMode: row.automation_mode === 'observation' ? 'observation' : 'active',
    publicAutoConfidence: boundedConfidence(
      row.public_auto_confidence,
      DEFAULT_MEDIA_MODERATION_POLICY.publicAutoConfidence
    ),
    privateAutoConfidence: boundedConfidence(
      row.private_auto_confidence,
      DEFAULT_MEDIA_MODERATION_POLICY.privateAutoConfidence
    ),
    updatedAt: row.updated_at || null,
    migrationPending: false
  };
}

export async function mediaModerationPolicy(env, session) {
  try {
    const result = await restJson(
      env,
      '/rest/v1/rpc/current_media_moderation_policy',
      session,
      { method: 'POST', body: '{}' }
    );
    return normalizeMediaModerationPolicy(Array.isArray(result) ? result[0] : result);
  } catch {
    return { ...DEFAULT_MEDIA_MODERATION_POLICY };
  }
}

export function decidePublicMedia({ confidence, criteriaPassed }, policy = DEFAULT_MEDIA_MODERATION_POLICY) {
  if (policy.automationMode === 'observation') return 'review';
  if (confidence < policy.publicAutoConfidence) return 'review';
  return criteriaPassed ? 'approved' : 'rejected';
}

export function decidePrivateMedia({ confidence, prohibited, uncertain }, policy = DEFAULT_MEDIA_MODERATION_POLICY) {
  if (policy.automationMode === 'observation' || uncertain) return 'review';
  if (confidence < policy.privateAutoConfidence) return 'review';
  return prohibited ? 'rejected' : 'approved';
}

async function runVisionAssessment(env, bytes, question, maxTokens) {
  if (!env.AI) throw new Error('workers_ai_not_configured');
  return env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
    task: 'query',
    image: imageDataUrl(bytes),
    question,
    max_tokens: maxTokens,
    temperature: 0,
    stream: false
  });
}

function normalizeAssessment(raw, expectedPeople, policy) {
  const peopleCount = Math.max(0, Math.min(10, Number(raw.people_count) || 0));
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
  const assessment = {
    people_count: peopleCount,
    expected_people: expectedPeople,
    faces_visible: raw.faces_visible === true,
    half_body_visible_for_all: raw.half_body_visible_for_all === true,
    blur_excessive: raw.blur_excessive === true,
    public_safe: raw.public_safe === true,
    confidence,
    summary: String(raw.summary || '').slice(0, 500),
    model: '@cf/moondream/moondream3.1-9B-A2B',
    criteria_version: 'velvet-media-v2',
    moderation_scope: 'public_profile',
    biometric_recognition: false
  };
  const criteriaPassed = peopleCount === expectedPeople
    && assessment.faces_visible
    && assessment.half_body_visible_for_all
    && !assessment.blur_excessive
    && assessment.public_safe;
  const decision = decidePublicMedia({ confidence, criteriaPassed }, policy);
  assessment.policy_mode = policy.automationMode;
  assessment.policy_threshold = policy.publicAutoConfidence;
  assessment.automatic_decision = decision !== 'review';
  assessment.human_review_required = decision === 'review';
  return { assessment, decision };
}

async function analyzePhoto(env, bytes, expectedPeople, mediaRole, policy) {
  const prompt = `Analyse cette photo publique de profil Velvet. Ne reconnais et n'identifie jamais les personnes. Vérifie seulement :
- nombre exact de personnes clairement visibles : ${expectedPeople} ;
- visage visible pour chaque personne ;
- cadrage montrant au minimum la moitié du corps pour chaque personne ;
- absence de flou ou brouillage excessif ;
- contenu adapté à une galerie publique, sans nudité explicite ni acte sexuel.
Le rôle demandé est ${mediaRole}. Réponds uniquement en JSON :
{"people_count":0,"faces_visible":false,"half_body_visible_for_all":false,"blur_excessive":false,"public_safe":false,"confidence":0.0,"summary":"raison concise en français"}`;
  const result = await runVisionAssessment(env, bytes, prompt, 300);
  return normalizeAssessment(parseAiJson(result), expectedPeople, policy);
}

export async function analyzePublicAlbumPhoto(env, bytes, policy = DEFAULT_MEDIA_MODERATION_POLICY) {
  const result = await runVisionAssessment(env, bytes, `Analyse cette photo destinée à un album public Velvet. Ne reconnais et n'identifie jamais les personnes. Vérifie uniquement que l'image est suffisamment nette et qu'elle ne montre ni nudité explicite, ni acte sexuel, ni personne paraissant mineure. Réponds uniquement en JSON :
{"blur_excessive":false,"public_safe":false,"confidence":0.0,"summary":"raison concise en français"}`, 220);
  const raw = parseAiJson(result);
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
  const assessment = {
    blur_excessive: raw.blur_excessive === true,
    public_safe: raw.public_safe === true,
    confidence,
    summary: String(raw.summary || '').slice(0, 500),
    model: '@cf/moondream/moondream3.1-9B-A2B',
    criteria_version: 'velvet-media-v2',
    moderation_scope: 'public_album',
    biometric_recognition: false
  };
  const passed = !assessment.blur_excessive && assessment.public_safe;
  const decision = decidePublicMedia({ confidence, criteriaPassed: passed }, policy);
  assessment.policy_mode = policy.automationMode;
  assessment.policy_threshold = policy.publicAutoConfidence;
  assessment.automatic_decision = decision !== 'review';
  assessment.human_review_required = decision === 'review';
  return { assessment, decision };
}

export async function analyzePrivateAlbumPhoto(env, bytes, policy = DEFAULT_MEDIA_MODERATION_POLICY) {
  const result = await runVisionAssessment(env, bytes, `Analyse cette image d'album privé Zwit sans reconnaître ni identifier les personnes. La nudité adulte consensuelle n'est pas un motif de refus. Signale comme "prohibited" toute image montrant une personne pouvant être mineure, une violence manifeste, une contrainte apparente ou un contenu manifestement illégal. Si l'âge adulte ou la situation sont incertains, indique "uncertain": true. Réponds uniquement en JSON :
{"prohibited":false,"uncertain":false,"confidence":0.0,"summary":"raison concise en français"}`, 220);
  const raw = parseAiJson(result);
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
  const assessment = {
    prohibited: raw.prohibited === true,
    uncertain: raw.uncertain === true,
    confidence,
    summary: String(raw.summary || '').slice(0, 500),
    model: '@cf/moondream/moondream3.1-9B-A2B',
    criteria_version: 'velvet-media-v2',
    moderation_scope: 'private_album',
    private_album_safety_review: true,
    biometric_recognition: false
  };
  const decision = decidePrivateMedia({
    confidence,
    prohibited: assessment.prohibited,
    uncertain: assessment.uncertain
  }, policy);
  assessment.policy_mode = policy.automationMode;
  assessment.policy_threshold = policy.privateAutoConfidence;
  assessment.automatic_decision = decision !== 'review';
  assessment.human_review_required = decision === 'review';
  return { assessment, decision };
}

function hexToBytes(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex || '')) throw new Error('moderation_hmac_not_configured');
  return Uint8Array.from(hex.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
}

export async function signDecision(secretHex, mediaId, decision, signedAt) {
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(secretHex),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const message = new TextEncoder().encode(`${mediaId}|${decision}|${signedAt}`);
  const signature = await crypto.subtle.sign('HMAC', key, message);
  return [...new Uint8Array(signature)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function recordAiDecision(env, session, mediaId, analyzed) {
  const signedAt = Math.floor(Date.now() / 1000);
  const signature = await signDecision(
    String(env.PHOTO_MODERATION_HMAC_KEY || ''),
    mediaId,
    analyzed.decision,
    signedAt
  );
  return restJson(
    env,
    '/rest/v1/rpc/record_photo_ai_decision',
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        target_media_id: mediaId,
        decision: analyzed.decision,
        assessment: analyzed.assessment,
        signed_at: signedAt,
        signature
      })
    }
  );
}

export async function recordTechnicalReview(env, session, mediaId, error, scope) {
  const assessment = {
    summary: 'Analyse automatique indisponible ou indécise. Contrôle humain requis.',
    technical_error: String(error?.message || error || 'ai_review_unavailable').slice(0, 200),
    criteria_version: 'velvet-media-v2',
    moderation_scope: scope,
    automatic_decision: false,
    human_review_required: true,
    biometric_recognition: false
  };
  await recordAiDecision(env, session, mediaId, { decision: 'review', assessment });
  return assessment;
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const profile = await ownedProfile(env, access);
    if (!profile) return withSession({ profile: null, photos: [] }, access.session);
    const photos = await restJson(
      env,
      `/rest/v1/media_assets?select=id,profile_id,individual_profile_id,owner_user_id,media_role,is_primary,storage_path,moderation_status,ai_assessment,rejection_reason,created_at&profile_id=eq.${profile.id}&album_id=is.null&order=created_at.asc`,
      access.session
    );
    const enriched = await Promise.all(photos.map(async (photo) => ({
      ...photo,
      previewUrl: await signedMediaUrl(env, access.session, photo.storage_path)
    })));
    return withSession({ profile, photos: enriched }, access.session);
  } catch (error) {
    return json({ error: error.message || 'photos_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  let uploadedPath = null;
  let cleanupSession = null;
  let createdMediaId = null;
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    cleanupSession = access.session;
    const profile = await ownedProfile(env, access);
    if (!profile) return json({ error: 'profile_required' }, 409);

    const form = await request.formData();
    const file = form.get('photo');
    const mediaRole = String(form.get('mediaRole') || '');
    const individualProfileId = String(form.get('individualProfileId') || '');
    if (!(file instanceof File) || !ROLES.has(mediaRole)) {
      return json({ error: 'photo_and_role_required' }, 400);
    }
    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension || file.size < 20_000 || file.size > MAX_BYTES) {
      return json({ error: 'invalid_photo_file' }, 400);
    }
    const expectedGalleryRole = profile.profile_type === 'couple'
      ? 'couple_gallery'
      : 'individual_gallery';
    if (mediaRole === 'individual_portrait' && profile.profile_type !== 'couple') {
      return json({ error: 'invalid_photo_role' }, 400);
    }
    if (mediaRole !== 'individual_portrait' && mediaRole !== expectedGalleryRole) {
      return json({ error: 'invalid_photo_role' }, 400);
    }

    let portraitTarget = null;
    if (mediaRole === 'individual_portrait') {
      portraitTarget = profile.individual_profiles?.find(
        (person) => person.id === individualProfileId
          && person.linked_user_id === access.account.userId
      );
      if (!portraitTarget) return json({ error: 'personal_photo_owner_required' }, 403);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const objectId = crypto.randomUUID();
    uploadedPath = `${profile.id}/${access.account.userId}/${objectId}.${extension}`;
    const upload = await supabase(
      env,
      `/storage/v1/object/velvet-media/${uploadedPath}`,
      {
        method: 'POST',
        headers: {
          'content-type': file.type,
          'x-upsert': 'false'
        },
        body: bytes
      },
      access.session.access_token
    );
    if (!upload.ok) throw new Error('photo_storage_failed');

    const created = await restJson(
      env,
      '/rest/v1/media_assets?select=id,profile_id,individual_profile_id,media_role,is_primary,storage_path,moderation_status,ai_assessment,rejection_reason,created_at',
      access.session,
      {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({
          profile_id: profile.id,
          individual_profile_id: portraitTarget?.id || null,
          owner_user_id: access.account.userId,
          storage_path: uploadedPath,
          media_type: 'image',
          visibility: 'profile',
          moderation_status: 'pending',
          media_role: mediaRole,
          is_primary: mediaRole === 'individual_portrait'
        })
      }
    );
    const photo = created?.[0];
    createdMediaId = photo?.id || null;
    if (!photo?.id || photo.storage_path !== uploadedPath) {
      throw new Error('photo_persistence_failed');
    }
    let aiDecision = 'review';
    let aiAssessment = {
      summary: 'Validation IA en attente.',
      biometric_recognition: false
    };
    try {
      const policy = await mediaModerationPolicy(env, access.session);
      const analyzed = await analyzePhoto(
        env,
        bytes,
        mediaRole === 'couple_gallery' ? 2 : 1,
        mediaRole,
        policy
      );
      aiDecision = analyzed.decision;
      aiAssessment = analyzed.assessment;
      await recordAiDecision(env, access.session, photo.id, analyzed);
    } catch (error) {
      aiDecision = 'review';
      aiAssessment = await recordTechnicalReview(
        env,
        access.session,
        photo.id,
        error,
        'public_profile'
      ).catch(() => ({
        summary: 'La photo est conservée en attente de contrôle.',
        technical_error: error.message,
        criteria_version: 'velvet-media-v2',
        moderation_scope: 'public_profile',
        automatic_decision: false,
        human_review_required: true,
        biometric_recognition: false
      }));
    }

    return withSession({
      ok: true,
      photo: {
        ...photo,
        moderation_status: aiDecision === 'review' ? 'pending' : aiDecision,
        ai_assessment: aiAssessment
      }
    }, access.session, 201);
  } catch (error) {
    if (createdMediaId && cleanupSession) {
      await restJson(
        env,
        `/rest/v1/media_assets?id=eq.${encodeURIComponent(createdMediaId)}`,
        cleanupSession,
        { method: 'DELETE', headers: { prefer: 'return=minimal' } }
      ).catch(() => null);
    }
    if (uploadedPath && cleanupSession) {
      await supabase(
        env,
        `/storage/v1/object/velvet-media/${uploadedPath}`,
        { method: 'DELETE' },
        cleanupSession.access_token
      ).catch(() => null);
    }
    return json({ error: error.message || 'photo_upload_failed' }, 400);
  }
}

export async function onRequestPatch({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const profile = await ownedProfile(env, access);
    if (!profile) return json({ error: 'profile_required' }, 409);

    const pending = await restJson(
      env,
      `/rest/v1/media_assets?select=id,profile_id,owner_user_id,storage_path,media_role,moderation_status,ai_reviewed_at&profile_id=eq.${encodeURIComponent(profile.id)}&owner_user_id=eq.${encodeURIComponent(access.account.userId)}&album_id=is.null&moderation_status=eq.pending&ai_reviewed_at=is.null&order=created_at.asc&limit=6`,
      access.session
    );
    const results = [];
    const policy = await mediaModerationPolicy(env, access.session);

    for (const photo of pending || []) {
      try {
        const stored = await supabase(
          env,
          `/storage/v1/object/authenticated/velvet-media/${photo.storage_path}`,
          { method: 'GET' },
          access.session.access_token
        );
        if (!stored.ok) throw new Error('photo_storage_read_failed');
        const analyzed = await analyzePhoto(
          env,
          new Uint8Array(await stored.arrayBuffer()),
          photo.media_role === 'couple_gallery' ? 2 : 1,
          photo.media_role,
          policy
        );
        const status = await recordAiDecision(env, access.session, photo.id, analyzed);
        results.push({ id: photo.id, ok: true, decision: analyzed.decision, status });
      } catch (error) {
        const assessment = await recordTechnicalReview(
          env,
          access.session,
          photo.id,
          error,
          'public_profile'
        ).catch(() => null);
        results.push({
          id: photo.id,
          ok: Boolean(assessment),
          decision: 'review',
          error: assessment ? null : (error.message || 'photo_ai_retry_failed')
        });
      }
    }

    return withSession({
      ok: true,
      attempted: results.length,
      approved: results.filter((item) => item.decision === 'approved').length,
      review: results.filter((item) => item.decision === 'review').length,
      rejected: results.filter((item) => item.decision === 'rejected').length,
      failed: results.filter((item) => !item.ok).length
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'photo_ai_retry_failed' }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const access = await memberSession(request, env);
    if (access.response) return access.response;
    const id = new URL(request.url).searchParams.get('id') || '';
    const rows = await restJson(
      env,
      `/rest/v1/media_assets?select=id,storage_path&owner_user_id=eq.${access.account.userId}&id=eq.${encodeURIComponent(id)}&limit=1`,
      access.session
    );
    const photo = rows?.[0];
    if (!photo) return json({ error: 'photo_not_found' }, 404);
    const storageResponse = await supabase(
      env,
      `/storage/v1/object/velvet-media/${photo.storage_path}`,
      { method: 'DELETE' },
      access.session.access_token
    );
    if (!storageResponse.ok && storageResponse.status !== 404) {
      return json({ error: 'photo_storage_delete_failed' }, 400);
    }
    await restJson(
      env,
      `/rest/v1/media_assets?id=eq.${encodeURIComponent(id)}`,
      access.session,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );
    return withSession({ ok: true }, access.session);
  } catch (error) {
    return json({ error: error.message || 'photo_delete_failed' }, 400);
  }
}
