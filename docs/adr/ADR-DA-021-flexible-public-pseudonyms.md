# ADR-DA-021 – Flexible Public Pseudonyms

Status: Accepted

## Decision

Zwit allows broad freedom in public pseudonyms while protecting the community from abuse, illegality and impersonation.

## Public identity model

Each profile has:

- a freely chosen display name;
- a unique and stable `@username` used for mentions and profile URLs;
- private legal identity data that is never displayed by default.

## Allowed

Pseudonyms may reflect libertine culture and may be playful, suggestive, geographic or couple-oriented. Examples include `Sexy59`, `CoupleCoquin62`, `BiGirlLille`, `CherryLove`, `Lola & Max` and similar names.

## Refused

Zwit refuses pseudonyms containing or attempting to disguise:

- insults or hateful content;
- references to minors;
- illegal content;
- impersonation of Zwit, support, moderation or another person;
- obvious spam;
- meaningless or abusive character sequences.

## Moderation

- Automated analysis is the first review layer.
- Ambiguous cases are escalated to a human moderator.
- Display-name changes may be limited in frequency to preserve continuity and prevent abuse.
- The stable `@username` prevents broken links and identity confusion.

## Privacy

The public pseudonym is distinct from verified legal identity. Real names remain private unless the member explicitly chooses to share them in an authorised context.
