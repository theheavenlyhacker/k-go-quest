# The front door does not gate the product

The app opens on Welcome — a splash, three Onboarding steps and a sign-in with a Student, Teacher
or Admin Role. None of it is required. Every route out of that screen, signed in or not, ends at
the same place: a Shared Tablet ready for Setup. Signing in adds Online Mode and takes nothing
away.

This is the rule the screen was built around, not a concession made afterwards. A tablet delivered
to a school with no signal has to reach a Learner answering a question, and a sign-in is the one
thing such a tablet can never complete.

## Considered options

- **Require sign-in, as the design drew it.** The Figma has a Log in screen with no way past it,
  and the concept document says plainly that students have accounts and that sessions are bound
  one to an ID. Rejected because it inverts the product: `docs/online-mode.md` opens with *offline
  is the product, online is an accelerator*, and a tablet in a barangay with no connection would
  be stopped on its first screen by a server it cannot reach. The failure is also silent — the
  sign-in simply never succeeds, with nothing on screen to say the network is the reason.
- **Drop the sign-in and keep Setup as the first screen.** What the app did before. Rejected
  because the Roles are real: the backend has carried `STUDENT`, `TEACHER` and `LGU_ADMIN` since
  the first migration, a Learner account is what makes a **Linked Profile** possible, and there
  was no screen anywhere that let a Learner sign in to their own account. The Caretaker screen
  could link a Profile, which meant an adult typing a child's password.
- **Show the sign-in only when a network is detected.** Rejected because reachability is not a
  boolean a first launch can trust — a captive portal, a school Wi-Fi that resolves but does not
  route, a radio that comes up after the screen does. A door the Caretaker can always walk past is
  simpler than a door that guesses.

## Consequences

- The Role chips are a statement of intent, not an authorisation. The server decides what an
  account is; a mismatch says which it actually is rather than failing blankly. This matters
  because the chip is chosen before the password is typed and is therefore often wrong.
- A Learner signing in at Welcome has no Profile yet, so the session is **held** and attached to
  the first Profile Setup creates. That is the first moment a link has two ends. If the
  attachment fails — no Classroom, server gone — the Profile is already made and works offline,
  and the failure is shown rather than thrown.
- Welcome is shown once per tablet, recorded in its own key, so a restart during Setup does not
  replay the Onboarding. A failed write costs the Caretaker the screens again, never any data.
- **Continue with Google** signs in to the **Caretaker Account**, not to a Server Account: it
  answers *who owns this tablet*, where a Role comes from the server. The two are reached from
  one screen and are not the same thing, which is the most likely place for this design to be
  misread later.
- `CONTEXT.md` had to be reopened. Three of its resolved ambiguities said the opposite of this
  screen — that a child is only ever a **Learner**, that Teacher and admin collapse into one
  **Caretaker**, and that only the Caretaker ever signs in. All three are now narrowed rather
  than deleted: the tablet's words are unchanged, and **Student**, **Teacher** and **Admin**
  are the names of **Roles** a **Server Account** carries.
- Known limit: the Register link does not open a registration screen. Accounts are issued by a
  school or an LGU, and self-registration would create an unprovisioned account with no
  Classroom, which is a Profile that can never sync. The link says so instead.
