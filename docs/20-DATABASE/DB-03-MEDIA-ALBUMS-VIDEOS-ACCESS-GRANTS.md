# Zwit Database Bible — DB-03

## Media, albums, videos and access grants

**Status:** Proposed for validation  
**Version:** 1.0  
**Scope:** Platform Core / Community / Professionals  
**Applies to:** Photos, videos, albums, previews, private access, moderation and audit  
**Related decisions:** DB-01, DB-02, ADR-DATA-046

---

## 1. Purpose

This document defines the canonical data model and business rules for:

- profile photos and videos;
- public, members-only and private albums;
- cover images and ordering;
- uploads, processing and derivatives;
- explicit access grants and revocation;
- time-limited album access;
- couple-profile consent for jointly identifying media;
- media moderation, reports and quarantine;
- secure storage, delivery and audit;
- deletion, retention and anonymization boundaries.

This document is normative. No client may directly expose storage paths or bypass domain authorization.

---

## 2. Locked principles

1. A media object belongs to exactly one Zwit profile, never directly to an authentication account.
2. Uploading a file does not make it visible.
3. Every media object has a lifecycle independent from the album containing it.
4. Storage objects remain private by default.
5. Public delivery uses controlled signed or transformed URLs; raw storage paths are never public API fields.
6. Private album access is explicit, revocable, auditable and optionally time-limited.
7. Revocation takes effect immediately for future access requests.
8. A grant never transfers ownership and never authorizes downloading, copying or redistribution.
9. A block, suspension, moderation restriction or consent withdrawal overrides every active grant.
10. Jointly identifying media on a shared profile requires the approvals defined in DB-01.
11. Media moderation status is separate from profile moderation status.
12. Original files and generated derivatives must be traceable without exposing provider internals.
13. Deleted media must disappear from product access immediately, even when physical purge is deferred.
14. Zwit must record sufficient evidence to investigate unauthorized access without logging sensitive file contents.

---

## 3. Domain model

```text
Profile
  ├── Media Assets
  │     ├── Original File
  │     ├── Image Derivatives
  │     ├── Video Renditions
  │     └── Moderation State
  ├── Albums
  │     └── Album Items
  └── Access Grants
        ├── Granted to Profile
        ├── Granted by Profile Member
        ├── Expiration / Revocation
        └── Access Audit Events
```

A `media_asset` is the canonical logical media record. A storage object is an implementation detail attached to that asset. An album organizes media assets but does not own the binary file.

---

## 4. Enumerations

### 4.1 `media_kind`

- `image`
- `video`

### 4.2 `media_status`

- `upload_pending`
- `uploaded`
- `processing`
- `ready`
- `rejected`
- `quarantined`
- `failed`
- `deleted`

### 4.3 `media_visibility`

- `private_owner_only`
- `private_album`
- `members_only`
- `public`

Visibility is an upper bound. Album rules, moderation, blocks and grants may further restrict access.

### 4.4 `album_type`

- `public`
- `members_only`
- `private`
- `temporary`
- `system`

`system` is reserved for platform-generated collections such as pending moderation or archived media and is never directly exposed as a normal album.

### 4.5 `album_status`

- `draft`
- `active`
- `hidden`
- `restricted`
- `archived`
- `deleted`

### 4.6 `access_grant_status`

- `pending`
- `active`
- `revoked`
- `expired`
- `rejected`
- `cancelled`

### 4.7 `access_grant_scope`

- `album_view`
- `media_view`

V1 should prefer album-level grants. Media-level grants are supported for exceptional use cases and future messaging flows.

### 4.8 `media_moderation_status`

- `not_submitted`
- `pending_automated_review`
- `pending_human_review`
- `approved`
- `restricted`
- `rejected`
- `appealed`

### 4.9 `media_subject_scope`

- `single_member`
- `multiple_profile_members`
- `third_party_present`
- `unknown`

This field supports consent workflows and moderation. It is not a biometric classification.

### 4.10 `media_derivative_type`

- `thumbnail`
- `small`
- `medium`
- `large`
- `blurred_preview`
- `watermarked_preview`
- `poster_frame`
- `video_360p`
- `video_720p`
- `video_1080p`

---

## 5. Tables

## 5.1 `media_assets`

Canonical logical media record.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK to `profiles.id` |
| `kind` | `media_kind` | no | Immutable after creation |
| `status` | `media_status` | no | Default `upload_pending` |
| `visibility` | `media_visibility` | no | Default `private_owner_only` |
| `subject_scope` | `media_subject_scope` | no | Default `unknown` |
| `title` | `text` | yes | Moderated optional label |
| `caption` | `text` | yes | Moderated optional text |
| `alt_text` | `text` | yes | Accessibility text; never inferred publicly from identity |
| `mime_type` | `text` | yes | Set after trusted inspection |
| `byte_size` | `bigint` | yes | Set after upload finalization |
| `width_px` | `integer` | yes | Images and video frame width |
| `height_px` | `integer` | yes | Images and video frame height |
| `duration_ms` | `integer` | yes | Video only |
| `checksum_sha256` | `text` | yes | Server-computed; never client-trusted |
| `uploaded_by_account_id` | `uuid` | no | FK to account; audit provenance |
| `captured_at` | `timestamptz` | yes | Optional user-declared metadata; EXIF not exposed |
| `ready_at` | `timestamptz` | yes | Set when delivery derivatives are ready |
| `created_at` | `timestamptz` | no | Default `now()` |
| `updated_at` | `timestamptz` | no | Trigger-maintained |
| `deleted_at` | `timestamptz` | yes | Logical deletion |

Rules:

- `profile_id` cannot change after upload initialization;
- client-provided MIME type, dimensions and checksum are advisory only;
- `public` or `members_only` visibility requires `status = ready` and moderation approval where applicable;
- a private asset may exist without an album but is visible only to authorized profile managers;
- deleted or quarantined assets cannot produce delivery URLs;
- video duration, image dimensions and byte size must respect centrally configured limits.

Indexes:

- `media_assets(profile_id, status, created_at desc)`;
- `media_assets(profile_id, visibility, status)`;
- partial `media_assets(checksum_sha256) where deleted_at is null` for abuse and duplicate detection, not automatic cross-profile deduplication;
- `media_assets(uploaded_by_account_id, created_at desc)`.

---

## 5.2 `media_storage_objects`

Maps logical media to provider-side storage objects.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `media_asset_id` | `uuid` | no | FK to media asset |
| `storage_provider` | `text` | no | e.g. `supabase` |
| `bucket_key` | `text` | no | Internal bucket identifier |
| `object_key` | `text` | no | Opaque internal object path |
| `is_original` | `boolean` | no | One active original maximum |
| `derivative_type` | `media_derivative_type` | yes | Required when not original |
| `mime_type` | `text` | no | Trusted output type |
| `byte_size` | `bigint` | no | |
| `width_px` | `integer` | yes | |
| `height_px` | `integer` | yes | |
| `duration_ms` | `integer` | yes | |
| `created_at` | `timestamptz` | no | |
| `deleted_at` | `timestamptz` | yes | Physical deletion may follow |

Constraints:

- unique active `(storage_provider, bucket_key, object_key)`;
- one active original per media asset;
- unique active `(media_asset_id, derivative_type)` where `derivative_type is not null`;
- this table is backend-only and excluded from client schemas.

---

## 5.3 `media_processing_jobs`

Tracks asynchronous validation, image transforms, video transcoding and safety review.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `media_asset_id` | `uuid` | no | FK |
| `job_type` | `text` | no | `inspect`, `sanitize`, `transform`, `transcode`, `moderate`, `purge` |
| `status` | `text` | no | `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| `attempt_count` | `integer` | no | Default 0 |
| `provider_job_id` | `text` | yes | Internal external reference |
| `error_code` | `text` | yes | Normalized, non-secret |
| `started_at` | `timestamptz` | yes | |
| `finished_at` | `timestamptz` | yes | |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Rules:

- jobs must be idempotent;
- provider secrets and raw moderation payloads are not exposed to clients;
- failed processing cannot silently make the original deliverable.

---

## 5.4 `albums`

Logical collection owned by a profile.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `profile_id` | `uuid` | no | FK to profile |
| `type` | `album_type` | no | Immutable after activation except controlled migration |
| `status` | `album_status` | no | Default `draft` |
| `name` | `text` | no | Moderated display name |
| `description` | `text` | yes | Moderated |
| `cover_media_asset_id` | `uuid` | yes | Must belong to same profile and album |
| `allow_access_requests` | `boolean` | no | Default false |
| `default_grant_duration_minutes` | `integer` | yes | Private/temporary only |
| `maximum_grant_duration_minutes` | `integer` | yes | Optional owner policy |
| `requires_joint_approval` | `boolean` | no | Derived/default true for sensitive shared-profile albums |
| `created_by_account_id` | `uuid` | no | Audit provenance |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |
| `archived_at` | `timestamptz` | yes | |
| `deleted_at` | `timestamptz` | yes | |

Rules:

- private and temporary albums are never discoverable through public listing APIs;
- `temporary` albums require an explicit maximum access duration;
- an album cannot be activated without at least one ready, permitted media asset;
- cover media must remain accessible under the same rules as the album;
- an album status change cannot override media-level moderation or deletion.

Indexes:

- `albums(profile_id, type, status)`;
- `albums(profile_id, updated_at desc)`;
- partial `albums(profile_id, status) where deleted_at is null`.

---

## 5.5 `album_items`

Ordered relationship between albums and media assets.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `album_id` | `uuid` | no | Composite PK/FK |
| `media_asset_id` | `uuid` | no | Composite PK/FK |
| `sort_order` | `integer` | no | Non-negative |
| `added_by_account_id` | `uuid` | no | Audit provenance |
| `added_at` | `timestamptz` | no | |
| `removed_at` | `timestamptz` | yes | Soft removal preserves audit |

Constraints:

- album and media must belong to the same profile;
- one active membership per `(album_id, media_asset_id)`;
- unique active `(album_id, sort_order)`;
- adding media never changes the media visibility automatically;
- removing media from an album does not delete the media asset.

---

## 5.6 `media_member_consents`

Records approval from profile members who are represented or jointly identifiable in media.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `media_asset_id` | `uuid` | no | FK |
| `account_id` | `uuid` | no | Consenting active profile member |
| `consent_status` | `text` | no | `required`, `granted`, `withdrawn`, `not_required` |
| `visibility_ceiling` | `media_visibility` | yes | Maximum visibility approved by this member |
| `granted_at` | `timestamptz` | yes | |
| `withdrawn_at` | `timestamptz` | yes | |
| `recorded_by_account_id` | `uuid` | no | Must normally equal account_id; admin exception audited |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Rules:

- consent is affirmative and cannot be inferred from profile membership;
- withdrawal immediately reduces effective visibility and invalidates conflicting grants;
- the effective media visibility is the most restrictive active ceiling among required consents;
- consent history is immutable through event records even when the current row is updated;
- third-party presence requires moderation handling and must not be represented as consent from an unregistered person.

Unique active constraint:

- `(media_asset_id, account_id)`.

---

## 5.7 `album_access_requests`

Optional request workflow initiated by a requester profile.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `album_id` | `uuid` | no | Private/temporary album |
| `requester_profile_id` | `uuid` | no | FK to requesting profile |
| `requested_by_account_id` | `uuid` | no | Active member of requester profile |
| `status` | `text` | no | `pending`, `approved`, `rejected`, `cancelled`, `expired` |
| `message` | `text` | yes | Moderated, length-limited |
| `resolved_by_account_id` | `uuid` | yes | Authorized member of owner profile |
| `resolved_at` | `timestamptz` | yes | |
| `expires_at` | `timestamptz` | no | Request expiration |
| `created_at` | `timestamptz` | no | |

Constraints:

- album must permit access requests;
- requester and owner profiles cannot be blocked or restricted from interaction;
- only one pending request per `(album_id, requester_profile_id)`;
- approval creates a separate access grant transactionally;
- rejected requests do not reveal internal rejection notes.

---

## 5.8 `media_access_grants`

Authoritative authorization record for private album or media access.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `owner_profile_id` | `uuid` | no | Profile owning the target |
| `grantee_profile_id` | `uuid` | no | Profile receiving access |
| `scope` | `access_grant_scope` | no | |
| `album_id` | `uuid` | yes | Required for `album_view` |
| `media_asset_id` | `uuid` | yes | Required for `media_view` |
| `status` | `access_grant_status` | no | Default `pending` or `active` by workflow |
| `granted_by_account_id` | `uuid` | no | Authorized owner-profile member |
| `source_request_id` | `uuid` | yes | Optional FK to request |
| `starts_at` | `timestamptz` | no | Default `now()` |
| `expires_at` | `timestamptz` | yes | Required for temporary albums |
| `revoked_at` | `timestamptz` | yes | |
| `revoked_by_account_id` | `uuid` | yes | |
| `revocation_reason_code` | `text` | yes | Internal normalized code |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Constraints:

- exactly one target field is populated according to `scope`;
- target belongs to `owner_profile_id`;
- owner and grantee profiles must differ;
- grantor must hold an active permission on owner profile;
- grant is ineffective before `starts_at` or after `expires_at`;
- only one effective overlapping grant per target and grantee profile;
- joint approval must complete before activation when required;
- account-level access is never granted directly; all recipient access is through an active profile membership.

Indexes:

- `media_access_grants(grantee_profile_id, status, expires_at)`;
- `media_access_grants(owner_profile_id, status, created_at desc)`;
- `media_access_grants(album_id, grantee_profile_id)`;
- `media_access_grants(media_asset_id, grantee_profile_id)`;
- partial index for active non-expired grants.

---

## 5.9 `media_delivery_sessions`

Short-lived authorization evidence for serving a media derivative.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `media_asset_id` | `uuid` | no | FK |
| `viewer_account_id` | `uuid` | no | Authenticated account |
| `viewer_profile_id` | `uuid` | yes | Active context profile where relevant |
| `grant_id` | `uuid` | yes | Grant used for authorization |
| `derivative_type` | `media_derivative_type` | no | Never original by default |
| `authorization_reason` | `text` | no | `owner`, `public`, `member`, `grant`, `moderator` |
| `expires_at` | `timestamptz` | no | Very short TTL |
| `created_at` | `timestamptz` | no | |

Rules:

- this record does not contain the signed URL or storage secret;
- creating a delivery session requires a full authorization evaluation at request time;
- sessions are not reusable after expiration;
- revocation must prevent creation of new sessions; signed URL TTL must remain short enough to limit residual exposure;
- high-volume telemetry may be moved to an append-only analytics store later, but security-relevant events remain auditable.

---

## 5.10 `media_moderation_cases`

Tracks media-specific trust and safety review.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `media_asset_id` | `uuid` | no | FK |
| `status` | `media_moderation_status` | no | |
| `automated_classification` | `jsonb` | yes | Restricted backend data, schema-versioned |
| `decision_code` | `text` | yes | Normalized policy code |
| `reviewed_by_admin_account_id` | `uuid` | yes | Privileged admin identity |
| `submitted_at` | `timestamptz` | yes | |
| `resolved_at` | `timestamptz` | yes | |
| `created_at` | `timestamptz` | no | |
| `updated_at` | `timestamptz` | no | |

Rules:

- automated classification never becomes the sole permanent rejection evidence without a defined policy path;
- public visibility requires the configured moderation threshold;
- restricted/rejected/quarantined media cannot be delivered to normal users;
- appeal workflow must preserve prior decisions.

---

## 5.11 `media_access_events`

Append-only security and product audit trail.

| Column | Type | Null | Rules |
|---|---|---:|---|
| `id` | `uuid` | no | PK |
| `event_type` | `text` | no | See event catalogue below |
| `media_asset_id` | `uuid` | yes | |
| `album_id` | `uuid` | yes | |
| `grant_id` | `uuid` | yes | |
| `actor_account_id` | `uuid` | yes | Null only for trusted system action |
| `actor_profile_id` | `uuid` | yes | |
| `target_profile_id` | `uuid` | yes | |
| `request_id` | `uuid` | yes | Correlation identifier |
| `metadata` | `jsonb` | no | Minimal, schema-versioned, no signed URLs |
| `created_at` | `timestamptz` | no | Immutable |

Event catalogue includes:

- `upload_initialized`
- `upload_finalized`
- `processing_completed`
- `media_published`
- `media_hidden`
- `media_deleted`
- `consent_granted`
- `consent_withdrawn`
- `access_requested`
- `access_granted`
- `access_rejected`
- `access_revoked`
- `access_expired`
- `delivery_authorized`
- `delivery_denied`
- `moderation_restricted`
- `moderation_released`

Access-event retention and minimization are finalized in DB-10.

---

## 6. Effective authorization algorithm

A media delivery request is authorized only when every mandatory condition is true:

1. viewer account is active and authenticated;
2. selected viewer profile, when required, has an active membership for that account;
3. owner profile and media asset are active enough for the requested operation;
4. media status is `ready`;
5. media is not deleted, rejected or quarantined;
6. all required member consents are currently valid;
7. there is no block, safety restriction or moderation rule preventing interaction;
8. one visibility path succeeds:
   - viewer manages the owner profile;
   - media is effectively public;
   - media is members-only and viewer meets membership rules;
   - an active, non-expired grant covers the target;
   - viewer is an authorized moderator acting within audited scope;
9. the requested derivative is permitted;
10. a short-lived delivery session is created.

Authorization must be recomputed server-side for every new delivery session. A client-visible album listing is not proof of continued access.

---

## 7. Shared-profile and consent rules

For couple or other shared profiles:

- upload may be performed by a member with `media.upload` permission;
- ordinary non-identifying draft media may be managed under role permissions;
- publication of jointly identifying media follows the sensitive-action approval process from DB-01;
- required consent rows must exist for represented active members before visibility exceeds `private_owner_only`;
- any represented member may withdraw their own consent;
- withdrawal cannot be overridden by another profile member;
- withdrawal immediately hides the asset from recipients and suspends related grants;
- removal of a member from a shared profile triggers review of every media asset for which that member has consent evidence.

Zwit must not attempt to infer which real person appears in a file using biometric identity matching as a default product feature.

---

## 8. Upload workflow

### 8.1 Initialize

Server command: `InitializeMediaUpload`

Validates:

- active account and profile membership;
- `media.upload` permission;
- profile and account restrictions;
- declared media kind and size ceiling;
- quota and rate limits.

Creates:

- `media_assets` row in `upload_pending`;
- private provider upload authorization scoped to one object key;
- audit event.

### 8.2 Finalize

Server command: `FinalizeMediaUpload`

The server or trusted worker:

- confirms object existence;
- inspects actual MIME signature;
- computes checksum and dimensions;
- strips or sanitizes unsafe metadata where required;
- rejects unsupported or malformed files;
- queues transformations, transcodes and moderation;
- transitions status to `processing`.

### 8.3 Ready

After successful processing:

- derivatives are registered;
- moderation state is applied;
- asset becomes `ready` but remains private by default;
- explicit publication or album activation is still required.

No direct client update may move an asset to `ready`, `public`, `approved` or `deleted`.

---

## 9. Grant workflow

### Direct grant

1. authorized owner-profile member selects a recipient profile;
2. backend validates interaction eligibility and target album;
3. joint approval is requested when required;
4. active grant is created with start and optional expiry;
5. recipient is notified without exposing storage details;
6. audit events are appended.

### Request-based grant

1. requester profile submits one pending request;
2. owner profile approves or rejects;
3. approval creates the grant transactionally;
4. request status becomes `approved` only if grant creation succeeds.

### Revocation

- an authorized owner member may revoke according to role rules;
- a required consenting member may force revocation by withdrawing consent;
- block or moderation workflows may revoke or suspend grants automatically;
- revocation is idempotent and immediately denies new delivery sessions.

---

## 10. Permissions

Minimum permission keys:

- `media.view_owner`
- `media.upload`
- `media.edit_metadata`
- `media.delete`
- `media.publish_public`
- `media.publish_members_only`
- `media.manage_consent`
- `album.create`
- `album.edit`
- `album.reorder`
- `album.archive`
- `album.delete`
- `album.manage_access_requests`
- `album.grant_access`
- `album.revoke_access`
- `media.moderate`
- `media.audit.read`

Sensitive actions continue to require both permission and approval-policy satisfaction.

---

## 11. RLS and service boundaries

### Client-readable through controlled views/RPC only

- safe media metadata;
- authorized album metadata;
- permitted derivative identifiers;
- current user's own requests and grants, with internal fields removed.

### Backend-only tables

- `media_storage_objects`;
- `media_processing_jobs`;
- raw moderation classifications;
- security-sensitive audit metadata.

### Mandatory rules

- direct bucket listing is forbidden;
- storage object keys are never returned by public/profile APIs;
- RLS alone is not sufficient for signed URL creation; domain authorization is required;
- service-role access is isolated to trusted workers and server commands;
- admin media access requires a purpose-bound audited workflow;
- one profile's managers cannot query another profile's private album members or access history.

---

## 12. Security requirements

- private buckets by default;
- content-type validation by file signature, not extension;
- randomized opaque object keys;
- antivirus/malware inspection where technically applicable;
- image metadata sanitization and EXIF location removal;
- video processing in isolated workers;
- strict upload quotas and rate limiting;
- short-lived signed delivery URLs;
- no originals delivered to ordinary viewers by default;
- previews may be resized, blurred or watermarked according to product policy;
- cache-control must prevent unintended long-term shared caching of private media;
- CDN cache invalidation strategy is required for deletion and moderation restriction;
- logs must not include signed URLs, binary contents or sensitive captions beyond necessity;
- enumeration-resistant identifiers and error responses.

A visible watermark may discourage redistribution but must never be represented as a technical prevention of screenshots or copying.

---

## 13. Privacy and GDPR boundaries

- media is personal data and may be highly sensitive depending on context;
- explicit purpose and visibility are stored separately from binary storage;
- consent evidence must be retained only as long as legally and operationally necessary;
- user deletion immediately revokes product access before deferred physical purge;
- backups and provider deletion windows are documented in DB-10;
- EXIF geolocation is removed unless a future explicit product decision requires retained private metadata;
- no facial recognition index, biometric template or identity-matching database is created under this chapter;
- exports must include user-owned media metadata and accessible originals where legally appropriate, without exposing other users' private grant history beyond applicable rights;
- audit access is limited and purpose-bound.

---

## 14. Deletion and retention

### Logical deletion

Immediately:

- set `media_assets.status = deleted` and `deleted_at`;
- revoke grants covering the asset or invalidate album coverage;
- deny new delivery sessions;
- remove the asset from normal album listings;
- queue CDN invalidation and physical purge.

### Physical purge

Trusted asynchronous job deletes:

- original object;
- derivatives and renditions;
- transient processing artifacts;
- provider-side cached copies where supported.

The immutable audit trail records identifiers and actions but not file contents. Exact retention periods are set in DB-10.

---

## 15. Transactions and invariants

The following operations must be transactional or use a reliable outbox/saga pattern:

- finalizing upload and scheduling processing;
- publishing media after consent and moderation checks;
- approving an access request and creating its grant;
- revoking a grant and emitting notifications/audit events;
- withdrawing consent and restricting all affected access;
- deleting an album and revoking album grants;
- changing album cover and item order;
- moderation quarantine and delivery denial.

Database constraints must enforce structural invariants. Domain services enforce contextual authorization and cross-domain policies.

---

## 16. Domain commands

Required server-side commands:

- `InitializeMediaUpload`
- `FinalizeMediaUpload`
- `RetryMediaProcessing`
- `UpdateMediaMetadata`
- `SetMediaVisibility`
- `RecordMediaMemberConsent`
- `WithdrawMediaMemberConsent`
- `DeleteMediaAsset`
- `CreateAlbum`
- `UpdateAlbum`
- `AddMediaToAlbum`
- `RemoveMediaFromAlbum`
- `ReorderAlbumItems`
- `ActivateAlbum`
- `ArchiveAlbum`
- `RequestAlbumAccess`
- `ApproveAlbumAccessRequest`
- `RejectAlbumAccessRequest`
- `GrantAlbumAccess`
- `RevokeMediaAccess`
- `AuthorizeMediaDelivery`
- `ApplyMediaModerationDecision`

Every command must define authorization, validation, idempotency, audit output and error codes.

---

## 17. Public query contracts

Minimum safe read models:

### `ProfileMediaCard`

- media id;
- kind;
- approved derivative reference;
- dimensions/aspect ratio;
- accessible caption;
- effective visibility category;
- never storage object key.

### `AlbumSummary`

- album id;
- name;
- type only when viewer is allowed to know it;
- cover derivative;
- media count visible to viewer;
- access state: `available`, `requestable`, `pending`, `granted`, `unavailable`.

### `PrivateAccessGrantSummary`

- grant id;
- album id or safe target reference;
- owner profile summary;
- start and expiry;
- status;
- no internal revocation notes or grantor private identity.

---

## 18. Acceptance criteria

DB-03 is accepted when:

1. no raw storage path is exposed to ordinary clients;
2. an upload remains private until processing and explicit publication complete;
3. invalid file types cannot be promoted through client-declared metadata;
4. private album access requires an active grant or owner permission;
5. expired or revoked grants deny new delivery immediately;
6. a blocked profile cannot use an otherwise active grant;
7. consent withdrawal by a represented member restricts the media immediately;
8. couple-profile joint media cannot become externally visible without required approvals;
9. album deletion revokes associated effective access;
10. media deletion denies access before physical purge completes;
11. moderators can access restricted media only through audited privileged workflows;
12. a user cannot enumerate another profile's private albums, grants or storage keys;
13. video and image derivatives are delivered instead of originals by default;
14. all sensitive mutations append an audit event;
15. retrying idempotent commands does not create duplicate grants, album items or processing jobs.

---

## 19. Required tests

### Unit tests

- effective visibility calculation;
- consent visibility ceiling;
- grant active-window calculation;
- album/media ownership invariant;
- derivative eligibility;
- permission plus joint-approval resolution.

### Integration tests

- upload initialize/finalize/processing success;
- malformed file rejection;
- private album request and approval;
- direct grant and immediate revocation;
- grant expiration;
- album deletion cascading logical access invalidation;
- consent withdrawal on shared profile;
- moderation quarantine;
- signed delivery authorization without raw object exposure.

### RLS/security tests

- unrelated account cannot read private album metadata;
- grantee account without active grantee-profile membership cannot use grant;
- blocked profiles cannot authorize delivery;
- client cannot write moderation, storage or processing tables;
- manager without grant permission cannot open album access;
- service worker can process only through expected backend role;
- object key and provider metadata never appear in public read models.

### Concurrency tests

- duplicate request submissions;
- simultaneous approval/revocation;
- simultaneous consent withdrawal/publication;
- parallel album reorder operations;
- deletion during active delivery authorization.

---

## 20. Migration order

1. media and album enums;
2. `media_assets`;
3. `media_storage_objects`;
4. `media_processing_jobs`;
5. `albums`;
6. `album_items`;
7. `media_member_consents`;
8. `album_access_requests`;
9. `media_access_grants`;
10. `media_delivery_sessions`;
11. `media_moderation_cases`;
12. `media_access_events`;
13. constraints and partial indexes;
14. RLS policies and safe read models;
15. processing outbox/work queues;
16. seed permission keys;
17. integration and security tests.

---

## 21. Codex execution contract

Codex must:

- implement the schema in small reviewable migrations;
- keep storage-provider details behind an adapter;
- never generate public bucket policies for private user media;
- implement command handlers outside page components;
- expose safe read models rather than raw tables;
- add authorization tests before UI integration;
- treat consent withdrawal, blocks and moderation as hard authorization overrides;
- make upload finalization and processing idempotent;
- avoid biometric identification or face-recognition features;
- document every deviation through a new ADR before implementation.

Codex must not:

- trust client MIME types or dimensions;
- expose originals by default;
- store signed URLs in persistent tables;
- authorize access solely because an album was previously loaded;
- infer consent from couple membership;
- allow frontend code to directly mutate grant, moderation or storage records;
- claim screenshots or copying can be technically prevented.

---

## 22. Deferred decisions

The following remain intentionally deferred and require product/legal/security validation before implementation:

- exact upload and storage quotas by subscription tier;
- exact supported codecs and maximum video duration;
- watermark design and whether it is mandatory for private previews;
- screenshot-deterrence UX on supported mobile platforms;
- automatic nudity/safety moderation provider;
- content retention periods after account deletion;
- whether recipients may explicitly save media inside Zwit;
- end-to-end encrypted media in messaging;
- media use in events, professional listings and reviews;
- anti-hash abuse databases and cross-platform safety integrations.

These deferred decisions do not weaken the core rule: storage is private, access is explicit, consent is revocable, and every delivery is authorized server-side.