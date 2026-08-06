# Zwit Database Bible — DB-01

## Accounts, identities, profiles and shared profile governance

**Status:** Proposed for validation  
**Version:** 1.0  
**Scope:** Platform Core  
**Applies to:** Community, Professionals, Administration  
**Related decisions:** ADR-DATA-046, V1 Dual Platform Scope, Target Architecture V1

---

## 1. Purpose

This document defines the canonical data model for:

- authenticated Zwit accounts;
- personal identities;
- age and identity verification state;
- independent and shared profiles;
- profile memberships and roles;
- couple profile governance;
- sensitive-action approvals;
- account and profile lifecycle;
- consent, traceability and deletion boundaries.

This document is normative. Application code, APIs, database migrations and tests must conform to it.

---

## 2. Locked product principles

1. One human being owns one personal Zwit account.
2. Login credentials are never shared between partners.
3. An account may participate in several profiles.
4. A couple profile is a shared profile, not a shared account.
5. A shared profile is linked to at least two verified personal accounts.
6. Daily profile management may be delegated according to role permissions.
7. Sensitive actions require explicit approval from all required profile members.
8. Personal data, profile data and verification data remain separated.
9. Every sensitive mutation must be auditable.
10. No profile may be publicly discoverable until mandatory onboarding and trust requirements are satisfied.

---

## 3. Domain model

```text
Auth User
   │
   └── Account
        ├── Personal Identity
        ├── Verification Cases
        ├── Account Settings
        ├── Devices / Sessions
        └── Profile Memberships
                 │
                 ├── Individual Profile
                 ├── Couple Profile
                 ├── Organizer Profile
                 └── Professional Profile
```

The authentication provider identifies a login subject. The `accounts` table represents the Zwit account. Profiles represent public or operational personas used on the platform.

---

## 4. Enumerations

### 4.1 `account_status`

- `pending_onboarding`
- `active`
- `restricted`
- `suspended`
- `deletion_requested`
- `deleted`

### 4.2 `profile_type`

- `individual`
- `couple`
- `organizer`
- `professional`

Subtypes such as gender, orientation or establishment category must not be encoded in `profile_type`.

### 4.3 `profile_status`

- `draft`
- `pending_members`
- `pending_verification`
- `active`
- `hidden`
- `restricted`
- `suspended`
- `archived`
- `deleted`

### 4.4 `profile_membership_role`

- `owner`
- `co_owner`
- `manager`
- `contributor`
- `viewer`

### 4.5 `membership_status`

- `invited`
- `active`
- `declined`
- `revoked`
- `left`

### 4.6 `verification_level`

- `none`
- `email_verified`
- `phone_verified`
- `age_verified`
- `identity_verified`
- `enhanced_verified`

### 4.7 `sensitive_action_type`

- `activate_shared_profile`
- `change_shared_profile_identity`
- `change_shared_search_preferences`
- `change_shared_boundaries`
- `publish_joint_identifying_media`
- `grant_private_album_access`
- `add_profile_member`
- `remove_profile_member`
- `transfer_ownership`
- `hide_profile`
- `archive_profile`
- `delete_profile`

### 4.8 `approval_status`

- `pending`
- `approved`
- `rejected`
- `expired`
- `cancelled`
- `executed`

---

## 5. Tables

## 5.1 `accounts`

Canonical Zwit account attached to one authentication subject.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK, generated server-side |
| `auth_user_id` | `uuid` | no | Unique reference to Supabase Auth user |
| `status` | `account_status` | no | Default `pending_onboarding` |
| `primary_email` | `citext` | no | Unique normalized email |
| `email_verified_at` | `timestamptz` | yes | Provider-confirmed only |
| `phone_e164` | `text` | yes | Unique when present |
| `phone_verified_at` | `timestamptz` | yes | Provider-confirmed only |
| `verification_level` | `verification_level` | no | Default `none` |
| `onboarding_completed_at` | `timestamptz` | yes | Set only after mandatory account onboarding |
| `last_active_at` | `timestamptz` | yes | Operational signal, not audit evidence |
| `created_at` | `timestamptz` | no | Default `now()` |
| `updated_at` | `timestamptz` | no | Trigger-maintained |
| `deleted_at` | `timestamptz` | yes | Soft deletion timestamp |

Constraints:

- one `auth_user_id` maps to exactly one account;
- deleted accounts cannot create new memberships or profiles;
- `active` requires verified email, completed onboarding and age eligibility;
- `primary_email` is private and must never be exposed through public profile APIs.

Indexes:

- unique `accounts(auth_user_id)`;
- unique partial `accounts(phone_e164) where phone_e164 is not null and deleted_at is null`;
- `accounts(status)`;
- `accounts(last_active_at desc)` for internal operational use only.

---

## 5.2 `account_identities`

Private personal identity. One row per account.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `account_id` | `uuid` | no | PK and FK to `accounts.id` |
| `legal_first_name` | `text` | no | Encrypted at application or column level |
| `legal_last_name` | `text` | no | Encrypted |
| `date_of_birth` | `date` | no | Private, used for age eligibility |
| `country_code` | `char(2)` | no | ISO 3166-1 alpha-2 |
| `identity_gender` | `text` | yes | Private and optional; not reused as public profile gender |
| `verification_provider_subject` | `text` | yes | Token/reference only, no raw identity document |
| `created_at` | `timestamptz` | no | Default `now()` |
| `updated_at` | `timestamptz` | no | Trigger-maintained |

Rules:

- public profiles must use a display name or pseudonym, never legal names by default;
- raw identity documents must not be stored in this table;
- age eligibility is computed server-side and persisted separately as verification evidence;
- date of birth is not directly readable by other members of a shared profile.

---

## 5.3 `identity_verification_cases`

Tracks verification attempts and outcomes without exposing provider secrets.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `account_id` | `uuid` | no | FK to account |
| `provider` | `text` | no | Provider key |
| `provider_case_id` | `text` | no | Unique provider reference |
| `requested_level` | `verification_level` | no | Requested assurance level |
| `status` | `text` | no | `created`, `processing`, `approved`, `rejected`, `expired`, `cancelled` |
| `age_over_18_confirmed` | `boolean` | yes | Provider result |
| `identity_match_confirmed` | `boolean` | yes | Provider result |
| `failure_reason_code` | `text` | yes | Non-sensitive normalized code |
| `submitted_at` | `timestamptz` | yes | |
| `resolved_at` | `timestamptz` | yes | |
| `created_at` | `timestamptz` | no | Default `now()` |

Constraints:

- unique `(provider, provider_case_id)`;
- only trusted backend services may insert or update provider results;
- approval changes account verification level through a controlled domain service, never a direct client mutation.

---

## 5.4 `account_settings`

Private account-level preferences.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `account_id` | `uuid` | no | PK/FK |
| `locale` | `text` | no | Default `fr-FR` |
| `timezone` | `text` | no | IANA timezone |
| `marketing_email_opt_in` | `boolean` | no | Default false |
| `product_email_opt_in` | `boolean` | no | Default true where legally permitted |
| `push_opt_in` | `boolean` | no | Default false until device consent |
| `analytics_opt_in` | `boolean` | no | Consent-managed |
| `discoverability_default` | `boolean` | no | Default false |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Consent changes must also create an immutable consent event in the consent domain.

---

## 5.5 `profiles`

Core profile record. Business modules attach to this table through dedicated one-to-one or one-to-many tables.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `type` | `profile_type` | no | Immutable after activation except controlled migration |
| `status` | `profile_status` | no | Default `draft` |
| `display_name` | `text` | no | Public/pseudonymous name |
| `slug` | `citext` | no | Unique public slug |
| `short_bio` | `text` | yes | Moderated public text |
| `primary_locale` | `text` | no | Default `fr-FR` |
| `country_code` | `char(2)` | no | Public location country only |
| `is_discoverable` | `boolean` | no | Default false |
| `discoverable_since` | `timestamptz` | yes | Set when discoverability becomes effective |
| `created_by_account_id` | `uuid` | no | Audit provenance, not sole ownership |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |
| `archived_at` | `timestamptz` | yes | |
| `deleted_at` | `timestamptz` | yes | |

Activation requirements:

- at least one active owner membership;
- all mandatory profile modules completed;
- required identity/age verification satisfied;
- couple profiles have at least two active verified members;
- no blocking moderation restriction;
- explicit discoverability activation.

Indexes:

- unique `profiles(slug)` where `deleted_at is null`;
- `profiles(type, status)`;
- partial `profiles(is_discoverable, updated_at desc) where status = 'active' and deleted_at is null`;
- `profiles(created_by_account_id)`.

---

## 5.6 `profile_memberships`

Many-to-many relation between personal accounts and profiles.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK to profile |
| `account_id` | `uuid` | no | FK to account |
| `role` | `profile_membership_role` | no | |
| `status` | `membership_status` | no | Default `invited` |
| `invited_by_account_id` | `uuid` | yes | Required for invitations |
| `invited_at` | `timestamptz` | yes | |
| `accepted_at` | `timestamptz` | yes | Explicit acceptance time |
| `ended_at` | `timestamptz` | yes | For revoked/left memberships |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Constraints:

- unique `(profile_id, account_id)` for non-ended memberships;
- a user cannot activate their own invitation without a valid invitation token or server-authorized flow;
- an individual profile must have exactly one active `owner`;
- a couple profile must have at least two active members, including one `owner` and one `co_owner` or two equivalent co-owner permissions;
- professional accounts may support additional manager memberships later without changing the core model;
- removing the final valid owner is forbidden.

Indexes:

- `profile_memberships(account_id, status)`;
- `profile_memberships(profile_id, status, role)`;
- partial unique active membership index on `(profile_id, account_id)`.

---

## 5.7 `profile_role_permissions`

Static or seeded permission matrix. This table enables role evolution without page-level hardcoding.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `profile_type` | `profile_type` | no | Composite PK |
| `role` | `profile_membership_role` | no | Composite PK |
| `permission_key` | `text` | no | Composite PK |
| `allowed` | `boolean` | no | Default false |
| `requires_joint_approval` | `boolean` | no | Default false |

Initial permission keys:

- `profile.read_private`
- `profile.update_basic`
- `profile.update_personal_module`
- `profile.update_shared_preferences`
- `profile.manage_media`
- `profile.publish_joint_media`
- `profile.manage_private_album_access`
- `profile.manage_members`
- `profile.manage_messages`
- `profile.manage_visibility`
- `profile.archive`
- `profile.delete`
- `profile.transfer_ownership`

Code must evaluate permissions through a centralized authorization service.

---

## 5.8 `profile_sensitive_action_requests`

Represents mutations that require joint approval.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK |
| `action_type` | `sensitive_action_type` | no | |
| `requested_by_account_id` | `uuid` | no | Active authorized member |
| `payload` | `jsonb` | no | Validated proposed mutation, encrypted where required |
| `payload_hash` | `text` | no | Detects mutation after approvals |
| `status` | `approval_status` | no | Default `pending` |
| `required_approval_count` | `smallint` | no | Derived from policy snapshot |
| `expires_at` | `timestamptz` | no | Mandatory expiration |
| `executed_at` | `timestamptz` | yes | |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Rules:

- payload is immutable after first approval;
- expired requests cannot execute;
- a requester may count as an approver only if policy explicitly allows it;
- execution must occur transactionally after approval threshold is met;
- execution writes an audit event and marks the request `executed` in the same transaction.

---

## 5.9 `profile_sensitive_action_approvals`

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `request_id` | `uuid` | no | FK |
| `account_id` | `uuid` | no | Eligible active member |
| `decision` | `text` | no | `approved` or `rejected` |
| `decided_at` | `timestamptz` | no | |
| `decision_context` | `jsonb` | yes | Device/session risk metadata, no secrets |

Constraints:

- unique `(request_id, account_id)`;
- rejection cancels execution unless a specific policy defines otherwise;
- approvals by removed, suspended or ineligible members are invalidated before execution.

---

## 5.10 `profile_lifecycle_events`

Immutable history of important profile state changes.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK |
| `event_type` | `text` | no | Normalized event key |
| `actor_account_id` | `uuid` | yes | Null for trusted system event |
| `from_status` | `profile_status` | yes | |
| `to_status` | `profile_status` | yes | |
| `metadata` | `jsonb` | no | Default `{}` |
| `created_at` | `timestamptz` | no | Immutable |

Examples:

- `profile.created`
- `profile.member_invited`
- `profile.member_joined`
- `profile.activated`
- `profile.hidden`
- `profile.suspended`
- `profile.member_left`
- `profile.archived`
- `profile.deletion_requested`
- `profile.deleted`

---

## 6. Couple profile rules

### 6.1 Creation workflow

1. Account A creates a draft couple profile.
2. Account A becomes `owner` with active membership.
3. Account A invites Account B using a time-limited invitation.
4. Account B authenticates with their own account.
5. Account B explicitly accepts the invitation.
6. Account B becomes `co_owner`.
7. Both accounts must satisfy required age and identity verification.
8. Both complete their personal profile modules and shared couple modules.
9. A joint activation request is approved.
10. The profile becomes `active`, but remains non-discoverable until visibility is explicitly enabled.

### 6.2 Daily actions

Either owner may, subject to permissions:

- reply to conversations;
- manage favorites;
- update non-sensitive presentation text;
- maintain availability;
- manage ordinary media that does not identify the other partner;
- review notifications and profile activity.

### 6.3 Joint approval actions

The default V1 policy requires approval from both active owners for:

- changing shared identity or couple display framing;
- changing shared searches, practices or limits;
- publishing clearly identifying joint media;
- granting access to a private album containing both members;
- adding or removing a member;
- hiding, archiving or deleting the profile;
- transferring ownership.

### 6.4 Separation or departure

When one partner leaves:

- the departing account keeps its personal account and individual profiles;
- its shared-profile membership becomes `left`;
- private access tokens granted through that membership are revoked;
- pending approvals involving the departing account are cancelled;
- the couple profile immediately becomes `hidden` and non-discoverable;
- the remaining member may archive the profile but may not silently replace the departing partner;
- adding a new partner requires a new invitation and a new shared activation workflow;
- historical messages and audit evidence are retained according to legal and retention rules, but no longer appear as an active couple identity.

---

## 7. Row Level Security model

RLS is mandatory for all user-addressable tables.

### 7.1 Account tables

- a user may select their own `accounts` row;
- a user may select/update their own `account_settings` row;
- direct client access to `account_identities` must be restricted to narrowly scoped read/update RPCs;
- verification cases are readable only by the account owner and privileged trust/admin services;
- clients cannot set verification outcomes or account status directly.

### 7.2 Profiles

Public profile reads use a sanitized discoverable view, not direct unrestricted table access.

A profile member may read private profile data only if:

- membership is `active`;
- account is not suspended or deleted;
- profile is not deleted;
- the requested module permission is granted.

### 7.3 Memberships

- members may read memberships for profiles they belong to;
- invited users may read only the invitation addressed to them;
- membership creation, role changes and removals pass through controlled server-side functions;
- no client may directly promote itself to owner/co-owner.

### 7.4 Sensitive approvals

- eligible profile owners may read pending requests for their profile;
- only eligible approvers may create one decision;
- request execution is backend-only;
- approval payloads are never exposed publicly.

---

## 8. Public profile projection

The application must not expose `profiles` directly as the public contract. Create a sanitized database view or API projection such as `public_profile_view` containing only approved fields:

- profile id;
- display name;
- type;
- public biography;
- coarse location;
- approved public modules;
- trust badges intended for public display;
- public media cover reference;
- public activity signals permitted by privacy settings.

The projection must exclude:

- account ids;
- legal identity;
- exact date of birth;
- email and phone;
- internal moderation state;
- verification provider data;
- private membership details;
- private location coordinates;
- audit and security metadata.

---

## 9. Lifecycle and deletion

### 9.1 Account deletion request

1. Account enters `deletion_requested`.
2. New logins and sensitive actions may be restricted.
3. Active profile memberships are evaluated.
4. Individual profiles are hidden immediately.
5. Shared profiles follow shared-profile departure rules.
6. A retention timer starts according to the legal retention policy.
7. Personal data is deleted or irreversibly anonymized after the retention period unless a legal hold applies.

### 9.2 Profile deletion

- profile deletion is always soft first;
- discoverability is disabled immediately;
- media access grants are revoked;
- public search documents are deleted asynchronously;
- financial, consent, moderation and security evidence may be retained separately where legally required;
- reactivation after final deletion is forbidden; a new profile must be created.

---

## 10. Transaction boundaries

The following operations must be atomic database transactions:

- account activation after successful verification;
- invitation acceptance and role assignment;
- couple profile activation;
- sensitive request approval threshold and mutation execution;
- member departure and immediate profile hiding;
- profile deletion and access revocation;
- ownership transfer;
- account deletion initiation and profile visibility shutdown.

---

## 11. Required domain services

Application pages and UI components must not implement these rules directly.

Required services:

- `AccountService`
- `IdentityVerificationService`
- `ProfileService`
- `ProfileMembershipService`
- `ProfileAuthorizationService`
- `SensitiveActionApprovalService`
- `ProfileLifecycleService`
- `AccountDeletionService`

Each service must expose typed commands and return typed domain errors.

---

## 12. Initial API / server command contracts

```ts
createIndividualProfile(input)
createCoupleProfile(input)
inviteProfileMember(profileId, invitee)
acceptProfileInvitation(invitationToken)
updateProfileBasicInformation(profileId, input)
requestSensitiveProfileAction(profileId, actionType, payload)
approveSensitiveProfileAction(requestId)
rejectSensitiveProfileAction(requestId)
leaveSharedProfile(profileId)
activateProfile(profileId)
setProfileDiscoverability(profileId, enabled)
requestProfileDeletion(profileId)
requestAccountDeletion()
```

All commands require server-side authorization and schema validation.

---

## 13. Acceptance criteria

DB-01 is implemented only when all criteria below pass:

1. A person cannot create two accounts for the same auth subject.
2. Two partners can join one couple profile using separate logins.
3. A couple profile cannot activate with only one verified member.
4. No member can self-promote to owner through a direct database mutation.
5. Sensitive actions cannot execute before the required approvals exist.
6. A changed payload invalidates previous approvals.
7. A partner leaving immediately hides the couple profile.
8. Leaving a couple profile does not delete the person's account.
9. Public APIs never expose legal identity or account contact data.
10. All status transitions create lifecycle and audit evidence.
11. Deleted or suspended accounts cannot approve pending actions.
12. RLS prevents reading another account's private identity data.
13. Profile activation and discoverability are separate operations.
14. All critical operations are covered by integration tests using two distinct authenticated users.

---

## 14. Required tests

### Unit tests

- permission matrix evaluation;
- approval threshold calculation;
- profile activation eligibility;
- account status transition validation;
- profile status transition validation;
- verification-level promotion rules.

### Integration tests

- create and activate individual profile;
- create couple profile and accept partner invitation;
- reject invitation;
- expire invitation;
- approve joint sensitive action;
- reject joint sensitive action;
- partner leaves active couple profile;
- suspended partner attempts approval;
- unauthorized account attempts membership read;
- public profile projection data-leak test;
- account deletion with individual and shared profiles.

### Security tests

- RLS cross-account isolation;
- privilege escalation through role mutation;
- replay of invitation token;
- replay of sensitive-action approval;
- approval after payload replacement;
- direct update of verification result;
- enumeration of private profile memberships.

---

## 15. Migration order

1. PostgreSQL extensions and enums.
2. `accounts`.
3. `account_identities`.
4. `identity_verification_cases`.
5. `account_settings`.
6. `profiles`.
7. `profile_memberships`.
8. `profile_role_permissions`.
9. `profile_sensitive_action_requests`.
10. `profile_sensitive_action_approvals`.
11. `profile_lifecycle_events`.
12. indexes and constraints.
13. RLS policies.
14. public sanitized profile projection.
15. seed role/permission matrix.
16. integration and security tests.

---

## 16. Codex execution rule

Codex must not generate UI for this domain before:

- migrations compile;
- constraints are tested;
- RLS tests pass;
- service interfaces exist;
- sensitive-action workflows pass integration tests.

No business rule from this document may be implemented solely in a page, React component or client-side state.

---

## 17. Deferred decisions

These topics are intentionally excluded from DB-01 and will be covered in later database chapters:

- detailed gender, orientation and relationship-model taxonomy;
- practices, searches, limits and consent compatibility;
- media, albums and access grants;
- conversations and messaging identity;
- precise geolocation and proximity search;
- subscriptions and entitlement sharing;
- professional legal entities and staff management;
- reputation, reviews and trust scoring;
- moderation, reporting and sanctions;
- full GDPR retention matrix.

---

## 18. Definition of done

This chapter becomes **Accepted** when:

- product governance validates the rules;
- architecture review validates the model boundaries;
- security review validates RLS and sensitive-action flows;
- the corresponding SQL/Prisma implementation PR passes all automated tests;
- no unresolved blocker remains in the decision registry.
