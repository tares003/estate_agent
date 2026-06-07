# ADR 0002 — Per-tenant SMTP credential encryption at rest

- **Status:** Proposed (recommendation — awaiting ratification before EPIC-H §H.12 ships)
- **Date:** 2026-06-07
- **Deciders:** Platform engineering + security
- **Gates:** EPIC-H `FR-H-10a` / design `H.12a` — the per-tenant SMTP configuration screen. Per `AGENTS.md` §9, no tenant-SMTP storage code is committed until this ADR is `Accepted`.

## Context

The recorded stack uses **per-tenant SMTP**: each tenant stores host, port, username, and a **password / OAuth refresh token** from the admin (`AGENTS.md` §9; master spec §S.13a; EPIC-H FR-H-10a). The platform **must never hold tenant credentials in plaintext**. Requirements:

- Symmetric encryption at rest for the secret fields (SMTP password; OAuth client secret + refresh token).
- **Key rotation** without re-entry of every tenant's credentials.
- Key material sourced from the SOPS + age secrets pipeline (`AGENTS.md` §9), never in code or plaintext env on developer machines.
- Decrypt only at send time inside the worker/handler; never log decrypted values.
- Compatible with both basic-auth (app password) and OAuth 2.0 (Office 365 / Google) token storage.

## Decision drivers

1. **Maintenance health** of any third-party field-encryption library (several popular ones are unmaintained).
2. **Key rotation** support (multiple active keys during a rotation window).
3. **Auditability** — encryption is a security control; it must be testable and reviewable.
4. **Simplicity** — minimal moving parts on a self-hosted single box.

## Considered options

### Option A — First-party Fernet field using `cryptography.MultiFernet` (recommended)

- A small first-party `EncryptedTextField` (and `EncryptedJSONField` for OAuth token bundles) backed by `cryptography`'s `Fernet` / `MultiFernet`.
- `MultiFernet` natively supports **key rotation**: decrypt with any key in the list, encrypt with the first. Rotation = prepend a new key, re-encrypt lazily or via a management command.
- Keys come from SOPS-managed secrets (a list, newest first); 100% test coverage on encrypt/decrypt/rotate.
- No dependency on an unmaintained package; `cryptography` is the canonical, actively-maintained primitive.

### Option B — `django-cryptography`

- Drop-in encrypted model fields. **But** the package has had long maintenance gaps and lags Django releases; rotation story is weaker. Named in §9 only as "django-cryptography **or equivalent**".

### Option C — `django-encrypted-model-fields` / `django-fernet-fields`

- Similar drop-in ergonomics; both are effectively unmaintained.

## Decision (recommended)

**Adopt Option A — a first-party Fernet/`MultiFernet` field.** It removes reliance on an unmaintained dependency, gives first-class key rotation (a hard requirement for credential storage), and is small enough to own and test to 100% coverage. `cryptography` is already an indirect dependency of the stack and is the maintained primitive the other libraries wrap anyway.

## Consequences

- A `services/django/.../crypto/fields.py` module provides `EncryptedTextField` + `EncryptedJSONField`; keys read from `SMTP_ENCRYPTION_KEYS` (SOPS-provisioned, newest-first list).
- A `rotate_smtp_encryption` management command + runbook (`docs/runbooks/rotate-secrets.md`) re-encrypts under the newest key.
- Tests: round-trip, rotation (old key decrypts, new key encrypts), tamper-detection (Fernet auth tag), and a guard that decrypted values never enter logs.
- OAuth refresh tokens stored in `EncryptedJSONField`; access tokens are short-lived and cached in Redis (also not plaintext-logged), not persisted.

## Follow-ups before `Accepted`

- Security review of the field implementation plan.
- Confirm key-provisioning path in the SOPS pipeline (one shared platform key vs per-tenant DEK — recommendation: one platform KEK via MultiFernet for V1; per-tenant DEK envelope encryption deferred unless a tenant contract requires it).
