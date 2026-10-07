"""Pull practice sequences out of the K-Go Quests Postgres database.

One sequence per (learner, skill), ordered by when the learner answered — not
by when the server received it, because offline answers arrive in bursts long
after the practice happened.

The schema matters. The backend puts its tables in DATABASE_SCHEMA (`kgo` in
this deployment), and a stale `attempts` table can easily still exist in
`public` from an earlier setup. Resolving the table through the default
search_path would then read the wrong one and report "no data" — so the schema
is set explicitly and verified before the query runs.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class CountedAttempt:
    skill_code: str
    student_id: str
    correct: int
    occurred_at: datetime
    id: str


COUNTED_SEQUENCE_QUERY = """
WITH counted AS (
  SELECT DISTINCT ON (a."studentId", a."exerciseId")
         a."skillCode"  AS skill_code,
         a."studentId"  AS student_id,
         a.correct      AS correct,
         a."occurredAt" AS occurred_at,
         a.id           AS id,
         a.source       AS source
  FROM attempts a
  ORDER BY a."studentId", a."exerciseId", a."occurredAt", a.id
)
SELECT skill_code, student_id, correct, occurred_at, id
FROM counted
WHERE (%s OR source != 'demo')
ORDER BY occurred_at, id
"""


def load_counted_attempts(
    database_url: str,
    schema: str = "public",
    include_demo: bool = False,
) -> list[CountedAttempt]:
    """Pull Counted Attempts out of Postgres.

    A Counted Attempt is the learner's first answer to an Exercise. Demo-seeded
    history is excluded unless include_demo=True.
    """
    try:
        import psycopg
    except ImportError as error:  # pragma: no cover - depends on the environment
        raise SystemExit(
            "psycopg is required to read from Postgres. Run: pip install -r requirements.txt"
        ) from error

    attempts: list[CountedAttempt] = []
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO "{schema}"')
            cursor.execute("SELECT to_regclass(%s)", (f"{schema}.attempts",))
            if cursor.fetchone()[0] is None:
                raise SystemExit(
                    f'No "attempts" table in schema "{schema}". '
                    f"Check DATABASE_SCHEMA in the backend's .env and pass --schema to match."
                )
            cursor.execute(COUNTED_SEQUENCE_QUERY, (include_demo,))
            for skill_code, student_id, correct, occurred_at, row_id in cursor:
                attempts.append(
                    CountedAttempt(
                        skill_code=skill_code,
                        student_id=str(student_id),
                        correct=int(bool(correct)),
                        occurred_at=occurred_at,
                        id=str(row_id),
                    )
                )
    return attempts


def attempts_to_sequences(attempts: list[CountedAttempt]) -> dict[str, list[list[int]]]:
    """Group Counted Attempts into per-skill, per-learner sequences."""
    grouped: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
    for a in sorted(attempts, key=lambda x: (x.occurred_at, x.id)):
        grouped[a.skill_code][a.student_id].append(a.correct)
    return {skill: list(students.values()) for skill, students in grouped.items()}


def split_by_learner_no_leakage(
    attempts: list[CountedAttempt],
    test_learner_ratio: float = 0.2,
    time_quantile: float = 0.75,
) -> tuple[list[CountedAttempt], list[CountedAttempt]]:
    """Split Counted Attempts by Learner with zero future leakage.

    1. Disjoint learners: train learners and test learners share no IDs.
    2. Zero future leakage: every train attempt occurred at or before split time,
       and every test attempt occurred after split time, so no training attempt
       is ever later than an attempt it evaluates.
    """
    if not attempts:
        return [], []
    sorted_attempts = sorted(attempts, key=lambda a: (a.occurred_at, a.id))
    students = list(dict.fromkeys(a.student_id for a in sorted_attempts))
    if len(students) < 2:
        return sorted_attempts, []

    cutoff_idx = max(0, min(len(sorted_attempts) - 1, int(len(sorted_attempts) * time_quantile)))
    split_time = sorted_attempts[cutoff_idx].occurred_at

    post_split_students = list(dict.fromkeys(a.student_id for a in sorted_attempts if a.occurred_at > split_time))
    n_test = max(1, int(len(students) * test_learner_ratio))

    if not post_split_students:
        test_students = set(students[-n_test:])
        train_students = set(students) - test_students
        train = [a for a in sorted_attempts if a.student_id in train_students]
        test = [a for a in sorted_attempts if a.student_id in test_students]
        return train, test

    test_students = set(post_split_students[:n_test])
    train_students = set(students) - test_students

    train_attempts = [a for a in sorted_attempts if a.student_id in train_students and a.occurred_at <= split_time]
    test_attempts = [a for a in sorted_attempts if a.student_id in test_students and a.occurred_at > split_time]

    if not train_attempts:
        train_attempts = [a for a in sorted_attempts if a.student_id in train_students]

    return train_attempts, test_attempts


def load_sequences(
    database_url: str,
    schema: str = "public",
    include_demo: bool = False,
) -> dict[str, list[list[int]]]:
    """Returns {skillCode: [[0/1, ...], ...]} for Counted Attempts."""
    attempts = load_counted_attempts(database_url, schema=schema, include_demo=include_demo)
    return attempts_to_sequences(attempts)


def describe(sequences: dict[str, list[list[int]]]) -> str:
    skills = len(sequences)
    learners = sum(len(v) for v in sequences.values())
    answers = sum(len(s) for v in sequences.values() for s in v)
    return f"{skills} skills · {learners} learner-sequences · {answers} answers"

