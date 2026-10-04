# The answer key decides Grading Mode, not the Pack's field

A Content Pack carries a `grading` field, and the server's download response carries a
`gradingMode` of its own, but what a Shared Tablet can actually do with an Exercise is decided by
one thing: whether the answer key for it arrived. We derive Grading Mode from the key's presence,
per Lesson, and treat both fields as non-authoritative.

## Considered options

- **Read `Pack.grading`.** The obvious path, and the field exists for it. Rejected because the
  field's granularity is wrong: the key is per Exercise and the field is per Pack, so a Pack whose
  Lessons disagree has no correct value. It was also demonstrably unreliable — `packs.ts` writes
  `ON_SYNC` for every Downloaded Pack regardless of what the server said, and flipping the field to
  `ON_DEVICE` changed no behaviour anywhere, because nothing read it.
- **Trust the server's `gradingMode` in the download response.** Rejected because it can disagree
  with the content beside it: a response could claim `ON_DEVICE` while carrying no key, and then the
  tablet would promise instant marking it cannot deliver.

## Consequences

- `Mixed` is a real third answer, not an error. A Pack holding both keyed and unkeyed Lessons reads
  as partly On Sync rather than being forced onto one side.
- A Learner's screen can tell an **Unmarked Attempt** from an unopened Exercise, which it could not
  before: three screens each derived the mode independently and two stated it wrongly.
- `Pack.grading` now has no reader. It is still written in two places, and whether to delete it is
  open. Until then, treat it as an echo of the Pack Author's intent, not as something to branch on
  — wiring it back up re-introduces the bug this decision exists to remove.
- Known limit: two Packs sharing a `skillCode` still let one Pack's Lesson display Mastery earned
  in the other, because provenance is per Skill and not per Lesson. Out of scope here.
