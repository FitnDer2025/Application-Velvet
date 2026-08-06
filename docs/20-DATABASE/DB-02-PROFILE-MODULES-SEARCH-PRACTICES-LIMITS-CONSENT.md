# Zwit Database Bible — DB-02

## Profile modules, searches, practices, limits and consent

**Status:** Proposed for validation  
**Version:** 1.0  
**Scope:** Community Core  
**Applies to:** Individual and Couple profiles; reusable by Organizer and Professional profiles where relevant  
**Related decisions:** DB-01, ADR-DATA-046, V1 Dual Platform Scope, Target Architecture V1

---

## 1. Purpose

This document defines the canonical data model for the modular content of a Zwit profile:

- public presentation;
- public and private demographic attributes;
- relationship and orientation descriptors;
- search intentions;
- practices and interests;
- boundaries and non-negotiable limits;
- consent preferences;
- availability and meeting context;
- profile completeness and discoverability eligibility;
- versioning, moderation and audit requirements.

This document is normative. Application code, API contracts, migrations, recommendation logic and tests must conform to it.

---

## 2. Locked product principles

1. A Zwit profile is composed of independent domain modules attached to `profiles.id`.
2. Sensitive personal data must not be stored as an unstructured profile blob.
3. Search preferences are distinct from identity and presentation data.
4. A declared practice is never equivalent to consent for a specific interaction.
5. A profile may express interest, curiosity, experience, acceptance, refusal or non-disclosure independently.
6. Couple profiles may contain shared attributes and member-specific attributes.
7. Shared boundaries and search preferences require the governance rules defined in DB-01.
8. Public visibility is field-level and purpose-specific, not only profile-level.
9. Exact private answers must not be exposed when a coarse derived value is sufficient.
10. Recommendation systems may use only data whose processing purpose and consent status allow it.
11. No profile may become discoverable while mandatory modules are incomplete or contradictory.
12. Every sensitive change must be versioned and auditable.

---

## 3. Domain boundaries

```text
profiles
├── profile_presentations
├── profile_member_attributes
├── profile_relationship_contexts
├── profile_search_intents
├── profile_search_targets
├── profile_practice_preferences
├── profile_boundaries
├── profile_consent_preferences
├── profile_availability_preferences
├── profile_visibility_rules
├── profile_module_states
└── profile_attribute_change_log

reference catalogs
├── gender_catalog
├── orientation_catalog
├── relationship_style_catalog
├── practice_catalog
├── boundary_catalog
├── meeting_context_catalog
└── language_catalog
```

Reference catalogs are curated taxonomies. They are not free-text user-generated values.

---

## 4. Modeling rule: structured columns before JSON

JSONB may be used only for:

- localized display metadata in reference catalogs;
- non-critical presentation configuration;
- future provider-specific metadata that does not drive authorization or matching.

JSONB must not be used as the primary storage for:

- gender;
- orientation;
- practices;
- boundaries;
- search targets;
- consent;
- visibility;
- moderation status;
- compatibility inputs.

These values require relational rows, constraints, indexes, auditability and field-level access control.

---

## 5. Enumerations

### 5.1 `module_status`

- `not_started`
- `in_progress`
- `complete`
- `needs_review`
- `blocked`

### 5.2 `visibility_scope`

- `private`
- `profile_members`
- `matched_profiles`
- `approved_contacts`
- `authenticated_members`
- `public`

`public` must be exceptional. Sensitive community profile data must never default to public web visibility.

### 5.3 `preference_level`

- `not_disclosed`
- `not_interested`
- `curious`
- `interested`
- `experienced`
- `preferred`

### 5.4 `boundary_level`

- `not_disclosed`
- `soft_limit`
- `hard_limit`
- `context_dependent`

### 5.5 `search_intent_status`

- `inactive`
- `active`
- `paused`
- `expired`
- `archived`

### 5.6 `interaction_pace`

- `discussion_first`
- `feeling_led`
- `open_to_fast_meeting`
- `event_only`
- `not_disclosed`

### 5.7 `experience_level`

- `discovering`
- `beginner`
- `occasional`
- `regular`
- `experienced`
- `not_disclosed`

### 5.8 `consent_answer`

- `yes`
- `no`
- `ask_each_time`
- `not_disclosed`

### 5.9 `profile_attribute_subject_type`

- `profile`
- `profile_member`

---

## 6. Reference catalogs

All catalogs must include at minimum:

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `code` | `citext` | Stable unique machine code |
| `label_i18n` | `jsonb` | Localized labels only |
| `description_i18n` | `jsonb` | Optional explanatory text |
| `is_active` | `boolean` | Default true |
| `sort_order` | `integer` | UI ordering |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Catalog codes are immutable once referenced by production data. Deprecated values become inactive; they are not deleted.

### 6.1 Required catalogs

- `gender_catalog`
- `orientation_catalog`
- `relationship_style_catalog`
- `practice_catalog`
- `boundary_catalog`
- `meeting_context_catalog`
- `language_catalog`

### 6.2 `practice_catalog` additional fields

| Column | Type | Null | Rules |
|---|---|---:|---|
| `category_code` | `citext` | no | Grouping taxonomy |
| `sensitivity_level` | `smallint` | no | 1 to 3 |
| `requires_explicit_display_consent` | `boolean` | no | Default true for intimate data |
| `allowed_for_matching` | `boolean` | no | Controlled by product/legal review |
| `minimum_age` | `smallint` | no | Must be 18 or above |

### 6.3 `boundary_catalog` additional fields

| Column | Type | Null | Rules |
|---|---|---:|---|
| `category_code` | `citext` | no | Grouping taxonomy |
| `sensitivity_level` | `smallint` | no | 1 to 3 |
| `matching_exclusion_capable` | `boolean` | no | Whether a hard limit can exclude candidates |

---

## 7. Tables

## 7.1 `profile_presentations`

One-to-one presentation module for each profile.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `profile_id` | `uuid` | no | PK/FK to `profiles.id` |
| `headline` | `text` | yes | Moderated; max length enforced |
| `about` | `text` | yes | Moderated rich plain text; no raw HTML |
| `experience_level` | `experience_level` | no | Default `not_disclosed` |
| `interaction_pace` | `interaction_pace` | no | Default `not_disclosed` |
| `languages_summary` | `text` | yes | Derived/cache only; source is relational |
| `moderation_status` | `text` | no | `pending`, `approved`, `rejected`, `needs_review` |
| `moderation_reason_code` | `text` | yes | Internal normalized code |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Rules:

- text is sanitized server-side;
- public rendering requires approved moderation status;
- rejected content remains visible only to authorized profile members and moderators;
- presentation text must never contain direct contact details when platform policy forbids off-platform solicitation.

---

## 7.2 `profile_member_attributes`

Member-specific attributes inside individual or shared profiles.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK to profile |
| `membership_id` | `uuid` | no | FK to active `profile_memberships.id` |
| `display_alias` | `text` | yes | Optional member-specific pseudonym |
| `birth_year` | `smallint` | yes | Derived from verified DOB; never client-trusted |
| `age_display_mode` | `text` | no | `exact_age`, `age_range`, `hidden` |
| `height_cm` | `smallint` | yes | Optional, validated range |
| `body_type_code` | `citext` | yes | Curated catalog to be defined separately |
| `smoking_status` | `text` | yes | Optional curated enum |
| `alcohol_status` | `text` | yes | Optional curated enum |
| `is_publicly_visible` | `boolean` | no | Default true for active profile member card |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Constraints:

- unique `(profile_id, membership_id)`;
- membership must belong to the same profile;
- `birth_year` is controlled by trusted backend logic;
- exact date of birth remains in DB-01 private identity storage;
- shared profile members cannot edit another member's personal attributes unless explicitly delegated and the field is not identity-derived.

---

## 7.3 `profile_member_genders`

Allows one or more curated gender descriptors per profile member.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `profile_member_attribute_id` | `uuid` | no | FK |
| `gender_id` | `uuid` | no | FK to catalog |
| `is_primary` | `boolean` | no | Default false |
| `visibility_scope` | `visibility_scope` | no | Default `authenticated_members` |
| `created_at` | `timestamptz` | no | |

Primary key: `(profile_member_attribute_id, gender_id)`.

At most one active primary gender descriptor per member.

---

## 7.4 `profile_member_orientations`

| Column | Type | Null | Rules |
|---|---|---:|---|
| `profile_member_attribute_id` | `uuid` | no | FK |
| `orientation_id` | `uuid` | no | FK to catalog |
| `is_primary` | `boolean` | no | Default false |
| `visibility_scope` | `visibility_scope` | no | Default `authenticated_members` |
| `use_for_matching` | `boolean` | no | Default false until explicit consent |
| `created_at` | `timestamptz` | no | |

Primary key: `(profile_member_attribute_id, orientation_id)`.

Orientation data is sensitive personal data. Matching use requires an explicit lawful processing basis and consent record where required.

---

## 7.5 `profile_relationship_contexts`

Describes the relationship structure presented by the profile.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK |
| `relationship_style_id` | `uuid` | no | FK to catalog |
| `is_primary` | `boolean` | no | Default false |
| `since_year` | `smallint` | yes | Optional coarse value |
| `visibility_scope` | `visibility_scope` | no | |
| `created_at` | `timestamptz` | no | |

Unique `(profile_id, relationship_style_id)`.

---

## 7.6 `profile_languages`

| Column | Type | Null | Rules |
|---|---|---:|---|
| `profile_id` | `uuid` | no | FK |
| `language_id` | `uuid` | no | FK to catalog |
| `proficiency` | `text` | no | `basic`, `conversational`, `fluent`, `native` |
| `created_at` | `timestamptz` | no | |

Primary key: `(profile_id, language_id)`.

---

## 7.7 `profile_search_intents`

A profile may maintain several explicit search intents but only one default active intent per context.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK |
| `name` | `text` | no | Member-facing label, e.g. `Rencontres principales` |
| `status` | `search_intent_status` | no | Default `inactive` |
| `is_default` | `boolean` | no | Default false |
| `description` | `text` | yes | Optional moderated text |
| `interaction_pace` | `interaction_pace` | no | |
| `distance_radius_km` | `integer` | yes | Search preference, not exact location |
| `minimum_age` | `smallint` | yes | Must be >= 18 |
| `maximum_age` | `smallint` | yes | Must be >= minimum |
| `allow_outside_radius` | `boolean` | no | Default false |
| `use_for_recommendations` | `boolean` | no | Default true when active |
| `valid_from` | `timestamptz` | yes | |
| `valid_until` | `timestamptz` | yes | |
| `created_by_account_id` | `uuid` | no | Audit provenance |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Constraints:

- partial unique default intent per profile where `is_default = true` and status is active or paused;
- age bounds must be internally coherent;
- sensitive shared-profile changes use DB-01 approval workflow;
- expired intents cannot drive discovery or recommendations.

---

## 7.8 `profile_search_targets`

Defines which profile types and compositions are sought.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `search_intent_id` | `uuid` | no | FK |
| `target_profile_type` | `profile_type` | no | `individual`, `couple`, `organizer`, `professional` |
| `target_gender_id` | `uuid` | yes | Optional catalog FK for individual/member composition |
| `target_orientation_id` | `uuid` | yes | Optional and sensitive |
| `priority` | `smallint` | no | 1 to 5 |
| `is_required` | `boolean` | no | Hard filter when true |
| `created_at` | `timestamptz` | no | |

Rules:

- target orientation must not be inferred from gender;
- a search target may be broad without specifying gender or orientation;
- hard filters must be clearly identified to the user;
- no protected or sensitive criterion may be used without approved product/legal basis.

---

## 7.9 `profile_practice_preferences`

Stores declared profile-level practice preferences.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK |
| `practice_id` | `uuid` | no | FK to catalog |
| `preference_level` | `preference_level` | no | |
| `experience_note` | `text` | yes | Private or restricted, moderated if displayed |
| `visibility_scope` | `visibility_scope` | no | Default `matched_profiles` |
| `use_for_matching` | `boolean` | no | Default false for sensitive values |
| `set_by_account_id` | `uuid` | no | Audit provenance |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Unique `(profile_id, practice_id)`.

Rules:

- `not_interested` is not automatically a hard limit;
- `curious`, `interested`, `experienced` and `preferred` describe preference only;
- preference data cannot authorize messages, media access or physical interaction;
- shared-profile changes may require joint approval according to sensitivity and DB-01 governance.

---

## 7.10 `profile_member_practice_preferences`

Member-specific practice preference within a shared profile.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_member_attribute_id` | `uuid` | no | FK |
| `practice_id` | `uuid` | no | FK |
| `preference_level` | `preference_level` | no | |
| `visibility_scope` | `visibility_scope` | no | |
| `use_for_matching` | `boolean` | no | Default false |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Unique `(profile_member_attribute_id, practice_id)`.

Only the associated account, or an explicitly authorized delegate, may modify member-specific preferences.

---

## 7.11 `profile_boundaries`

Canonical shared profile limits.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK |
| `boundary_id` | `uuid` | no | FK to catalog |
| `boundary_level` | `boundary_level` | no | |
| `context_note` | `text` | yes | Restricted visibility; no raw HTML |
| `visibility_scope` | `visibility_scope` | no | Default `approved_contacts` |
| `use_as_matching_exclusion` | `boolean` | no | Allowed only for hard limits and compatible catalog entries |
| `set_by_account_id` | `uuid` | no | |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Unique `(profile_id, boundary_id)`.

Rules:

- hard limits override positive preferences in recommendation filtering;
- changing shared hard limits requires the sensitive approval workflow for Couple profiles;
- a hidden hard limit may still be used as an exclusion without revealing the underlying reason to another user;
- matching output must not expose which private limit caused exclusion.

---

## 7.12 `profile_member_boundaries`

Personal limits of an individual profile member.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_member_attribute_id` | `uuid` | no | FK |
| `boundary_id` | `uuid` | no | FK |
| `boundary_level` | `boundary_level` | no | |
| `visibility_scope` | `visibility_scope` | no | Default `profile_members` |
| `use_as_matching_exclusion` | `boolean` | no | Default true for hard limits where permitted |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Unique `(profile_member_attribute_id, boundary_id)`.

Personal hard limits always take precedence over shared profile preferences. A shared profile may not advertise compatibility with a practice that conflicts with an active member hard limit.

---

## 7.13 `profile_consent_preferences`

Standing communication and platform-interaction preferences. This table does not represent consent to intimate activity.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `profile_id` | `uuid` | no | PK/FK |
| `allow_messages_from_discovery` | `consent_answer` | no | Default `ask_each_time` |
| `allow_album_requests` | `consent_answer` | no | Default `ask_each_time` |
| `allow_event_invitations` | `consent_answer` | no | Default `ask_each_time` |
| `allow_location_sharing_requests` | `consent_answer` | no | Default `no` |
| `allow_video_call_requests` | `consent_answer` | no | Default `ask_each_time` |
| `allow_recommendation_processing` | `consent_answer` | no | Default `no` until explicit choice |
| `allow_sensitive_data_matching` | `consent_answer` | no | Default `no` |
| `updated_by_account_id` | `uuid` | no | |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Rules:

- every consent change creates an immutable consent event;
- `yes` may be withdrawn at any time;
- withdrawal stops future processing but does not erase legally retained audit evidence;
- shared profiles use the most restrictive active member setting for sensitive processing unless all required members explicitly agree;
- a standing preference never replaces contextual consent during an actual interaction.

---

## 7.14 `profile_member_consent_preferences`

Personal consent-processing choices within a shared profile.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `profile_member_attribute_id` | `uuid` | no | PK/FK |
| `allow_sensitive_data_matching` | `consent_answer` | no | Default `no` |
| `allow_public_member_attributes` | `consent_answer` | no | Default `ask_each_time` |
| `allow_joint_media_publication` | `consent_answer` | no | Default `ask_each_time` |
| `allow_profile_activity_analytics` | `consent_answer` | no | Default `no` |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Only the associated account may update these choices. No co-owner can override another member's personal consent.

---

## 7.15 `profile_availability_preferences`

General availability without publishing a precise live schedule.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK |
| `day_of_week` | `smallint` | yes | 1 to 7; null for ad hoc windows |
| `time_period` | `text` | no | `morning`, `afternoon`, `evening`, `night`, `flexible` |
| `meeting_context_id` | `uuid` | yes | FK to catalog |
| `valid_from` | `date` | yes | |
| `valid_until` | `date` | yes | |
| `visibility_scope` | `visibility_scope` | no | Default `matched_profiles` |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Availability is indicative and must not reveal home address, exact recurring location or real-time presence.

---

## 7.16 `profile_visibility_rules`

Field/module-level visibility policy.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK |
| `resource_type` | `text` | no | Approved domain key |
| `resource_id` | `uuid` | yes | Null for module default |
| `field_key` | `text` | yes | Null for entire resource |
| `visibility_scope` | `visibility_scope` | no | |
| `created_by_account_id` | `uuid` | no | |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Constraints:

- unique `(profile_id, resource_type, resource_id, field_key)` with normalized null handling;
- resource and field keys must come from a server-side allowlist;
- visibility cannot exceed legal/product maximum for the field;
- client-provided resource types must never be trusted directly.

---

## 7.17 `profile_module_states`

Tracks onboarding and eligibility status per module.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `profile_id` | `uuid` | no | Composite PK |
| `module_key` | `citext` | no | Composite PK; allowlisted |
| `status` | `module_status` | no | |
| `completion_percent` | `smallint` | no | 0 to 100 |
| `blocking_reason_code` | `text` | yes | |
| `last_validated_at` | `timestamptz` | yes | |
| `updated_at` | `timestamptz` | no | |

Mandatory V1 module keys for Community profiles:

- `presentation`
- `members`
- `identity_descriptors`
- `search_intent`
- `practices`
- `boundaries`
- `consent_preferences`
- `visibility`

A discoverable profile requires every mandatory module to be `complete`, except modules explicitly marked optional by profile type policy.

---

## 7.18 `profile_attribute_change_log`

Immutable domain audit for sensitive profile changes.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK |
| `subject_type` | `profile_attribute_subject_type` | no | |
| `subject_id` | `uuid` | no | Profile or member-attribute ID |
| `resource_type` | `text` | no | Domain allowlist |
| `resource_id` | `uuid` | yes | |
| `field_key` | `text` | yes | |
| `change_type` | `text` | no | `created`, `updated`, `deleted`, `visibility_changed`, `consent_changed` |
| `old_value_hash` | `text` | yes | Hash only for highly sensitive values |
| `new_value_hash` | `text` | yes | Hash only for highly sensitive values |
| `actor_account_id` | `uuid` | no | |
| `approval_request_id` | `uuid` | yes | Link to DB-01 sensitive action |
| `created_at` | `timestamptz` | no | Immutable |

Raw sensitive before/after values must not be copied into general audit logs.

---

## 8. Profile completeness and activation

### 8.1 Individual profile

Minimum activation rules:

- one active owner membership;
- verified adult account;
- approved presentation;
- at least one public or authenticated-member-visible identity descriptor;
- one active default search intent;
- explicit practices review, including the option to disclose none;
- explicit boundaries review, including the option to disclose none;
- consent-processing choices completed;
- visibility review completed.

### 8.2 Couple profile

Additional rules:

- at least two active verified profile members;
- member attributes completed by each associated account;
- no unresolved contradiction between shared practice preference and personal hard limit;
- shared search intent approved according to DB-01 governance;
- sensitive matching enabled only when every required member has explicitly consented;
- member visibility choices respected individually.

### 8.3 Contradiction examples

Profile cannot become or remain discoverable when:

- shared practice is `preferred` while an active member marks the corresponding boundary as `hard_limit`;
- search target age range includes people under 18;
- a profile claims an identity composition inconsistent with active profile memberships;
- consent for sensitive matching is withdrawn but sensitive matching remains enabled;
- mandatory moderated presentation is rejected.

A validation service must return normalized blocking reason codes, never ad hoc UI-only strings.

---

## 9. Matching and recommendation precedence

The evaluation order is mandatory:

1. account/profile eligibility;
2. blocks, reports and moderation restrictions;
3. age and legal eligibility;
4. mutual search-target compatibility;
5. personal hard limits;
6. shared hard limits;
7. explicit consent for sensitive-data processing;
8. distance and availability preferences;
9. positive preferences and affinity signals;
10. ranking and diversity rules.

A positive preference can never override a hard limit, block, consent withdrawal or moderation restriction.

Compatibility output must expose only user-safe explanations such as:

- `recherches réciproques`;
- `préférences communes`;
- `rythme compatible`;
- `disponibilités proches`.

It must not reveal hidden orientation, private limits, rejected search criteria or other sensitive data.

---

## 10. Permission model

### 10.1 Profile-level attributes

- active owner/co-owner may manage non-sensitive shared presentation;
- shared search intentions, boundaries and sensitive-data matching require DB-01 approval rules;
- managers may edit only permission-allowlisted fields;
- viewers cannot mutate.

### 10.2 Member-level attributes

- associated account controls identity descriptors, personal practices, personal boundaries and personal consent;
- delegation is allowed only for non-sensitive presentation fields and must be explicit;
- no shared-profile role permits overriding another member's hard limit or consent choice.

### 10.3 Moderator access

Moderators receive purpose-limited access:

- moderation text and visibility state;
- normalized report context;
- minimum data necessary to decide.

Moderators do not receive unrestricted access to private practices, orientations or consent history without a specific authorized workflow.

---

## 11. Row-Level Security requirements

RLS must be enabled on every user-data table in this chapter.

Required policy principles:

- profile members can read shared profile data according to membership role and status;
- member-specific sensitive rows are readable by the associated account and authorized trusted services only;
- other profiles receive only data projected through an authorized visibility-aware read model;
- direct client access to raw matching inputs is forbidden;
- catalog tables are read-only to clients;
- audit and consent event tables are append-only through trusted backend functions;
- inactive, suspended or deleted profiles are excluded from public discovery projections;
- service-role bypass is limited to named server-side operations and audited.

Public profile screens must query a dedicated secure view or backend projection. They must not directly join raw sensitive tables from the client.

---

## 12. Indexes

Minimum indexes:

- `profile_member_attributes(profile_id)`;
- unique `profile_member_attributes(profile_id, membership_id)`;
- `profile_search_intents(profile_id, status)`;
- partial unique default active/paused search intent per profile;
- `profile_search_targets(search_intent_id, target_profile_type)`;
- unique `profile_practice_preferences(profile_id, practice_id)`;
- `profile_practice_preferences(practice_id, preference_level)` only where matching use is allowed;
- unique `profile_member_practice_preferences(profile_member_attribute_id, practice_id)`;
- unique `profile_boundaries(profile_id, boundary_id)`;
- unique `profile_member_boundaries(profile_member_attribute_id, boundary_id)`;
- `profile_availability_preferences(profile_id, day_of_week)`;
- unique `profile_module_states(profile_id, module_key)`;
- `profile_attribute_change_log(profile_id, created_at desc)`;
- GIN/trigram index for approved presentation search only if product scope explicitly requires it.

Sensitive-data indexes must be justified by a real query plan. Do not index encrypted raw identity values for convenience.

---

## 13. Retention and deletion

- active profile module data is retained while the profile is active;
- archived profile data is excluded from discovery immediately;
- deleted profile data follows DB-10 retention and anonymization policy;
- consent evidence is retained for the legally required audit period;
- sensitive matching inputs must be removed or anonymized when their processing purpose expires;
- deprecated catalog entries remain for historical referential integrity;
- raw text rejected by moderation must have a defined retention window and not remain indefinitely by default.

---

## 14. Domain services

Required server-side services:

- `ProfilePresentationService`
- `ProfileMemberAttributeService`
- `ProfileSearchIntentService`
- `ProfilePracticeService`
- `ProfileBoundaryService`
- `ProfileConsentService`
- `ProfileVisibilityService`
- `ProfileCompletenessService`
- `ProfileCompatibilityEligibilityService`
- `ProfileModuleAuditService`

No page or client component may implement these rules directly.

---

## 15. Command contracts

Minimum commands:

- `UpdateProfilePresentation`
- `UpsertProfileMemberAttributes`
- `SetMemberGenderDescriptors`
- `SetMemberOrientationDescriptors`
- `CreateSearchIntent`
- `ActivateSearchIntent`
- `UpdateSearchTargets`
- `SetProfilePracticePreference`
- `SetMemberPracticePreference`
- `SetProfileBoundary`
- `SetMemberBoundary`
- `UpdateProfileConsentPreferences`
- `UpdateMemberConsentPreferences`
- `UpdateProfileVisibilityRule`
- `ValidateProfileCompleteness`

Each command must include:

- authenticated actor account ID from server context;
- target profile ID;
- expected version or `updated_at` for optimistic concurrency where relevant;
- idempotency key for sensitive multi-step actions;
- normalized authorization result;
- audit correlation ID.

Client-provided actor IDs are forbidden.

---

## 16. Transactions

The following operations must be transactional:

1. update shared hard boundary + create approval request + audit record;
2. approve shared search intent + activate it + deactivate previous default + recompute module state;
3. withdraw sensitive matching consent + disable matching flags + invalidate recommendation cache + record consent event;
4. change member hard limit + detect shared contradiction + hide affected preference from matching + recompute discoverability eligibility;
5. update presentation + submit moderation state + update module state.

---

## 17. Events

Minimum domain events:

- `ProfilePresentationUpdated`
- `ProfilePresentationModerationRequested`
- `ProfileMemberAttributesUpdated`
- `ProfileSearchIntentActivated`
- `ProfileSearchPreferencesChanged`
- `ProfilePracticePreferenceChanged`
- `ProfileBoundaryChanged`
- `ProfileConsentChanged`
- `ProfileVisibilityChanged`
- `ProfileCompletenessChanged`
- `ProfileDiscoverabilityBlocked`
- `RecommendationEligibilityChanged`

Events must contain identifiers and normalized metadata, not raw sensitive values.

---

## 18. Acceptance criteria

DB-02 is accepted when:

1. every profile module has a canonical relational model;
2. personal and shared attributes are technically separated;
3. practices, boundaries and consent are distinct domains;
4. couple-member hard limits override shared positive preferences;
5. field-level visibility can be enforced server-side;
6. sensitive matching cannot run without required consent;
7. mandatory module completeness can be calculated deterministically;
8. contradictions block discoverability or matching safely;
9. all sensitive mutations produce audit evidence;
10. RLS tests prove that unrelated accounts cannot read raw sensitive rows;
11. recommendation explanations cannot leak private exclusion reasons;
12. the model supports future catalog extension without schema changes.

---

## 19. Test plan

### 19.1 Unit tests

- validate age ranges;
- validate visibility scope transitions;
- calculate module completeness;
- detect practice/boundary contradictions;
- calculate most-restrictive consent for Couple profile;
- verify hard-limit precedence;
- validate catalog code and activity state;
- validate optimistic concurrency.

### 19.2 Integration tests

- create and activate an individual search intent;
- create a Couple profile with distinct member attributes;
- reject activation when one member has not completed consent choices;
- submit a shared boundary change through approval workflow;
- withdraw member consent and invalidate recommendation eligibility;
- update presentation and require moderation before public projection;
- archive profile and remove it from discovery projection.

### 19.3 RLS and security tests

- unrelated account cannot read member orientations;
- co-owner cannot modify partner personal hard limits;
- client cannot set `birth_year` directly from an unverified value;
- client cannot enable matching use without consent workflow;
- public projection hides private fields;
- hidden hard-limit exclusion does not leak in API response;
- moderator access is purpose-limited;
- service-role operations create audit evidence.

### 19.4 Property-based tests

- no combination of positive preferences can override a hard limit;
- any consent withdrawal results in disabled future sensitive processing;
- every discoverable profile satisfies all mandatory module invariants;
- visibility projection never returns a field above its configured scope.

---

## 20. Migration order

1. create enumerations;
2. create reference catalogs;
3. seed immutable catalog codes;
4. create presentation and member attribute tables;
5. create gender, orientation, relationship and language relations;
6. create search intent and target tables;
7. create practice and boundary tables;
8. create consent and availability tables;
9. create visibility and module state tables;
10. create immutable change log;
11. add constraints and indexes;
12. enable RLS and policies;
13. create secure profile projection views/functions;
14. add validation triggers only where database enforcement is essential;
15. run security and migration tests.

---

## 21. Codex implementation instructions

Codex must:

- implement DB-02 only after DB-01 identifiers and membership rules exist;
- create migrations in small reviewable steps;
- use PostgreSQL enums or constrained lookup tables consistently with repository standards;
- seed catalogs with stable codes, never UI labels as keys;
- implement RLS before exposing client queries;
- keep sensitive logic in domain services and trusted database functions;
- produce fixtures for individual and Couple profiles;
- produce unit, integration and RLS tests;
- generate a Mermaid ER diagram from the final migration;
- document any deviation before coding it.

Codex must not:

- place all profile fields in `profiles`;
- create a generic EAV table for core profile attributes;
- store practices, limits or consent in JSON blobs;
- infer consent from profile content;
- infer orientation from gender;
- expose raw sensitive matching inputs to clients;
- let shared-profile roles override personal consent or hard limits;
- implement matching ranking before eligibility and exclusion rules exist.

---

## 22. Out of scope

Handled by later chapters:

- photos, albums, videos and media grants — DB-03;
- conversations and messaging permissions — DB-04;
- precise geolocation and proximity — DB-05;
- events, clubs and professional entities — DB-06;
- reviews, reports and moderation cases — DB-07;
- subscription entitlements — DB-08;
- notifications — DB-09;
- full retention, export and anonymization procedures — DB-10.

---

## 23. Definition of done

DB-02 is done when:

- this specification is validated;
- migrations and policies can be generated without unresolved product ambiguity;
- acceptance criteria are mapped to automated tests;
- DB-01 governance is respected for all shared-profile changes;
- no core sensitive attribute remains dependent on an unstructured storage design.
