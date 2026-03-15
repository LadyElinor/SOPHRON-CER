# SOPHRON-1 Cross-Plane Skew Summary

| Test | skew_ms | jitter_ms | loss% | expected | observed | pass |
|---|---:|---:|---:|---|---|---|
| SK-001 | 5.0 | 2.0 | 0.0 | pass | pass | True |
| SK-002 | 10.0 | 5.0 | 0.5 | pass | pass | True |
| SK-003 | 20.0 | 8.0 | 1.0 | pass | pass | True |
| SK-004 | 35.0 | 12.0 | 2.0 | reject | reject | False |
| SK-005 | 50.0 | 20.0 | 3.0 | reject | reject | False |

## Derived tolerance
- max passing skew (ms): `20.0`
