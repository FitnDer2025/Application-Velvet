export const ROLES = Object.freeze({
  MEMBER: 'member',
  PRO_OWNER: 'pro_owner',
  PRO_STAFF: 'pro_staff',
  ORGANIZER: 'organizer',
  MODERATOR: 'moderator',
  SUPPORT: 'support',
  AUDITOR: 'auditor',
  ADMIN: 'admin',
  DIRECTION: 'direction'
});

export function hasAnyRole(identity, allowed) {
  const owned = new Set(identity?.roles || []);
  return allowed.some((role) => owned.has(role));
}

export function requireAnyRole(identity, allowed) {
  if (!identity) {
    const error = new Error('authentication_required');
    error.statusCode = 401;
    throw error;
  }
  if (!hasAnyRole(identity, allowed)) {
    const error = new Error('forbidden');
    error.statusCode = 403;
    throw error;
  }
}
