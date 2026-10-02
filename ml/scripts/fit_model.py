#!/usr/bin/env python3
"""Fit per-skill BKT parameters and write them as JSON.

    # validate the pipeline with no learners yet
    python3 scripts/fit_model.py --source synthetic --out model.json

    # fit against the real database
    python3 scripts/fit_model.py --source postgres --out model.json \
        --database-url postgresql://kgo:...@localhost:5432/kgo

The JSON is imported into the backend by its own CLI; this script never writes
to the database itself.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kgo_bkt import BktParams, DEFAULT, fit_skill, simulate
from kgo_bkt.data import describe, load_sequences
from kgo_bkt.fit import MIN_OBSERVATIONS, MIN_SEQUENCES

# A stand-in cohort so the whole path can be exercised before launch.
SYNTHETIC_SKILLS = {
    "demo.math5.fractions.equivalent": BktParams(0.30, 0.14, 0.17, 0.06),
    "demo.math5.fractions.add": BktParams(0.18, 0.10, 0.20, 0.08),
    "demo.math5.decimals.numberline": BktParams(0.22, 0.09, 0.24, 0.05),
    "demo.science5.lifecycles": BktParams(0.35, 0.16, 0.15, 0.07),
    "demo.english5.inference": BktParams(0.12, 0.06, 0.26, 0.09),
}


def build_synthetic() -> dict[str, list[list[int]]]:
    return {
        skill: simulate(params, n_learners=420, items_per_learner=14, seed=index * 13 + 5)
        for index, (skill, params) in enumerate(SYNTHETIC_SKILLS.items())
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Fit BKT parameters per skill.")
    parser.add_argument("--source", choices=["synthetic", "postgres"], default="synthetic")
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    parser.add_argument(
        "--schema",
        default=os.environ.get("DATABASE_SCHEMA", "public"),
        help="Postgres schema holding the backend tables (DATABASE_SCHEMA in the backend .env)",
    )
    parser.add_argument("--out", default="model.json")
    parser.add_argument("--version", default="")
    parser.add_argument("--restarts", type=int, default=10)
    args = parser.parse_args()

    if args.source == "postgres":
        if not args.database_url:
            parser.error("--database-url or DATABASE_URL is required for --source postgres")
        sequences = load_sequences(args.database_url, args.schema)
    else:
        sequences = build_synthetic()

    if not sequences:
        print("No practice data found — nothing to fit.", file=sys.stderr)
        return 1

    stamp = datetime.now(timezone.utc)
    version = args.version or f"bkt-{'sim' if args.source == 'synthetic' else 'em'}-{stamp:%Y%m%d}"
    scope = args.source if args.source == "synthetic" else f"postgres schema={args.schema}"
    print(f"source: {scope} · {describe(sequences)}\n")

    skills: dict[str, dict] = {}
    for skill in sorted(sequences):
        result = fit_skill(sequences[skill], restarts=args.restarts, skill=skill)
        skills[skill] = result.as_dict()
        flag = "fitted " if result.fitted else "default"
        print(
            f"  {flag}  {skill:<38} "
            f"prior={result.params.prior:.3f} learn={result.params.learn:.3f} "
            f"guess={result.params.guess:.3f} slip={result.params.slip:.3f} "
            f"({result.observations} answers)"
        )
        if not result.fitted:
            print(f"           {result.note}")

    document = {
        "modelVersion": version,
        "fittedAt": stamp.isoformat(),
        "source": args.source,
        "method": "Expectation-Maximisation (Baum-Welch) on a constrained two-state BKT HMM",
        "minimums": {"sequences": MIN_SEQUENCES, "observations": MIN_OBSERVATIONS},
        "defaults": DEFAULT.as_dict(),
        "skills": skills,
    }
    Path(args.out).write_text(json.dumps(document, indent=2, allow_nan=False) + "\n", encoding="utf-8")

    fitted = sum(1 for value in skills.values() if value["fitted"])
    print(f"\nwrote {args.out} · version {version} · {fitted}/{len(skills)} skills fitted")
    if args.source == "synthetic":
        print("NOTE: synthetic parameters. Never import these into a production database.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
