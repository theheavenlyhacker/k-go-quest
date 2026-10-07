"""K-Go Quests model service.

Hosts the project's own BKT models. It does three things the Nest backend
cannot do in-process:

  * fit parameters from practice logs (EM, numpy)
  * answer "how likely is this learner to get the next item right"
  * rank what a learner should practise next by expected mastery gain

It deliberately does NOT score attempts. The backend updates mastery inline
during sync, in TypeScript, and duplicating that arithmetic here would give the
same model two implementations that can silently drift apart. Scoring stays in
one place; this service does the parts that need Python.

Importing fitted parameters into the database also stays with the backend's
`model:import` CLI, so there is exactly one writer to model_versions — the one
with the synthetic-parameter and degeneracy guards.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from kgo_bkt import DEFAULT, BktParams, fit_skill
from kgo_bkt.data import (
    describe,
    load_counted_attempts,
    attempts_to_sequences,
    split_by_learner_no_leakage,
)
from kgo_bkt.fit import MIN_OBSERVATIONS, MIN_SEQUENCES
from kgo_bkt.model import evaluate_log_loss, predict_correct, update_mastery

from .settings import Settings, load

settings: Settings = load()
app = FastAPI(
    title="K-Go Quests model service",
    description="Self-hosted Bayesian Knowledge Tracing. No third-party inference.",
    version="1.0.0",
)


def authorise(authorization: Annotated[str | None, Header()] = None) -> None:
    import secrets

    expected = f"Bearer {settings.token}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing bearer token")


Guarded = Depends(authorise)


# ----------------------------------------------------------------- schemas --
class SkillState(BaseModel):
    skillCode: str = Field(min_length=1, max_length=100)
    mastery: float = Field(ge=0.0, le=1.0)


class PredictRequest(BaseModel):
    skills: list[SkillState] = Field(min_length=1, max_length=200)


class Prediction(BaseModel):
    skillCode: str
    mastery: float
    probabilityCorrect: float
    source: str


class RecommendRequest(BaseModel):
    skills: list[SkillState] = Field(min_length=1, max_length=200)
    limit: int = Field(default=5, ge=1, le=50)


class Recommendation(BaseModel):
    skillCode: str
    mastery: float
    expectedGain: float
    probabilityCorrect: float
    reason: str


class FitRequest(BaseModel):
    schema_: str | None = Field(default=None, alias="schema")
    version: str | None = Field(default=None, max_length=60)
    restarts: int = Field(default=10, ge=1, le=40)
    include_demo: bool = Field(default=False, alias="includeDemo")


# ------------------------------------------------------------------ params --
def params_for(codes: set[str]) -> tuple[dict[str, BktParams], str | None]:
    """Active fitted parameters, falling back to the shared defaults."""
    if not settings.has_database:
        return {}, None
    import psycopg

    with psycopg.connect(settings.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO "{settings.schema}"')
            cursor.execute('SELECT version FROM model_versions WHERE active = true LIMIT 1')
            row = cursor.fetchone()
            if not row:
                return {}, None
            version = row[0]
            cursor.execute(
                'SELECT "skillCode", prior, learn, guess, slip FROM skill_model_params '
                'WHERE "modelVersion" = %s AND "skillCode" = ANY(%s)',
                (version, list(codes)),
            )
            found = {
                code: BktParams(prior=p, learn=l, guess=g, slip=s)
                for code, p, l, g, s in cursor.fetchall()
            }
    return found, version


# ---------------------------------------------------------------- endpoints --
@app.get("/health")
def health() -> dict:
    """Liveness plus whether the database and an active model are reachable."""
    database, active = "not configured", None
    if settings.has_database:
        try:
            tuned, active = params_for(set())
            database = "ok"
        except Exception as error:  # noqa: BLE001 - surfaced, not swallowed
            database = f"unreachable: {type(error).__name__}"
    return {
        "status": "ok",
        "database": database,
        "activeModel": active,
        "defaults": DEFAULT.as_dict(),
        "minimums": {"sequences": MIN_SEQUENCES, "observations": MIN_OBSERVATIONS},
    }


@app.post("/predict", response_model=list[Prediction], dependencies=[Guarded])
def predict(request: PredictRequest) -> list[Prediction]:
    """Probability the learner answers the next item correctly."""
    tuned, version = params_for({s.skillCode for s in request.skills})
    out = []
    for skill in request.skills:
        params = tuned.get(skill.skillCode, DEFAULT)
        out.append(
            Prediction(
                skillCode=skill.skillCode,
                mastery=skill.mastery,
                probabilityCorrect=round(predict_correct(skill.mastery, params), 4),
                source=version if skill.skillCode in tuned else "shared defaults",
            )
        )
    return out


@app.post("/recommend", response_model=list[Recommendation], dependencies=[Guarded])
def recommend(request: RecommendRequest) -> list[Recommendation]:
    """Rank skills by expected movement in the mastery estimate.

    Expected gain is the probability-weighted change in mastery across both
    outcomes. Under BKT it decreases monotonically with mastery — the learn
    transition contributes (1 - posterior) * learn, so there is most room to
    move where the learner knows least. In practice this ranks weakest-first,
    the same ordering the backend's /learning/quests already uses, now with
    per-skill fitted parameters instead of one global guess.

    Be aware of the failure mode: weakest-first sends a learner to the material
    they are most likely to get wrong, and probabilityCorrect is returned
    alongside so a caller can temper that. Turning this into a real recommender
    needs a prerequisite graph — "you are failing fractions because you never
    got equivalent denominators" — and the schema has no skill prerequisites
    yet. This is an honest policy over fitted parameters, not a trained model.
    """
    tuned, version = params_for({s.skillCode for s in request.skills})
    scored = []
    for skill in request.skills:
        params = tuned.get(skill.skillCode, DEFAULT)
        p_correct = predict_correct(skill.mastery, params)
        gain = (
            p_correct * (update_mastery(skill.mastery, True, params) - skill.mastery)
            + (1 - p_correct) * (update_mastery(skill.mastery, False, params) - skill.mastery)
        )
        scored.append(
            Recommendation(
                skillCode=skill.skillCode,
                mastery=round(skill.mastery, 4),
                expectedGain=round(gain, 5),
                probabilityCorrect=round(p_correct, 4),
                reason=(
                    "Already strong — little left to gain"
                    if skill.mastery > 0.9
                    else "Weakest skill — most room to move, but expect wrong answers"
                    if skill.mastery < 0.3
                    else "Partly learned — steady gain with a fair chance of success"
                ),
            )
        )
    scored.sort(key=lambda r: r.expectedGain, reverse=True)
    return scored[: request.limit]


@app.get("/models", dependencies=[Guarded])
def models() -> dict:
    """Fitted model versions recorded in the database."""
    if not settings.has_database:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_URL is not configured")
    import psycopg

    with psycopg.connect(settings.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO "{settings.schema}"')
            cursor.execute(
                'SELECT version, method, source, active, "fittedAt", skills '
                "FROM model_versions ORDER BY \"fittedAt\" DESC"
            )
            rows = cursor.fetchall()
    return {
        "items": [
            {"version": v, "method": m, "source": s, "active": a, "fittedAt": f.isoformat(), "skills": k}
            for v, m, s, a, f, k in rows
        ],
        "total": len(rows),
    }


@app.post("/fit", dependencies=[Guarded])
def fit(request: FitRequest) -> dict:
    """Refit every skill from the practice logs and return the model document.

    Nothing is written to the database. Import the returned document with the
    backend's `npm run model:import`, which holds the synthetic-parameter and
    degeneracy guards — one writer, one set of rules.
    """
    if not settings.has_database:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_URL is not configured")
    schema = request.schema_ or settings.schema
    try:
        attempts = load_counted_attempts(settings.database_url, schema, include_demo=request.include_demo)
    except SystemExit as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from error
    if not attempts:
        msg = f'No practice data in schema "{schema}"'
        if not request.include_demo:
            msg += " (demo-seeded history excluded; pass include_demo=true to include it)"
        raise HTTPException(status.HTTP_409_CONFLICT, msg)

    # 1. Learner-level split without future leakage
    train_attempts, test_attempts = split_by_learner_no_leakage(attempts)
    train_seqs = attempts_to_sequences(train_attempts)
    test_seqs = attempts_to_sequences(test_attempts)

    # 2. Fit on train set
    eval_params: dict[str, BktParams] = {}
    for code, seqs in train_seqs.items():
        res = fit_skill(seqs, restarts=request.restarts, skill=code, min_sequences=10, min_observations=30)
        eval_params[code] = res.params

    # 3. Evaluate held-out log-loss
    fitted_loss, default_loss, test_obs = evaluate_log_loss(test_seqs, eval_params, DEFAULT)
    beats_default = fitted_loss < default_loss if test_obs > 0 else False

    # 4. Final fit on all Counted Attempts
    full_seqs = attempts_to_sequences(attempts)
    stamp = datetime.now(timezone.utc)
    version = request.version or f"bkt-em-{stamp:%Y%m%d%H%M}"
    skills = {
        code: fit_skill(full_seqs[code], restarts=request.restarts, skill=code).as_dict()
        for code in sorted(full_seqs)
    }
    source_label = "demo" if request.include_demo else "postgres"
    return {
        "modelVersion": version,
        "fittedAt": stamp.isoformat(),
        "source": source_label,
        "method": "Expectation-Maximisation (Baum-Welch) on a constrained two-state BKT HMM",
        "minimums": {"sequences": MIN_SEQUENCES, "observations": MIN_OBSERVATIONS},
        "defaults": DEFAULT.as_dict(),
        "dataset": describe(full_seqs),
        "fitted": sum(1 for s in skills.values() if s["fitted"]),
        "evaluation": {
            "heldOutLogLoss": round(fitted_loss, 4),
            "defaultLogLoss": round(default_loss, 4),
            "beatsDefault": beats_default,
            "testObservations": test_obs,
            "testLearners": len({a.student_id for a in test_attempts}),
        },
        "skills": skills,
    }
