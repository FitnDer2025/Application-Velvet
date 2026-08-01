import { json, readJson } from '../auth/_shared.js';
import { memberSession, restJson, withSession } from '../members/_shared.js';
import { DEFAULT_AGENTS } from './_test-agent-personas.js';
import { portraitPng } from './_test-agent-portraits.js';

const CONTROL_ROLES = new Set(['admin', 'direction']);
const INTERNAL_ENVIRONMENTS = new Set(['development', 'dev', 'staging', 'preview', 'internal', 'test']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function environmentName(env) {
  return String(env.VELVET_ENVIRONMENT || env.ENVIRONMENT || '').trim().toLowerCase();
}

function assertInternalEnvironment(env) {
  const name = environmentName(env);
  if (!INTERNAL_ENVIRONMENTS.has(name) || String(env.VELVET_INTERNAL_TEST_AGENTS || '') !== 'enabled') {
    throw new Error('internal_test_agents_environment_disabled');
  }
  if (name === 'production') throw new Error('internal_test_agents_forbidden_in_production');
  return name;
}

async function controlAccess(request, env) {
  const access = await memberSession(request, env);
  if (access.response) return access;
  if (!access.account.roles.some((role) => CONTROL_ROLES.has(role))) {
    return { response: json({ error: 'internal_test_agent_control_required' }, 403) };
  }
  return access;
}

function serviceConfiguration(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!url || !key) throw new Error('supabase_service_role_not_configured');
  return { url, key };
}

async function serviceResponse(env, path, init = {}) {
  const { url, key } = serviceConfiguration(env);
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('authorization', `Bearer ${key}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(`${url}${path}`, { ...init, headers });
}

async function serviceJson(env, path, init = {}) {
  const response = await serviceResponse(env, path, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.message || payload?.msg || payload?.error_description || payload?.error || 'service_request_failed';
    throw new Error(detail);
  }
  return payload;
}

function randomToken(length = 24) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

async function uploadPortraits(env, agent, userId, profileId) {
  const role = agent.persona.profile_type === 'couple' ? 'couple_gallery' : 'individual_gallery';
  const rows = [];
  for (let index = 0; index < 3; index += 1) {
    const storagePath = `internal-test-agents/${agent.slug}/portrait-${index + 1}.png`;
    const upload = await serviceResponse(env, `/storage/v1/object/velvet-media/${storagePath}`, {
      method: 'POST',
      headers: {
        'content-type': 'image/png',
        'x-upsert': 'true'
      },
      body: portraitPng(agent, index)
    });
    if (!upload.ok) {
      const detail = await upload.text().catch(() => '');
      throw new Error(detail || 'test_agent_portrait_upload_failed');
    }
    rows.push({
      profile_id: profileId,
      owner_user_id: userId,
      storage_path: storagePath,
      media_type: 'image',
      visibility: 'profile',
      moderation_status: 'approved',
      media_role: role,
      is_primary: index === 0,
      ai_assessment: {
        synthetic: true,
        internal_test_only: true,
        generator: 'velvet-png-fixture'
      },
      ai_reviewed_at: new Date().toISOString()
    });
  }

  await serviceJson(env, '/rest/v1/media_assets?on_conflict=storage_path', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
}

async function findAccountByEmail(env, email) {
  const rows = await serviceJson(
    env,
    `/rest/v1/accounts?select=user_id,email&email=eq.${encodeURIComponent(email)}&limit=1`
  );
  return rows?.[0] || null;
}

async function seedAgent(env, access, agent) {
  const existing = await serviceJson(
    env,
    `/rest/v1/internal_test_agents?select=id,user_id,profile_id,slug&slug=eq.${encodeURIComponent(agent.slug)}&limit=1`
  );

  const email = `test-agent+${agent.slug}@velvet.internal`;
  let account = existing?.[0]
    ? { user_id: existing[0].user_id, email }
    : await findAccountByEmail(env, email);
  if (!account) {
    const inviteCode = randomToken(20);
    await serviceJson(env, '/rest/v1/rpc/internal_prepare_test_agent_invite', {
      method: 'POST',
      body: JSON.stringify({
        target_email: email,
        raw_code: inviteCode,
        target_actor: access.account.userId
      })
    });
    const created = await serviceJson(env, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: randomToken(32),
        email_confirm: true,
        user_metadata: {
          invite_code: inviteCode,
          internal_test_agent: true,
          agent_slug: agent.slug
        }
      })
    });
    account = { user_id: created.id || created.user?.id, email };
  }
  if (!UUID.test(account?.user_id || '')) throw new Error('test_agent_user_creation_failed');

  const profileId = await serviceJson(env, '/rest/v1/rpc/internal_register_test_agent', {
    method: 'POST',
    body: JSON.stringify({
      target_user_id: account.user_id,
      target_email: email,
      target_slug: agent.slug,
      target_persona: agent.persona,
      target_behavior: agent.behavior,
      target_actor: access.account.userId
    })
  });
  if (!UUID.test(profileId || '')) throw new Error('test_agent_profile_creation_failed');
  await uploadPortraits(env, agent, account.user_id, profileId);
  return {
    slug: agent.slug,
    status: existing?.[0] ? 'updated' : 'created',
    userId: account.user_id,
    profileId
  };
}

async function statusPayload(env, access) {
  const state = await restJson(env, '/rest/v1/rpc/control_internal_test_agent_status', access.session, {
    method: 'POST',
    body: '{}'
  });
  return {
    ...state,
    runtime: {
      environment: environmentName(env),
      environmentEnabled: INTERNAL_ENVIRONMENTS.has(environmentName(env))
        && String(env.VELVET_INTERNAL_TEST_AGENTS || '') === 'enabled',
      serviceRoleConfigured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      openAiConfigured: Boolean(env.OPENAI_API_KEY && env.VELVET_TEST_AGENT_MODEL),
      workerRequired: true
    }
  };
}

async function cleanupAgents(env) {
  const agents = await serviceJson(
    env,
    '/rest/v1/internal_test_agents?select=id,user_id,profile_id,slug&order=created_at.asc'
  );
  const results = [];
  for (const agent of agents || []) {
    try {
      const media = agent.profile_id
        ? await serviceJson(
            env,
            `/rest/v1/media_assets?select=storage_path&profile_id=eq.${encodeURIComponent(agent.profile_id)}`
          )
        : [];
      for (const item of media || []) {
        if (!item.storage_path) continue;
        const storageResponse = await serviceResponse(
          env,
          `/storage/v1/object/velvet-media/${item.storage_path.split('/').map(encodeURIComponent).join('/')}`,
          { method: 'DELETE' }
        );
        if (!storageResponse.ok && storageResponse.status !== 404) {
          throw new Error('test_agent_storage_delete_failed');
        }
      }
      const userId = await serviceJson(env, '/rest/v1/rpc/internal_purge_test_agent', {
        method: 'POST',
        body: JSON.stringify({ target_agent_id: agent.id })
      });
      if (UUID.test(userId || agent.user_id || '')) {
        const response = await serviceResponse(
          env,
          `/auth/v1/admin/users/${encodeURIComponent(userId || agent.user_id)}`,
          { method: 'DELETE' }
        );
        if (!response.ok && response.status !== 404) {
          const detail = await response.text().catch(() => '');
          throw new Error(detail || 'test_agent_auth_delete_failed');
        }
      }
      results.push({ slug: agent.slug, status: 'deleted' });
    } catch (error) {
      results.push({
        slug: agent.slug,
        userId: agent.user_id,
        status: 'failed',
        error: error.message
      });
    }
  }
  return results;
}

export async function onRequestGet({ request, env }) {
  try {
    assertInternalEnvironment(env);
    const access = await controlAccess(request, env);
    if (access.response) return access.response;
    return withSession(await statusPayload(env, access), access.session);
  } catch (error) {
    return json({ error: error.message || 'internal_test_agents_read_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    assertInternalEnvironment(env);
    const access = await controlAccess(request, env);
    if (access.response) return access.response;
    const body = await readJson(request);
    let result = null;

    if (body.action === 'seed') {
      await restJson(env, '/rest/v1/rpc/control_add_internal_test_viewer', access.session, {
        method: 'POST', body: JSON.stringify({ target_user_id: access.account.userId })
      });
      const selected = Array.isArray(body.slugs) && body.slugs.length
        ? DEFAULT_AGENTS.filter((agent) => body.slugs.includes(agent.slug))
        : DEFAULT_AGENTS;
      result = [];
      for (const agent of selected) result.push(await seedAgent(env, access, agent));
    } else if (body.action === 'set_enabled') {
      await restJson(env, '/rest/v1/rpc/control_set_internal_test_agents_enabled', access.session, {
        method: 'POST', body: JSON.stringify({ target_enabled: Boolean(body.enabled) })
      });
      result = { enabled: Boolean(body.enabled) };
    } else if (body.action === 'set_agent_status') {
      if (!UUID.test(body.agentId || '') || !['active', 'paused', 'retired'].includes(body.status)) {
        return withSession({ error: 'invalid_test_agent_status' }, access.session, 400);
      }
      await restJson(env, '/rest/v1/rpc/control_set_internal_test_agent_status', access.session, {
        method: 'POST',
        body: JSON.stringify({ target_agent_id: body.agentId, target_status: body.status })
      });
      result = { agentId: body.agentId, status: body.status };
    } else if (body.action === 'add_viewer' || body.action === 'remove_viewer') {
      const targetUserId = body.userId || access.account.userId;
      if (!UUID.test(targetUserId || '')) {
        return withSession({ error: 'invalid_test_viewer' }, access.session, 400);
      }
      const rpc = body.action === 'add_viewer'
        ? 'control_add_internal_test_viewer'
        : 'control_remove_internal_test_viewer';
      await restJson(env, `/rest/v1/rpc/${rpc}`, access.session, {
        method: 'POST', body: JSON.stringify({ target_user_id: targetUserId })
      });
      result = { userId: targetUserId, enabled: body.action === 'add_viewer' };
    } else if (body.action === 'run_now') {
      await serviceJson(env, '/rest/v1/internal_test_agents?status=eq.active', {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ next_run_at: new Date().toISOString(), last_error_code: null })
      });
      result = { queued: true };
    } else if (body.action === 'cleanup') {
      await restJson(env, '/rest/v1/rpc/control_set_internal_test_agents_enabled', access.session, {
        method: 'POST', body: JSON.stringify({ target_enabled: false })
      });
      result = await cleanupAgents(env);
    } else {
      return withSession({ error: 'invalid_test_agent_action' }, access.session, 400);
    }

    return withSession({
      ok: true,
      result,
      state: await statusPayload(env, access)
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'internal_test_agents_write_failed' }, 400);
  }
}
