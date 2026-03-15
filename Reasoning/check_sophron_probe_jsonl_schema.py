#!/usr/bin/env python3
from __future__ import annotations
import subprocess

cmd = [
    "python",
    "Reasoning/check_jsonl_schema_generic.py",
    "--schema", "Reasoning/schemas/sophron_probe_budget_run.schema.json",
    "--raw-dir", "Reasoning/raw/probe_budget_runs",
    "--out", "Reasoning/sophron_probe_jsonl_schema_check.csv",
]
raise SystemExit(subprocess.run(cmd).returncode)
