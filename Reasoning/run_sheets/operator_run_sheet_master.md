# SOPHRON Operator Master Run Sheet

1. Run probe campaign using `operator_run_sheet_probe_budget.md`
2. Run skew campaign using `operator_run_sheet_skew_injection.md`
3. Ingest + validate all evidence:
   - `python Reasoning/run_sophron_real_evidence_pipeline.py`
4. Review status card:
   - `Reasoning/sophron_unc_status_card.md`
