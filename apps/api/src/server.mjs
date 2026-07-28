import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.mjs';
import { createDatabase } from './db.mjs';
import { appendAudit, appendOutbox } from './audit.mjs';
import { createEncryptor } from './security/encryption.mjs';
import { hashPassword, normalizeEmail, validatePassword, verifyPassword } from './security/password.mjs';
import { createAccessToken, createRefreshToken, hashRefreshToken, verifyAccessToken } from './security/tokens.mjs';
import { ROLES, hasAnyRole, requireAnyRole } from './security/rbac.mjs';
import {
  clearRefreshCookie,
  createRateLimiter,
  parseCookies,
  readJson,
  refreshCookie,
  requestId,
  sendJson
} from './http.mjs';
import { migrate } from './migrate.mjs';

const ALLOWED_AUDIENCES = new Set(['members', 'pro', 'control']);
const config = loadConfig();
const database = createDatabase(config);
const encryptor = createEncryptor({ keys: config.encryptionKeys, activeKeyId: config.activeEncryptionKeyId });
const rateLimit = createRateLimiter({ windowMs: 60_000, max: 180 });
const authRateLimit = createRateLimiter({ windowMs: 15 * 60_000, max: 30 });

if (config.autoMigrate) await migrate(database);

function securityHeaders(origin) {
  const headers = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'strict-transport-security': 'max-age=31536000; includeSubDomains'
  };
  if (origin && config.corsOrigins.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-credentials'] = 'true';
    headers.vary = 'Origin';
  }
  return headers;
}

function audienceFrom(request, body = {}) {
  const audience = body.audience || request.headers['x-velvet-app'] || 'members';
  if (!ALLOWED_AUDIENCES.has(audience)) {
    const error = new Error('invalid_audience');
    error.statusCode = 400;
    throw error;
  }
  return audience;
}

async function rolesFor(client, userId) {
  const result = await client.query(
    `SELECT r.code FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1 AND (ur.expires_at IS NULL OR ur.expires_at > now())`,
    [userId]
  );
  return result.rows.map((row) => row.code);
}

function canAccessAudience(roles, audience) {
  const set = new Set(roles);
  if (set.has(ROLES.ADMIN)) return true;
  if (audience === 'members') return set.has(ROLES.MEMBER);
  if (audience === 'pro') return [ROLES.PRO_OWNER, ROLES.PRO_STAFF, ROLES.ORGANIZER].some((role) => set.has(role));
  if (audience === 'control') {
    return [ROLES.MODERATOR, ROLES.SUPPORT, ROLES.AUDITOR, ROLES.DIRECTION].some((role) => set.has(role));
  }
  return false;
}

function accessToken(userId, roles, audience) {
  return createAccessToken({
    subject: userId,
    roles,
    audience,
    issuer: config.jwtIssuer,
    ttlSeconds: config.accessTtlSeconds,
    privateKey: config.jwtPrivateKey
  });
}

async function createSession(client, userId, audience, request) {
  const refreshToken = createRefreshToken();
  await client.query(
    `INSERT INTO refresh_sessions
      (user_id, token_hash, audience, user_agent, ip_address, expires_at)
     VALUES ($1,$2,$3,$4,$5,now() + interval '30 days')`,
    [
      userId,
      hashRefreshToken(refreshToken),
      audience,
      String(request.headers['user-agent'] || '').slice(0, 500),
      request.socket.remoteAddress || null
    ]
  );
  return refreshToken;
}

function authenticate(request, audience) {
  const authorization = String(request.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) {
    const error = new Error('authentication_required');
    error.statusCode = 401;
    throw error;
  }
  return verifyAccessToken(authorization.slice(7), {
    issuer: config.jwtIssuer,
    audience,
    publicKey: config.jwtPublicKey
  });
}

async function register(request, response, id) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const passwordState = validatePassword(body.password);
  if (!email.includes('@') || !passwordState.valid || !body.displayName) {
    return sendJson(response, 422, { error: 'validation_failed', message: passwordState.reason || 'Données invalides', requestId: id });
  }
  const audience = audienceFrom(request, body);
  if (audience !== 'members') {
    return sendJson(response, 403, { error: 'invitation_required', requestId: id });
  }
  const passwordHash = await hashPassword(body.password, config.passwordPepper);
  const result = await database.transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO users (email, password_hash, status)
       VALUES ($1,$2,'active')
       RETURNING id, email, created_at`,
      [email, passwordHash]
    );
    const user = inserted.rows[0];
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE code = $2`,
      [user.id, ROLES.MEMBER]
    );
    await client.query(
      `INSERT INTO member_profiles (user_id, profile_type, display_name, onboarding_status)
       VALUES ($1,$2,$3,'started')`,
      [user.id, body.profileType || 'individual', String(body.displayName).slice(0, 120)]
    );
    await appendAudit(client, config.auditHmacKey, {
      actorUserId: user.id,
      actorType: 'user',
      action: 'auth.registered',
      entityType: 'user',
      entityId: user.id,
      requestId: id
    });
    await appendOutbox(client, 'user.registered', 'user', user.id, { audience });
    const roles = [ROLES.MEMBER];
    const refreshToken = await createSession(client, user.id, audience, request);
    return { user, roles, refreshToken };
  });
  return sendJson(response, 201, {
    accessToken: accessToken(result.user.id, result.roles, audience),
    expiresIn: config.accessTtlSeconds,
    user: { id: result.user.id, email: result.user.email, roles: result.roles },
    requestId: id
  }, { 'set-cookie': refreshCookie(result.refreshToken, config) });
}

async function login(request, response, id) {
  const body = await readJson(request);
  const audience = audienceFrom(request, body);
  const email = normalizeEmail(body.email);
  const result = await database.query(
    'SELECT id, email, password_hash, status FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];
  const valid = user && user.status === 'active' && await verifyPassword(body.password || '', user.password_hash, config.passwordPepper);
  if (!valid) return sendJson(response, 401, { error: 'invalid_credentials', requestId: id });
  const session = await database.transaction(async (client) => {
    const roles = await rolesFor(client, user.id);
    if (!canAccessAudience(roles, audience)) {
      const error = new Error('audience_forbidden');
      error.statusCode = 403;
      throw error;
    }
    const refreshToken = await createSession(client, user.id, audience, request);
    await client.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    await appendAudit(client, config.auditHmacKey, {
      actorUserId: user.id,
      actorType: 'user',
      action: 'auth.login_succeeded',
      entityType: 'user',
      entityId: user.id,
      requestId: id,
      metadata: { audience }
    });
    return { roles, refreshToken };
  });
  return sendJson(response, 200, {
    accessToken: accessToken(user.id, session.roles, audience),
    expiresIn: config.accessTtlSeconds,
    user: { id: user.id, email: user.email, roles: session.roles },
    requestId: id
  }, { 'set-cookie': refreshCookie(session.refreshToken, config) });
}

async function refresh(request, response, id) {
  const token = parseCookies(request.headers.cookie).velvet_refresh;
  if (!token) return sendJson(response, 401, { error: 'refresh_required', requestId: id });
  const tokenHash = hashRefreshToken(token);
  const rotated = await database.transaction(async (client) => {
    const found = await client.query(
      `SELECT rs.id, rs.user_id, rs.audience, u.status
       FROM refresh_sessions rs JOIN users u ON u.id = rs.user_id
       WHERE rs.token_hash = $1 AND rs.revoked_at IS NULL AND rs.expires_at > now()
       FOR UPDATE`,
      [tokenHash]
    );
    const session = found.rows[0];
    if (!session || session.status !== 'active') return null;
    await client.query('UPDATE refresh_sessions SET revoked_at = now(), replaced_by_rotation = true WHERE id = $1', [session.id]);
    const roles = await rolesFor(client, session.user_id);
    if (!canAccessAudience(roles, session.audience)) return null;
    const refreshToken = await createSession(client, session.user_id, session.audience, request);
    return { userId: session.user_id, audience: session.audience, roles, refreshToken };
  });
  if (!rotated) return sendJson(response, 401, { error: 'invalid_refresh', requestId: id }, { 'set-cookie': clearRefreshCookie(config) });
  return sendJson(response, 200, {
    accessToken: accessToken(rotated.userId, rotated.roles, rotated.audience),
    expiresIn: config.accessTtlSeconds,
    requestId: id
  }, { 'set-cookie': refreshCookie(rotated.refreshToken, config) });
}

async function logout(request, response, id) {
  const token = parseCookies(request.headers.cookie).velvet_refresh;
  if (token) {
    await database.query('UPDATE refresh_sessions SET revoked_at = now() WHERE token_hash = $1', [hashRefreshToken(token)]);
  }
  response.setHeader('set-cookie', clearRefreshCookie(config));
  response.writeHead(204);
  response.end();
}

async function me(request, response, id, audience) {
  const identity = authenticate(request, audience);
  const result = await database.query(
    `SELECT u.id, u.email, u.status, u.created_at, u.last_login_at,
            mp.profile_type, mp.display_name, mp.onboarding_status
     FROM users u LEFT JOIN member_profiles mp ON mp.user_id = u.id
     WHERE u.id = $1`,
    [identity.sub]
  );
  if (!result.rowCount) return sendJson(response, 404, { error: 'not_found', requestId: id });
  return sendJson(response, 200, { ...result.rows[0], roles: identity.roles, audience, requestId: id });
}

async function updateProfile(request, response, id) {
  const identity = authenticate(request, 'members');
  requireAnyRole(identity, [ROLES.MEMBER, ROLES.ADMIN]);
  const body = await readJson(request);
  const privateEnvelope = body.privateDetails
    ? encryptor.encrypt(body.privateDetails, `member_profile:${identity.sub}`)
    : null;
  const result = await database.transaction(async (client) => {
    const updated = await client.query(
      `UPDATE member_profiles SET
         display_name = COALESCE($2, display_name),
         city = COALESCE($3, city),
         public_story = COALESCE($4, public_story),
         private_details_encrypted = COALESCE($5, private_details_encrypted),
         onboarding_status = COALESCE($6, onboarding_status),
         updated_at = now()
       WHERE user_id = $1
       RETURNING id, profile_type, display_name, city, public_story, onboarding_status, updated_at`,
      [
        identity.sub,
        body.displayName ? String(body.displayName).slice(0, 120) : null,
        body.city ? String(body.city).slice(0, 120) : null,
        body.publicStory ? String(body.publicStory).slice(0, 5000) : null,
        privateEnvelope,
        body.onboardingStatus || null
      ]
    );
    await appendAudit(client, config.auditHmacKey, {
      actorUserId: identity.sub,
      actorType: 'user',
      action: 'member_profile.updated',
      entityType: 'member_profile',
      entityId: updated.rows[0]?.id,
      requestId: id,
      metadata: { privateDetailsChanged: Boolean(body.privateDetails) }
    });
    await appendOutbox(client, 'member_profile.updated', 'member_profile', updated.rows[0].id, {
      userId: identity.sub
    });
    return updated.rows[0];
  });
  return sendJson(response, 200, { profile: result, requestId: id });
}

async function getEstablishment(response, id, establishmentId) {
  const result = await database.query(
    `SELECT id, slug, name, kind, description, city, address_public, website_url,
            phone_public, opening_hours, amenities, visibility, updated_at
     FROM establishments WHERE id = $1 AND visibility = 'published'`,
    [establishmentId]
  );
  if (!result.rowCount) return sendJson(response, 404, { error: 'not_found', requestId: id });
  return sendJson(response, 200, { establishment: result.rows[0], requestId: id });
}

async function updateEstablishment(request, response, id, establishmentId) {
  const identity = authenticate(request, 'pro');
  requireAnyRole(identity, [ROLES.PRO_OWNER, ROLES.PRO_STAFF, ROLES.ADMIN]);
  if (!hasAnyRole(identity, [ROLES.ADMIN])) {
    const membership = await database.query(
      'SELECT 1 FROM establishment_staff WHERE establishment_id = $1 AND user_id = $2 AND status = $3',
      [establishmentId, identity.sub, 'active']
    );
    if (!membership.rowCount) return sendJson(response, 403, { error: 'forbidden', requestId: id });
  }
  const body = await readJson(request);
  const updated = await database.transaction(async (client) => {
    const result = await client.query(
      `UPDATE establishments SET
         name = COALESCE($2, name), description = COALESCE($3, description),
         opening_hours = COALESCE($4, opening_hours), amenities = COALESCE($5, amenities),
         visibility = COALESCE($6, visibility), updated_at = now()
       WHERE id = $1
       RETURNING id, slug, name, kind, description, city, opening_hours, amenities, visibility, updated_at`,
      [establishmentId, body.name || null, body.description || null, body.openingHours || null, body.amenities || null, body.visibility || null]
    );
    if (!result.rowCount) return null;
    await appendAudit(client, config.auditHmacKey, {
      actorUserId: identity.sub,
      actorType: 'user',
      action: 'establishment.updated',
      entityType: 'establishment',
      entityId: establishmentId,
      requestId: id
    });
    await appendOutbox(client, 'establishment.updated', 'establishment', establishmentId, {
      visibility: result.rows[0].visibility
    });
    return result.rows[0];
  });
  if (!updated) return sendJson(response, 404, { error: 'not_found', requestId: id });
  return sendJson(response, 200, { establishment: updated, requestId: id });
}

async function createEvent(request, response, id) {
  const audience = audienceFrom(request);
  const identity = authenticate(request, audience);
  requireAnyRole(identity, [ROLES.PRO_OWNER, ROLES.PRO_STAFF, ROLES.ORGANIZER, ROLES.ADMIN]);
  const body = await readJson(request);
  if (!body.title || !body.startsAt || !body.capacity) return sendJson(response, 422, { error: 'validation_failed', requestId: id });
  const event = await database.transaction(async (client) => {
    if (!hasAnyRole(identity, [ROLES.ADMIN])) {
      if (body.ownerType === 'establishment') {
        const allowed = await client.query(
          `SELECT 1 FROM establishment_staff
           WHERE establishment_id = $1 AND user_id = $2 AND status = 'active'`,
          [body.establishmentId, identity.sub]
        );
        if (!allowed.rowCount) {
          const error = new Error('forbidden');
          error.statusCode = 403;
          throw error;
        }
      } else if (body.ownerType === 'organizer') {
        const allowed = await client.query(
          `SELECT 1 FROM organizer_profiles
           WHERE id = $1 AND user_id = $2 AND status = 'approved'`,
          [body.organizerProfileId, identity.sub]
        );
        if (!allowed.rowCount) {
          const error = new Error('forbidden');
          error.statusCode = 403;
          throw error;
        }
      } else {
        const error = new Error('invalid_owner_type');
        error.statusCode = 422;
        throw error;
      }
    }
    const result = await client.query(
      `INSERT INTO events
        (owner_type, establishment_id, organizer_profile_id, title, description, starts_at, ends_at, capacity, visibility, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        body.ownerType,
        body.establishmentId || null,
        body.organizerProfileId || null,
        String(body.title).slice(0, 180),
        body.description || null,
        body.startsAt,
        body.endsAt || null,
        Number(body.capacity),
        body.visibility || 'draft',
        identity.sub
      ]
    );
    await appendAudit(client, config.auditHmacKey, {
      actorUserId: identity.sub,
      actorType: 'user',
      action: 'event.created',
      entityType: 'event',
      entityId: result.rows[0].id,
      requestId: id
    });
    await appendOutbox(client, 'event.created', 'event', result.rows[0].id, {
      ownerType: result.rows[0].owner_type,
      visibility: result.rows[0].visibility
    });
    return result.rows[0];
  });
  return sendJson(response, 201, { event, requestId: id });
}

async function registerForEvent(request, response, id, eventId) {
  const identity = authenticate(request, 'members');
  const registration = await database.transaction(async (client) => {
    const lockedEvent = await client.query(
      `SELECT id, capacity FROM events
       WHERE id = $1 AND visibility = 'published'
       FOR UPDATE`,
      [eventId]
    );
    if (!lockedEvent.rowCount) return null;
    const confirmed = await client.query(
      `SELECT count(*)::integer AS count FROM event_registrations
       WHERE event_id = $1 AND status = 'confirmed'`,
      [eventId]
    );
    const status = confirmed.rows[0].count < lockedEvent.rows[0].capacity ? 'confirmed' : 'waitlisted';
    const result = await client.query(
      `INSERT INTO event_registrations (event_id, user_id, status)
       VALUES ($1,$2,$3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [eventId, identity.sub, status]
    );
    await appendAudit(client, config.auditHmacKey, {
      actorUserId: identity.sub,
      actorType: 'user',
      action: 'event.registration_created',
      entityType: 'event',
      entityId: eventId,
      requestId: id,
      metadata: { status: result.rows[0].status }
    });
    await appendOutbox(client, 'event.registration_created', 'event', eventId, {
      userId: identity.sub,
      status: result.rows[0].status
    });
    return result.rows[0];
  });
  if (!registration) return sendJson(response, 404, { error: 'event_not_found', requestId: id });
  return sendJson(response, 201, { registration, requestId: id });
}

async function controlAudit(request, response, id) {
  const identity = authenticate(request, 'control');
  requireAnyRole(identity, [ROLES.MODERATOR, ROLES.AUDITOR, ROLES.ADMIN, ROLES.DIRECTION]);
  const result = await database.query(
    `SELECT sequence_number, occurred_at, actor_user_id, actor_type, action, entity_type,
            entity_id, metadata, request_id, previous_hash, event_hash
     FROM audit_events ORDER BY sequence_number DESC LIMIT 100`
  );
  return sendJson(response, 200, { events: result.rows, requestId: id });
}

const server = createServer(async (request, response) => {
  const id = requestId(request);
  const origin = request.headers.origin;
  const headers = securityHeaders(origin);
  Object.entries(headers).forEach(([name, value]) => response.setHeader(name, value));
  response.setHeader('x-request-id', id);

  if (request.method === 'OPTIONS') {
    response.setHeader('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    response.setHeader('access-control-allow-headers', 'authorization,content-type,x-request-id,x-velvet-app');
    return response.writeHead(204).end();
  }
  if (origin && !config.corsOrigins.has(origin)) return sendJson(response, 403, { error: 'origin_not_allowed', requestId: id });

  const ip = request.socket.remoteAddress || 'unknown';
  const limited = rateLimit(ip);
  if (!limited.allowed) return sendJson(response, 429, { error: 'rate_limited', requestId: id }, { 'retry-after': Math.ceil((limited.resetAt - Date.now()) / 1000) });

  const url = new URL(request.url, 'http://velvet.internal');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  try {
    if (request.method === 'GET' && path === '/health') {
      const db = await database.health();
      return sendJson(response, 200, { status: 'ok', database: 'ok', time: db.now, version: '0.1.0', requestId: id });
    }
    if (path.startsWith('/v1/auth/')) {
      const authLimit = authRateLimit(ip);
      if (!authLimit.allowed) return sendJson(response, 429, { error: 'auth_rate_limited', requestId: id });
    }
    if (request.method === 'POST' && path === '/v1/auth/register') return await register(request, response, id);
    if (request.method === 'POST' && path === '/v1/auth/login') return await login(request, response, id);
    if (request.method === 'POST' && path === '/v1/auth/refresh') return await refresh(request, response, id);
    if (request.method === 'POST' && path === '/v1/auth/logout') return await logout(request, response, id);
    if (request.method === 'GET' && path === '/v1/me') return await me(request, response, id, audienceFrom(request));
    if (request.method === 'PATCH' && path === '/v1/member-profiles/me') return await updateProfile(request, response, id);
    const establishmentMatch = path.match(/^\/v1\/establishments\/([0-9a-f-]{36})$/);
    if (request.method === 'GET' && establishmentMatch) return await getEstablishment(response, id, establishmentMatch[1]);
    const proEstablishmentMatch = path.match(/^\/v1\/pro\/establishments\/([0-9a-f-]{36})$/);
    if (request.method === 'PATCH' && proEstablishmentMatch) return await updateEstablishment(request, response, id, proEstablishmentMatch[1]);
    if (request.method === 'POST' && path === '/v1/events') return await createEvent(request, response, id);
    const registrationMatch = path.match(/^\/v1\/events\/([0-9a-f-]{36})\/registrations$/);
    if (request.method === 'POST' && registrationMatch) return await registerForEvent(request, response, id, registrationMatch[1]);
    if (request.method === 'GET' && path === '/v1/control/audit') return await controlAudit(request, response, id);
    return sendJson(response, 404, { error: 'route_not_found', requestId: id });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === '23505' ? 409 : 500);
    console.error(JSON.stringify({
      level: 'error',
      event: 'http.request_failed',
      requestId: id,
      path,
      statusCode,
      message: statusCode >= 500 ? error.message : undefined
    }));
    return sendJson(response, statusCode, {
      error: statusCode >= 500 ? 'internal_error' : error.message,
      requestId: id
    });
  }
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', event: 'api.started', port: config.port, environment: config.nodeEnv }));
});

async function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', event: 'api.shutdown', signal }));
  server.close();
  await database.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
