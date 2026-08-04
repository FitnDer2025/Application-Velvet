import { json, readJson, supabase } from '../auth/_shared.js';
import {
  memberSession,
  restJson,
  withSession
} from './_shared.js';
import { buildConfiguredVelvetEmail } from './couple-invitation-email.js';

async function configuredTemplate(env, session, templateKey) {
  try {
    const result = await restJson(
      env,
      '/rest/v1/rpc/active_email_template',
      session,
      { method: 'POST', body: JSON.stringify({ target_template_key: templateKey }) }
    );
    return Array.isArray(result) ? result[0] || null : result || null;
  } catch {
    return null;
  }
}

function htmlPage(title, copy, form = '') {
  const escape = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Velvet</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 80% 10%,#522038,#0b080a 55%);color:#f8eee8;font:16px/1.6 Arial,sans-serif}.card{width:min(620px,100%);padding:38px;border:1px solid #50313d;border-radius:28px;background:#171014;box-shadow:0 30px 80px #0008}.eyebrow{color:#d9b879;font-size:11px;letter-spacing:.18em;text-transform:uppercase}h1{margin:.25em 0;font:44px/1.05 Georgia,serif}p{color:#cfc2c6}button,a{display:inline-block;margin-top:16px;padding:13px 20px;border:0;border-radius:999px;background:#9f2852;color:white;font-weight:700;text-decoration:none;cursor:pointer}.secondary{background:transparent;border:1px solid #d9b879;color:#d9b879}
  </style></head><body><main class="card"><p class="eyebrow">Velvet · action sensible</p><h1>${escape(title)}</h1><p>${escape(copy)}</p>${form}</main></body></html>`, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function tokenHash(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function anonymousRpc(env, name, payload) {
  const response = await supabase(env, `/rest/v1/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || result?.code || 'confirmation_failed');
  return result;
}

function lifecycleEmail(action, confirmationUrl, profileName) {
  const escape = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const pause = action === 'pause';
  const label = pause ? 'mise en pause' : 'suppression';
  const delay = pause
    ? 'Le profil deviendra invisible dès que chaque membre actif de la fiche aura confirmé.'
    : 'Le profil deviendra invisible après les confirmations, puis les données seront supprimées définitivement 30 jours plus tard.';
  return {
    subject: `Confirmer la ${label} de votre profil Velvet`,
    text: [
      'VELVET — CONFIRMATION DE SÉCURITÉ',
      '',
      `Une demande de ${label} a été créée pour le profil « ${profileName} ».`,
      delay,
      '',
      `Confirmer : ${confirmationUrl}`,
      '',
      'Ce lien personnel expire dans 48 heures. Si vous n’êtes pas à l’origine de cette demande, ne le validez pas et contactez Velvet.'
    ].join('\n'),
    html: `<div style="background:#0b080a;padding:32px;color:#f8eee8;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:34px;border:1px solid #50313d;border-radius:26px;background:#171014"><p style="color:#d9b879;letter-spacing:2px;text-transform:uppercase;font-size:11px">Velvet · confirmation de sécurité</p><h1 style="font-family:Georgia,serif;font-weight:400">Confirmer la ${label}</h1><p style="color:#d5c8cc;line-height:1.7">Une demande concerne le profil <strong>${escape(profileName)}</strong>. ${delay}</p><a href="${escape(confirmationUrl)}" style="display:inline-block;margin-top:18px;padding:14px 22px;border-radius:999px;background:#9f2852;color:white;text-decoration:none;font-weight:700">Vérifier et confirmer</a><p style="margin-top:22px;color:#94878c;font-size:12px">Lien personnel valable 48 heures. Ne le partagez pas.</p></div></div>`
  };
}

async function lifecycleState(env, access) {
  const profiles = await restJson(
    env,
    `/rest/v1/member_profiles?select=id,display_name,lifecycle_state,visibility_before_lifecycle,profile_members!inner(user_id,status)&profile_members.user_id=eq.${encodeURIComponent(access.account.userId)}&profile_members.status=eq.active&limit=1`,
    access.session
  );
  const profile = profiles?.[0] || null;
  if (!profile) return { profile: null, action: null };
  const actions = await restJson(
    env,
    `/rest/v1/profile_lifecycle_actions?select=id,action_type,status,requested_at,confirmed_at,execute_after,profile_lifecycle_confirmations(user_id,confirmed_at,email_sent_at)&profile_id=eq.${encodeURIComponent(profile.id)}&status=in.(pending,confirmed)&order=requested_at.desc&limit=1`,
    access.session
  );
  return { profile, action: actions?.[0] || null };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action');
  if (token && /^[0-9a-f]{64}$/.test(token) && ['pause','delete'].includes(action)) {
    const label = action === 'pause' ? 'mettre le profil en pause' : 'programmer la suppression';
    return htmlPage(
      'Confirmation requise',
      `Confirmez-vous vouloir ${label} ? Pour une fiche couple, l’action ne sera appliquée qu’après la validation des deux adresses.`,
      `<form method="post" action="/api/members/account-actions"><input type="hidden" name="token" value="${token}"><button type="submit">Confirmer cette action</button></form><a class="secondary" href="/membres/">Annuler et revenir à Velvet</a>`
    );
  }
  try {
    const access = await memberSession(request, env, { allowUnverified: true });
    if (access.response) return access.response;
    return withSession(await lifecycleState(env, access), access.session);
  } catch (error) {
    return json({ error: error.message || 'lifecycle_state_failed' }, 400);
  }
}

export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')
    || contentType.includes('multipart/form-data')) {
    try {
      const form = await request.formData();
      const token = String(form.get('token') || '');
      if (!/^[0-9a-f]{64}$/.test(token)) throw new Error('lifecycle_confirmation_invalid');
      const result = await anonymousRpc(env, 'confirm_profile_lifecycle_action', {
        target_token_hash: await tokenHash(token)
      });
      const confirmation = result?.[0] || {};
      const waiting = Number(confirmation.waiting_for || 0);
      return htmlPage(
        'Confirmation enregistrée',
        waiting
          ? `Votre validation est enregistrée. L’action attend encore ${waiting} confirmation${waiting > 1 ? 's' : ''}.`
          : confirmation.action_type === 'delete'
            ? 'Le profil est désormais invisible. La suppression définitive interviendra dans 30 jours ; vous pouvez encore annuler depuis les paramètres.'
            : 'Le profil est maintenant en pause et invisible. Vous pourrez le réactiver depuis les paramètres.',
        '<a href="/membres/">Revenir à Velvet</a>'
      );
    } catch {
      return htmlPage('Lien invalide ou expiré', 'Cette confirmation ne peut plus être utilisée. Recommencez la demande depuis les paramètres.', '<a href="/membres/">Revenir à Velvet</a>');
    }
  }

  try {
    const access = await memberSession(request, env, { allowUnverified: true });
    if (access.response) return access.response;
    const body = await readJson(request);
    if (body.action === 'cancel' || body.action === 'resume') {
      await restJson(env, '/rest/v1/rpc/cancel_my_profile_lifecycle', access.session, {
        method: 'POST',
        body: '{}'
      });
      return withSession({ ok: true, ...(await lifecycleState(env, access)) }, access.session);
    }
    if (!['pause','delete'].includes(body.action)) {
      return withSession({ error: 'invalid_lifecycle_action' }, access.session, 400);
    }
    if (!env.RESEND_API_KEY || !env.VELVET_FROM_EMAIL) {
      return withSession({ error: 'lifecycle_email_not_configured' }, access.session, 503);
    }
    const recipients = await restJson(
      env,
      '/rest/v1/rpc/profile_lifecycle_recipients',
      access.session,
      { method: 'POST', body: '{}' }
    );
    if (!recipients?.length || recipients.some((recipient) => !recipient.email)) {
      return withSession({ error: 'lifecycle_recipient_missing' }, access.session, 409);
    }
    const prepared = await Promise.all(recipients.map(async (recipient) => {
      const token = randomToken();
      return { ...recipient, token, token_hash: await tokenHash(token) };
    }));
    const actionId = await restJson(
      env,
      '/rest/v1/rpc/request_profile_lifecycle_action',
      access.session,
      {
        method: 'POST',
        body: JSON.stringify({
          target_action: body.action,
          confirmation_rows: prepared.map((recipient) => ({
            user_id: recipient.user_id,
            token_hash: recipient.token_hash
          }))
        })
      }
    );
    const state = await lifecycleState(env, access);
    const profileName = state.profile?.display_name || 'Votre profil';
    const selectedTemplate = await configuredTemplate(
      env,
      access.session,
      body.action === 'pause' ? 'account_pause_confirmation' : 'account_deletion_confirmation'
    );
    for (const recipient of prepared) {
      const confirmationUrl = new URL('/api/members/account-actions', request.url);
      confirmationUrl.searchParams.set('action', body.action);
      confirmationUrl.searchParams.set('token', recipient.token);
      const template = buildConfiguredVelvetEmail({
        template: selectedTemplate,
        variables: {
          profile_name: profileName,
          confirmation_url: confirmationUrl.toString()
        },
        ctaUrl: confirmationUrl.toString(),
        logoUrl: `${confirmationUrl.origin}/assets/velvet-icon-192.png`
      }) || lifecycleEmail(body.action, confirmationUrl.toString(), profileName);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
          'idempotency-key': `velvet-lifecycle-${actionId}-${recipient.user_id}`
        },
        body: JSON.stringify({
          from: env.VELVET_FROM_EMAIL,
          to: [recipient.email],
          subject: template.subject,
          text: template.text,
          html: template.html,
          ...(env.VELVET_REPLY_TO_EMAIL ? { reply_to: env.VELVET_REPLY_TO_EMAIL } : {}),
          tags: [{ name: 'category', value: 'profile_lifecycle' }]
        })
      });
      if (!response.ok) {
        await restJson(env, '/rest/v1/rpc/cancel_my_profile_lifecycle', access.session, {
          method: 'POST',
          body: '{}'
        }).catch(() => null);
        throw new Error('lifecycle_email_failed');
      }
    }
    return withSession({
      ok: true,
      recipients: prepared.length,
      ...(await lifecycleState(env, access))
    }, access.session, 201);
  } catch (error) {
    return json({ error: error.message || 'lifecycle_request_failed' }, 400);
  }
}
