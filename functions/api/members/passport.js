import { json } from '../auth/_shared.js';
import {
  memberAdmission,
  memberSession,
  memberVerificationState,
  restJson,
  withSession
} from './_shared.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function proof(key, label, status, detail, extra = {}) {
  return {
    key,
    label,
    status,
    detail,
    ...extra
  };
}

async function activeProfileMembers(env, access, profileId) {
  if (!UUID.test(String(profileId || ''))) return [];
  return restJson(
    env,
    `/rest/v1/profile_members?select=user_id,status,created_at&profile_id=eq.${encodeURIComponent(profileId)}&status=eq.active&order=created_at.asc`,
    access.session
  ).catch(() => []);
}

async function verifiedVenuePresence(env, access) {
  const registrations = await restJson(
    env,
    `/rest/v1/event_registrations?select=event_id,status,updated_at&user_id=eq.${encodeURIComponent(access.account.userId)}&status=eq.checked_in&order=updated_at.desc&limit=100`,
    access.session
  ).catch(() => []);

  const eventIds = [...new Set((registrations || [])
    .map((row) => String(row.event_id || ''))
    .filter((id) => UUID.test(id)))];
  if (!eventIds.length) return { count: 0, lastVerifiedAt: null };

  const events = await restJson(
    env,
    `/rest/v1/events?select=id,establishment_id,starts_at&id=in.(${eventIds.join(',')})`,
    access.session
  ).catch(() => []);
  const venueEventIds = new Set((events || [])
    .filter((event) => UUID.test(String(event.establishment_id || '')))
    .map((event) => event.id));
  const verified = (registrations || []).filter((row) => venueEventIds.has(row.event_id));

  return {
    count: verified.length,
    lastVerifiedAt: verified[0]?.updated_at || null
  };
}

export async function onRequestGet({ request, env }) {
  try {
    // The passport must remain readable before verification so a member can
    // understand what is missing and launch the relevant trust journey.
    const access = await memberSession(request, env, { allowUnverified: true });
    if (access.response) return access.response;

    const [verification, admission, presence] = await Promise.all([
      memberVerificationState(env, access),
      memberAdmission(env, access).catch(() => null),
      verifiedVenuePresence(env, access)
    ]);

    const profileId = admission?.id || null;
    const profileType = admission?.profile_type || null;
    const members = profileId ? await activeProfileMembers(env, access, profileId) : [];
    const isCouple = profileType === 'couple';
    const coupleLinked = isCouple && members.length >= 2;

    const proofs = [
      proof(
        'identity_age',
        '18+ et identité',
        verification.verified ? 'verified' : verification.status === 'pending' ? 'pending' : 'not_verified',
        verification.verified
          ? 'Majorité et identité confirmées.'
          : verification.status === 'pending'
            ? 'Vérification en cours.'
            : 'À vérifier pour renforcer la confiance.',
        { verifiedAt: verification.verifiedAt || null }
      ),
      proof(
        'profile_admission',
        'Profil validé',
        admission?.admission_status === 'approved' ? 'verified' : admission ? 'pending' : 'not_started',
        admission?.admission_status === 'approved'
          ? 'Les éléments obligatoires du profil ont été validés.'
          : admission
            ? 'Validation du profil en cours.'
            : 'Le profil doit encore être finalisé.'
      ),
      proof(
        'couple_link',
        'Couple lié',
        isCouple ? (coupleLinked ? 'verified' : 'pending') : 'not_applicable',
        isCouple
          ? coupleLinked
            ? 'Deux comptes actifs sont liés à ce profil couple.'
            : 'Le rattachement du partenaire doit encore être finalisé.'
          : 'Non applicable à ce type de profil.',
        { activeMembers: isCouple ? members.length : 0 }
      ),
      proof(
        'venue_presence',
        'Présence réelle',
        presence.count > 0 ? 'verified' : 'not_started',
        presence.count > 0
          ? `${presence.count} présence${presence.count > 1 ? 's' : ''} confirmée${presence.count > 1 ? 's' : ''} dans un établissement via Zwit.`
          : 'Aucune présence en établissement confirmée pour le moment.',
        { count: presence.count, lastVerifiedAt: presence.lastVerifiedAt }
      )
    ];

    const publicBadges = proofs
      .filter((item) => item.status === 'verified')
      .filter((item) => ['identity_age', 'profile_admission', 'couple_link', 'venue_presence'].includes(item.key))
      .map((item) => item.key);

    return withSession({
      passport: {
        profileId,
        profileType,
        proofs,
        publicBadges,
        privacy: 'Le Passeport Zwit affiche des preuves de confiance, jamais les données d’identité, documents ou informations du prestataire de vérification.'
      }
    }, access.session);
  } catch (error) {
    return json({ error: error.message || 'passport_read_failed' }, 400);
  }
}
