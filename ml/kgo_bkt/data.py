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

SEQUENCE_QUERY = """
SELECT a."skillCode"  AS skill_code,
       a."studentId"  AS student_id,
       a.correct      AS correct
FROM attempts a
ORDER BY a."skillCode", a."studentId", a."occurredAt", a.id
"""


def load_sequences(database_url: str, schema: str = "public") -> dict[str, list[list[int]]]:
    """Returns {skillCode: [[0/1, ...], ...]}.

    Every attempt counts, including repeats of the same exercise: BKT models a
    practice sequence, so a second attempt is evidence too.
    """
    try:
        import psycopg
    except ImportError as error:  # pragma: no cover - depends on the environment
        raise SystemExit(
            "psycopg is required to read from Postgres. Run: pip install -r requirements.txt"
        ) from error

    grouped: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            # Pin the schema, then confirm the table is really there: a silent
            # fallback to an empty table in another schema looks exactly like
            # "this skill has no practice yet", which is the worst failure mode
            # a fitter can have.
            cursor.execute(f'SET search_path TO "{schema}"')
            cursor.execute("SELECT to_regclass(%s)", (f"{schema}.attempts",))
            if cursor.fetchone()[0] is None:
                raise SystemExit(
                    f'No "attempts" table in schema "{schema}". '
                    f"Check DATABASE_SCHEMA in the backend's .env and pass --schema to match."
                )
            cursor.execute(SEQUENCE_QUERY)
            for skill_code, student_id, correct in cursor:
                grouped[skill_code][student_id].append(int(bool(correct)))

    return {skill: list(students.values()) for skill, students in grouped.items()}


def describe(sequences: dict[str, list[list[int]]]) -> str:
    skills = len(sequences)
    learners = sum(len(v) for v in sequences.values())
    answers = sum(len(s) for v in sequences.values() for s in v)
    return f"{skills} skills · {learners} learner-sequences · {answers} answers"
