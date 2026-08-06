# ADR-DA-023 – Zwit Activity Index

Status: Accepted

## Decision

Zwit does not expose an exact public “last seen” timestamp. It replaces that signal with an intelligent activity indicator that helps members identify living profiles without revealing precise connection habits.

## Activity levels

The interface may present levels such as:

- Very active;
- Active this week;
- Occasional activity;
- Low activity;
- Sleeping account.

Exact timestamps remain private.

## Signals

The Activity Index may consider, with appropriate safeguards:

- recent sessions;
- message participation and replies;
- profile updates;
- new approved media;
- event activity;
- meaningful platform use.

The index must not become a popularity score and must avoid rewarding compulsive use.

## Recommendations

- Active profiles receive greater recommendation weight.
- Low-activity profiles are progressively deprioritised.
- Sleeping or long-abandoned accounts are removed from recommendations and discovery surfaces.
- Internal inactivity thresholds must be configurable and observable by administrators.

## Away Mode

Members can declare a temporary absence, optionally with a reason and return date. Examples include holiday, personal pause, family time or business travel.

The member controls whether the profile remains visible during the absence. Recommendations should respect the absence state and avoid creating false expectations.

## Response behaviour

Zwit may show a privacy-preserving response indicator such as “usually replies quickly”, “usually replies during the day” or “replies occasionally”. It is calculated over a rolling period and only from genuine conversation contexts. It must never reveal exact connection or reading times.
