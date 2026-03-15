#!/usr/bin/env python3
from __future__ import annotations
import subprocess

cmd = [
    "python",
    "Reasoning/check_jsonl_schema_generic.py",
    "--schema", "Reasoning/schemas/sophron_skew_run.schema.json",
    "--raw-dir", "Reasoning/raw/skew_runs",
    "--out", "Reasoning/sophron_skew_jsonl_schema_check.csv",
]
raise SystemExit(subprocess.run(cmd).returncode)
