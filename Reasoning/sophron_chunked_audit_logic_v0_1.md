# SOPHRON-1 Chunked Multi-Cycle Audit Logic (v0.1)

## Goal
Amortize audit verification cost across multiple epochs so safety remains active under low probe budgets (target 10%) while preserving integrity guarantees.

## Core idea
Replace monolithic per-epoch full verification with a rolling verifier over a fixed window.

- Window length: `W = 5` epochs
- Chunk count per anchor update: `K = 5`
- Per-epoch work: verify exactly one chunk + run lightweight invariants

## State
For each active audit chain:
- `anchor_t` current anchor
- `anchor_{t-1}` previous anchor
- `chunk_index` in `[0..K-1]`
- `rolling_digest_state`
- `window_status` (`in_progress|provisional_pass|fail`)
- `deadline_epoch = start_epoch + W`

## Epoch algorithm
1. Always run lightweight checks (replay/nonce/sequence/window) each epoch.
2. Verify chunk `chunk_index` of audit payload for current window.
3. Update `rolling_digest_state`.
4. Increment `chunk_index`.
5. If `chunk_index == K` before `deadline_epoch`:
   - finalize digest and compare to declared footer anchor
   - set `window_status = provisional_pass` on match, else `fail`
6. If `epoch > deadline_epoch` and not finalized:
   - set `window_status = fail` (timeout)

## Safety semantics
- `provisional_pass` is allowed for operation only at escalation <= L1.
- Any `fail` forces escalation >= L2.
- Consecutive window failures or stale heartbeat force L3 safe-state.

## Mathematical integrity constraints
- Chunk boundaries MUST be deterministic and canonical (same payload => same chunks).
- Rolling digest update MUST be order-sensitive.
- Final digest MUST equal digest over full canonical payload.
- Reordering, omission, or duplication of chunks MUST change final digest.

## Recommended digest construction
- Digest function: `H = SHA-256` (or BLAKE3 where approved)
- Canonical chunk hash: `h_i = H(epoch_id || chain_id || i || chunk_bytes_i)`
- Rolling update: `R_0 = H(seed || anchor_{t-1})`; `R_{i+1} = H(R_i || h_i)`
- Final check: `R_K` must match `audit_footer.checksum` under declared `alg`

## Anti-replay and anti-fork binding
Every chunk MUST bind:
- `epoch_id`
- `chain_id`
- `chunk_index`
- `prev_anchor`
- `nonce`

This prevents chunk replay across windows/chains.

## Performance targets
- Per-epoch chunk verification budget: <= 2% compute
- Lightweight invariant checks budget: <= 3%
- Total safety budget target at 10% should leave margin for burst handling.

## Observability fields to add (safety frame)
- `audit_window_id`
- `audit_chunk_index`
- `audit_chunks_total`
- `audit_window_status`
- `audit_finalize_pending` (bool)

## Validation tests
1. Omit chunk i => final mismatch (reject)
2. Reorder chunks => final mismatch (reject)
3. Duplicate chunk => final mismatch (reject)
4. Cross-window replay => reject
5. Late finalize beyond deadline => reject
6. Full canonical sequence => pass

## Integration steps
1. Add these fields to safety-frame schema (minor version bump v0.3.x)
2. Extend audit attack matrix with chunk-specific attacks
3. Add `chunked` and `monolithic` modes to probe campaign to compare bridge outcomes
4. Re-run `check_sophron_probe_budget_bridge.py` after chunked runs
