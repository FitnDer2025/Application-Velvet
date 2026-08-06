# ADR-GOV-002 — Continuous Project Steering

Status: Accepted

Date: 2026-07-23

## Context

Zwit now contains enough validated product decisions that the main risk is no longer a lack of ideas, but loss of continuity: reopening closed topics, forgetting pending domains, or allowing roadmap and documentation to drift apart.

## Decision

Zwit is governed through a continuous product steering system.

After every accepted ADR, the following actions are mandatory:

1. Create or update the normative ADR.
2. Update `docs/00-GOVERNANCE/DECISION-REGISTRY.md`.
3. Update `docs/00-GOVERNANCE/PROJECT-ROADMAP.md`.
4. Update `docs/00-GOVERNANCE/PRODUCT-METRICS.md`.
5. Update `docs/00-GOVERNANCE/CHANGELOG-PRODUCT.md`.
6. Create a dedicated Conventional Commit.
7. Mark the treated subject as closed or update its remaining scope.
8. Identify the next priority within the currently active domain.

## Operating principles

- One structural product question is handled at a time.
- An accepted ADR is final unless a later ADR explicitly amends or replaces it.
- Closed subjects must not be reopened as ordinary product questions.
- The active domain remains the priority until it is sufficiently locked.
- Progress percentages change only after a meaningful ADR or functional package is closed.
- The roadmap is the official source for project status and ordering.
- The ADR remains the normative source for the decision itself.

## Canonical governance files

- `DECISION-REGISTRY.md`: index of validated decisions.
- `PROJECT-ROADMAP.md`: official project status, active domain and remaining sequence.
- `PRODUCT-METRICS.md`: progress indicators by domain.
- `CHANGELOG-PRODUCT.md`: dated history of validated product evolution.

## Consequences

- Product work becomes traceable from decision to commit.
- Codex and contributors can determine what is closed before proposing changes.
- Progress can be resumed without reconstructing project history.
- A structural ADR without the required governance updates is incomplete.