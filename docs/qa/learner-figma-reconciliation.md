# Learner Figma reconciliation (#76)

Scope approved for this change: Library, Progress, and Introduction.
The reference viewport is 375 × 812 logical points. Sizes are logical points,
not screenshot pixels; Android screenshots must account for display density.

## Screen map

All node IDs refer to [K-Go Quests in Figma](https://www.figma.com/design/Sz4QcNaFmYiI9UdyLMjDhn/K-Go-Quests).

| Implemented screen | Light frame | Dark frame | Scope / intentional differences |
| --- | --- | --- | --- |
| Learn / Offline Library | 34:10 | 255:6 | Reconciled colors, rectangular app bar, book glyphs, Subject-first hierarchy. Quests remain below Subjects and download status. Real Pack titles, lesson counts, download availability and sync state replace sample values. |
| Progress | 34:893 | 255:481 | Subject bars and compact stats replace rings and the quarterly chart. Mastery remains the engine estimate; daily Attempt counts replace study-time minutes, which are not recorded. Real Growth, verdict feedback and Plateau Flags remain. Badges are owned Cosmetics, not fabricated achievements. |
| Introduction slide 1 | 139:3835 | 266:148 | Lexend type, teal book, 148-point illustration, 295-point text width and decorative corners. Safe areas, scrolling, large text and real glossary copy take precedence over fixed placeholder geometry. |
| Introduction slide 2 | 139:3836 | 266:188 | Same introduction layout. Fixed Pack Author Hints replace the reference AI Tutor wording. |
| Introduction slide 3 | 139:3838 | 266:227 | Same introduction layout. Coins buy Cosmetics; no vouchers or competition claims. Reward copy is handled by #74. |
| League | 34:279 | 255:151 | Mapped only; screen layout outside this change. Classroom League and offline empty state remain; no Learner ranking is added. |
| Hints | 34:585 | 255:334 | Mapped only; screen layout outside this change. Label remains Hints and explanations are authored, not generated. |
| Rewards | 34:1192 | 255:684 | Mapped only; screen layout outside this change. Real Coin balance and Cosmetic prices replace placeholders. |
| Learner Sidebar | 139:2592–139:3270 | 266:266–266:1285 | Mapped only; navigation, appearance preferences and Caretaker separation remain. |
| Subject / Lesson player / Profile picker / PIN unlock | No authoritative frame supplied in this issue | No authoritative frame supplied in this issue | Existing functional routes preserved; parity is not asserted. |

Shared palette and text primitives affect other screens too; their complete
layout parity, including Teacher/admin screens, is not claimed.

## Shared design choices

- Light: page `#fbf8f2`, text `#1c1b1f`, secondary `#5c5b66`,
  muted `#8e8d99`, border `#e9e5dc`, app bar `#0e5e56`.
- Dark: page `#12181a`, surface `#1e2628`, border `#2a3335`,
  text `#f3f1ea`, secondary `#d7dadf`, muted `#8a9098`, app bar `#0a3e38`.
- Subjects: Math teal, English amber, Filipino green, Science coral,
  using the supplied brighter dark-frame colors in Library and Progress.
- Lexend Medium/Bold/ExtraBold are bundled through Expo Google Fonts and
  loaded with the existing font-loading gate. Numeric tables keep the
  existing monospace font. There is no runtime font download.
- Content scrolls within safe-area side padding. The app bar lets title and
  subtitle wrap; its extra Sync status row remains so queued uploads stay
  visible at enlarged text sizes. Native OS status text follows appearance.
- The Intro dark primary button retains the existing dark app-bar fill for
  white-text contrast instead of white text on the bright teal Figma fill.
  Corner decoration uses translucent native circles; it is decorative and
  omitted from accessibility. Figma blur halos are not reproduced.

## Verification

Figma context and screenshots inspected for all three primary light frames
and their corresponding dark frames. Mobile lint/typecheck and focused
Progress/Library/Intro tests are required, followed by the full suite.

Android API 36 emulator / Expo Go SDK 57 started for native inspection.
Existing Profiles are preserved; their test PIN is awaiting confirmation.
Phone/tablet portrait/landscape, light/dark, large-text screenshots and
protected-route regression checks are pending until access is available.
A passing unit-test suite is not a layout-parity or release-readiness result.

Capture Library, Progress and Introduction at 375 × 812 logical points,
landscape phone, and tablet viewports in both appearances. Repeat at OS
font scale 1.5 or greater. Record OS, build/commit, size/density, font scale
and screenshot paths with observed differences. Use only demo Profiles.
