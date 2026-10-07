# Demo warning overlays (#77)

## Configuration

The root no longer mounts `ReducedMotionConfig mode={ReduceMotion.System}`.
Reanimated 4.5.1 defaults to the system reduced-motion setting; explicit
`.reduceMotion(ReduceMotion.System)` calls and `useReducedMotion()` remain.
No LogBox filters or authentication-error suppression are added.

EAS profiles select their environment explicitly: `preview` uses `preview`;
`production` and `play-store` use `production`. Provision
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL` in those environments
before building. Public variables are bundled into the app. Never provide a
Clerk secret key to the mobile build.

- Local development and preview demos use the nonproduction Clerk instance
  (`pk_test_…`) and the seeded nonproduction API. Development-key warnings in
  Expo Go are expected; they do not justify switching to live credentials.
- Production distribution uses the provisioned production Clerk instance
  (`pk_live_…`) and production API. This change does not provision or rotate keys.
- Clerk is mounted only during Caretaker Setup/PIN recovery. Authentication
  failures must remain visible and retryable on those screens.

See [EAS environment variables](https://docs.expo.dev/eas/environment-variables/),
[Clerk deployment](https://clerk.com/docs/guides/development/deployment/overview),
and [Reanimated reduced motion](https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/).

## Verification record for #72

Build: Expo Go SDK 57, Android API 36 `kgo_phone` emulator, issue-77 branch.
The emulator was initially absent, then started for verification on 2026-10-07.
A cold start of the baseline/Figma branch reproduced the Reanimated override
warning on the Profile picker. A cold start of issue-77 reached the same picker
with no reduced-motion override warning in Metro output or the UI hierarchy.

No Profile was unlocked: the test PIN is unavailable. Navigation/answer
submission and system reduced-motion behavior remain pending. Clerk is not
mounted at the picker, so this observation does not verify its Setup warning.

Release/development build blocker: app.json has no EAS project ID and no
provisioned demo build/environment was supplied for this check. EAS variables
are selected by profile but their remote availability is not verified. The
release APK verification in #72 remains required.

On the provisioned demo device:

1. Install the preview release APK built with its EAS preview environment.
2. Complete Caretaker Setup with a nonproduction account. Check that errors
   remain visible and can be retried.
3. Open every Learner tab, open a Lesson, and submit an answer. Record whether
   any persistent overlay covers a tab or an answer control.
4. Enable the OS reduced-motion option, restart the app, and repeat. Entrance
   and progress animations must respect the system setting. Repeat disabled.
5. Record build ID/commit, OS/device, result, and redacted screenshots in #72.
   A development-build/Expo Go run is additional evidence, not a substitute
   for the release APK.

The development-key warning itself is not an authentication defect. A warning
that still blocks controls in the preview release APK needs a separate recorded
reproduction; do not disable all warnings to make the demonstration look clean.
