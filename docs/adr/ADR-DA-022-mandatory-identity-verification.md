# ADR-DA-022 – Mandatory Identity Verification

Status: Accepted

## Decision

Identity and legal-age verification are mandatory for every Zwit member before full platform access is granted.

## Verification goals

- Confirm that the account belongs to a real person.
- Confirm that the person is legally an adult.
- Reduce impersonation, duplicate identities and fraud.
- Strengthen trust without exposing civil identity publicly.

## Workflow

1. The member provides the required verification elements.
2. Automated checks verify document integrity, face match, liveness and age eligibility.
3. Uncertain, inconsistent or high-risk cases are escalated to a trained human reviewer.
4. Access remains restricted until verification succeeds.
5. Re-verification may be required after material identity changes, suspected fraud or a risk event.

## Privacy and security

- Verification documents and biometric outputs are never visible to other members.
- Data collection must be minimised and protected through encryption, strict access controls and retention rules.
- Public profiles use pseudonyms; verified legal identity remains private.
- Vendor and implementation choices must comply with applicable privacy, biometric and age-assurance requirements.

## Product consequence

There is no ordinary “verified profile” badge because verification is a platform-wide prerequisite. Trust differentiation is instead expressed through the Zwit Trust Index, account history, recommendations, participation and other validated trust signals.
