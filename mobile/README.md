# K-Go Quests — tablet shell

The Expo app that runs on DepEd-issued, LGU-funded or telco-donated tablets. It
is the offline half of the platform: a learner finishes a full practice session
with the radio off, and the answers upload the next time the device sees Wi-Fi.

One binary serves three roles — learner, teacher and LGU admin — gated by the
role the server reports, with its own tab bar per role.

## Running it

```bash
npm install
npx expo start
```

Press `a` for Android, `i` for iOS, or scan the QR code with Expo Go. Everything
here runs inside Expo Go: no custom native module, no development build required.

**Pointing it at the backend.** In development the app derives the API URL from
the Metro host, so a device on the same Wi-Fi as your computer just works. To
override it:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000/api/v1 npx expo start
```

Use your computer's LAN IP, not `localhost` — `localhost` on a tablet means the
tablet. For Expo web, add the exact browser origin to `CORS_ORIGINS` in the
backend's `.env`.

There is also a **preview mode** that fills every screen with sample data and no
server, for walking through the UI without a running backend.

## Layout

```
src/
  app/              # expo-router file routes, typed
    _layout.tsx     # fonts, providers, role gating via Stack.Protected
    (student)/      # learn · tutor · progress · rewards · league
    (teacher)/      # class · learners · alerts · quiz · grow
    (admin)/        # schools · users · content · impact · devices
    …               # sign-in, register, lock, onboarding, lesson, pack, voucher, …
  state/
    app-context.tsx # session, sync, outbox, PIN, preview — the whole app state
  data/
    crypto.ts       # AES-256-GCM record encryption, keystore key, PIN pepper
    repository.ts   # SQLite cache, outbox, outcomes, redemption requests
    storage.ts      # expo-sqlite adapter (storage.web.ts for web)
    vault.ts        # expo-secure-store wrapper (vault.web.ts for web)
  domain/
    client.ts       # API client: refresh rotation, typed errors
    sync.ts         # batch upload, acknowledgement, review states
    types.ts        # the shapes the server returns
  ui/
    theme.ts        # K-Go design tokens, straight from the Figma variables
    primitives.tsx  # T · Card · Pill · Bar · Ring · Button · Field · Sheet · …
    chrome.tsx      # AppBar, role-aware NavBar, sync banner
    screen.tsx      # the screen frame every route uses
```

31 routes in all. Every screen is built from `primitives.tsx` against the tokens
in `theme.ts`, so a token change moves the whole app at once.

## Offline behaviour

- **Cache.** The downloaded content pack and the latest snapshot live in SQLite,
  encrypted with AES-256-GCM. The key is 32 random bytes in the platform keystore.
  Each record is bound to its owner and cache key through the AEAD additional
  data, so a row cannot be lifted from one learner's profile into another's on a
  shared tablet. A record this build cannot decrypt is discarded and the cache
  degrades to empty — it never blocks sign-in.
- **Outbox.** Answers queue locally with a client-generated UUID and stay until
  the server acknowledges them. Retrying the same UUID is safe; the server
  acknowledges without paying a second reward.
- **Provisional feedback.** Student packs ship without answer keys, so the app
  never claims an answer is correct. Correctness and coins are labelled
  provisional until sync, and the server is the only grader.
- **Shared tablets.** A six-digit PIN per profile, with a device-bound pepper so a
  copied database cannot be used to guess PINs offline. The session auto-locks on
  inactivity.

## Design

The UI follows the K-Go Quests Figma file exactly — the colour, radius, elevation
and type tokens in `src/ui/theme.ts` are the Figma variable collection
transcribed, not approximated. Three type families: Outfit for headings and
labels, Public Sans for body, IBM Plex Mono for data. Motion is Reanimated 4:
staggered card entry, spring press feedback, animated progress bars and rings.

## Checks

```bash
npx tsc --noEmit
npx eslint src --max-warnings 0
```

Both must be clean. The React Compiler is enabled, so its lint rules are errors,
not warnings.

## What is not here

Handwriting OCR, free-text explanation scoring, avatar customisation, community
forums, MDM enrolment and offline voucher claiming are not implemented. Screens
that would show them say so on their face rather than displaying an empty list —
see `SPEC.md` in the repository root for which of those are planned and which are
out of reach.

`LICENSE` is the MIT license that shipped with the `create-expo-app` template and
covers that template.
