# ADR 0001 — Kotlin Manual Login Entry: Deprecate (A-soft)

- Status: Accepted (2026-09-05)
- Scope: `apps/workbench-mobile/android/app/src/main/java/com/workbench/mobile/`
- Owners: mobile-android

## Context

`apps/workbench-mobile` ships two authentication surfaces that disagree on the
client-side path to a session:

1. **mobile JS** (`apps/workbench-mobile/src/pages/LoginPage.tsx`,
   `apps/workbench-mobile/src/lib/mobileControl.ts`) routes the user through
   `requestEmailCode` + `confirmEmailCode` (QQ Mail / SMTP one-time-code) and
   then through an Ed25519-paired device confirmation to authorize a browser QR.
   `verify-mobile-contracts.mjs` enforces this on the JS side:
   - required: `login.emailCode`, `requestEmailCode`, `confirmEmailCode`,
     `challengeId`, `one-time-code`;
   - forbidden: `beginLogin` (silent OIDC redirect), `password` (re-introduction
     of a password form).

2. **mobile Kotlin** (`.../ui/screens/manual/ManualLoginScreen.kt`) renders a
   Compose email + password form, posts `LoginRequest(email, password)` to
   `POST /api/v1/auth/login`, and on success calls `POST /api/v1/auth/qrcode/confirm`
   to attach the session to a browser-owned QR. The file's own KDoc documents
   this password → QR-confirm path.

The two surfaces therefore disagree on:
- Transport: JS uses `/mobile/web-login/qr/scan` (gateway edge, paired-device
  bearer); Kotlin uses `/auth/login` (gateway fallback password endpoint) and
  `/auth/qrcode/confirm`.
- Credential type: JS uses an opaque email challenge code; Kotlin uses a
  reusable password.
- Verification coverage: `verify-mobile-contracts.mjs` constrains the JS files
  it reads but has no Kotlin-side analogue, so the password path is not
  contract-guarded.

`verify-mobile-contracts.mjs` already reads Kotlin (`BrandLoadingView.kt`) so
extending the same script to cover the login Composable is cheap.

## Evidence (collected 2026-09-05)

- `WorkBenchNavHost.kt` defines routes for HOME / SCAN / SCAN_RESULT / PROJECTS
  / PROJECT_DETAIL / PROJECT_DEVELOPER / WORKSPACE / PENDING / WORKSPACE_GROUP /
  WORKSPACE_STATUS / FILE_PREVIEW / ME / ACCOUNT / ACCOUNT_EDIT / DEVICES /
  NOTIFICATIONS / THEME / SETTINGS / SEARCH. No `Routes.MANUAL_LOGIN` exists
  and no `composable(...)` references `ManualLoginScreen`.
- `grep -rn "ManualLogin\|EmailLoginViewModel"` over `apps/workbench-mobile/android`
  returns hits only in `ManualLoginScreen.kt` itself — no upstream caller.
- `grep -rn "LoginRequest\|authApi\.login\|auth/login"` over Kotlin + JS sources
  shows `authApi.login(LoginRequest(...))` is invoked exactly once, from
  `EmailLoginViewModel.login(...)` inside `ManualLoginScreen.kt`. The interface
  declaration in `AuthApi.kt` is otherwise dead from a UI perspective.
- `LoginRequest` is declared in `data/api/dto/AuthDtos.kt` and only consumed by
  the same dead-code path.

So `ManualLoginScreen.kt` is **orphaned Compose surface**: no nav graph entry,
no producer caller, no test. The password path it implements is reachable only
by future code that would explicitly wire it in.

## Options considered

- **A. Delete Kotlin ManualLoginScreen** — Remove the orphaned screen,
  `EmailLoginViewModel`, and the now-unused `AuthApi.login` + `LoginRequest`
  surface. Cleanest, but the task contract forbids deleting Kotlin files.
- **B. Repurpose as a native shell bridge (扫码权限 / 推送 / 系统通知)** —
  Reasonable architectural move, but requires implementing new bridge
  responsibilities that are out of scope for a "keep or drop" decision and
  none of which currently exist.
- **C. Extend `verify-mobile-contracts.mjs` to force Kotlin to use the
  same email-code / Ed25519 path** — Not viable. Kotlin is a separate runtime
  with no access to `useAuth()` (React Context); it shares the backend contract
  but not the client-side pairing flow. Forcing parity would mean rebuilding
  Ed25519 + email challenge in the native stack.
- **A-soft (chosen). Deprecate, rename, and contract-guard.** Rename the file
  to `DeprecatedNativeManualLogin.kt`, mark every entry point
  (`@Deprecated`, KDoc), and add a Kotlin-side guard to
  `verify-mobile-contracts.mjs` that forbids the password field name from any
  Kotlin source. The screen stays on disk for one release so future callers can
  still see what was removed and why; new code cannot reach it via the nav
  graph (it is not registered), and even if it is wired back in, the contract
  guard will block the password shape.

## Decision

Adopt **A-soft**:

1. Rename `ui/screens/manual/ManualLoginScreen.kt` →
   `ui/screens/manual/DeprecatedNativeManualLogin.kt`.
2. Inside the renamed file:
   - Replace the leading KDoc with a deprecation note pointing at this ADR and
     at the JS path (`LoginPage.tsx` + `mobileControl.ts`) as the supported
     route.
   - Annotate `EmailLoginViewModel` and `ManualLoginScreen` with
     `@Deprecated("see docs/decisions/0001-kotlin-manual-login.md")`.
   - Leave the body untouched so the file still compiles if a future debug
     navigation entry references it. It does not get a route in `WorkBenchNavHost`.
3. Extend `scripts/verify-mobile-contracts.mjs` to forbid `password` in any
   Kotlin source under `android/app/src/main/java/com/workbench/mobile/`. The
   contract now covers both JS and Kotlin login shapes.
4. Track the dead `AuthApi.login` / `LoginRequest` declaration as a follow-up
   in the ADR's "Open questions" section; they are intentionally not removed
   this commit because the API declaration is not orphaned from a Kotlin
   compilation standpoint.

## Consequences

- Pros
  - Removes the contradiction between the JS contract and the Kotlin source
    by removing the Kotlin password path from any reachable surface.
  - Adds a permanent contract guard so a future revert must explicitly bypass
    `verify-mobile-contracts.mjs`.
  - File rename preserves history (`git log --follow`) for future forensics.
- Cons / Risks
  - The Compose surface still compiles, which means a future contributor
    could re-import it into the nav graph. The contract guard prevents the
    password field, but not the import. Mitigation: keep the `@Deprecated`
    markers and the KDoc.
  - `AuthApi.login` and `LoginRequest` remain in the source tree. They are
    unused and should be removed in a follow-up once we are confident no
    external Android tooling depends on them.
  - No verification was run locally for the rename (CI is the source of
    truth); see "Verification status" below.

## Affected files

- renamed: `android/app/src/main/java/com/workbench/mobile/ui/screens/manual/ManualLoginScreen.kt`
  → `.../DeprecatedNativeManualLogin.kt`
- edited: `android/app/src/main/java/com/workbench/mobile/ui/screens/manual/DeprecatedNativeManualLogin.kt`
  (KDoc + `@Deprecated` annotations)
- edited: `scripts/verify-mobile-contracts.mjs` (new Kotlin `forbidMatch` rule)

## Verification status

- `verify-mobile-contracts.mjs`: **not run locally**. The Kotlin rename and the
  new regex rule are expected to pass; CI should re-run this script as part of
  the standard contract gate.
- Kotlin compile / assembleDebug: **not run locally**. The Kotlin sources are
  unchanged in semantics, only annotations and the file name changed.

## Open questions / follow-ups

1. Should `AuthApi.login` + `LoginRequest` be removed in a separate commit
   once we have CI history showing no external consumer depends on them?
2. Should `WorkBenchStartupGate` grow a "session invalid → redirect to JS
   LoginPage" handoff so that a future native client crashes are caught by the
   shared contract rather than silently failing offline?
3. Is there a native-side counterpart to `requestEmailCode` / `confirmEmailCode`
   on the roadmap? If yes, that should be the next ADR; if no, A-soft is
   sufficient long-term.
