# ADR-DA-020 – AI-first Hybrid Moderation

Status: Accepted

## Decision

Zwit uses a hybrid moderation workflow in which artificial intelligence performs the first review and a human moderator intervenes only when required.

## Scope

The workflow applies to sensitive profile changes and user-generated media, including:

- profile pictures;
- public photos;
- private albums;
- videos;
- presentation videos;
- event and venue media;
- professional account media.

## Workflow

1. New or modified content is analysed automatically.
2. Content with sufficient confidence is accepted or rejected automatically according to Zwit rules.
3. Ambiguous, high-risk or reported content is routed to a human moderator.
4. While a replacement is being reviewed, the previously approved content remains visible.
5. The owner can preview the pending content and receives a notification when a decision is made.

## Moderation priorities

- Urgent: suspected minor, illegal content, identity fraud or immediate safety risk.
- High: ambiguous content or repeated reports.
- Normal: ordinary media and sensitive profile updates.
- Low: periodic checks and minor non-urgent reviews.

## Product principles

- Quality and safety must not create unnecessary publication delays.
- Human review remains available for uncertainty, appeals and sensitive cases.
- Moderator decisions may improve future automated classification, subject to privacy and compliance requirements.
