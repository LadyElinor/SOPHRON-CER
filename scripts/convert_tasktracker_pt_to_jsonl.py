"""convert_tasktracker_pt_to_jsonl.py

Offline converter for TaskTracker activation tensors (.pt) into SOPHRON-CER JSONL.

Why Python:
- TaskTracker artifacts are PyTorch .pt (torch.load).
- SOPHRON-CER is JS-native; we convert once, then train/eval probes in Node.

Expected TaskTracker shapes (per upstream notes; verify per artifact):
- train: [3, B, L, D] where dim0 = [primary_task, clean, poisoned]
- val/test: [2, B, L, D] where dim0 = [primary_task, full_text]

We emit JSONL lines in one of two formats:
A) delta-only (recommended for Node speed/memory):
  {"delta": [..D..], "y": 0|1, "meta": {"model":..., "layer":..., "src":...}}

B) before/after (heavier, but more faithful):
  {"before": [..D..], "after": [..D..], "y": 0|1, "meta": {...}}

By default we emit delta-only for a single selected layer.

Usage:
  python scripts/convert_tasktracker_pt_to_jsonl.py \
    --input_dir ./tasktracker_activations/mistral_test \
    --output ./tasktracker_mistral_test.layer-1.jsonl \
    --split test \
    --layer -1 \
    --label_mode filename \
    --delta_only

Notes:
- Val/test labels are inferred strictly from filename:
  - activations_0.pt -> clean (y=0)
  - activations_1.pt -> poisoned (y=1)
- Subsampling is supported via --max_rows.
"""

import argparse
import json
import os
from glob import glob

try:
    import torch
except ModuleNotFoundError as e:
    raise SystemExit(
        "PyTorch is required to read TaskTracker .pt artifacts. Install with: pip install torch\n"
        "(Pick the appropriate CUDA/CPU build for your machine.)"
    ) from e


def infer_label_from_filename(path: str) -> int:
    """TaskTracker val/test labeling convention:

    - activations_0.pt -> clean (y=0)
    - activations_1.pt -> poisoned (y=1)

    Anything else is treated as an error to avoid silent label corruption.
    """
    base = os.path.basename(path)
    if base == "activations_0.pt":
        return 0
    if base == "activations_1.pt":
        return 1
    raise ValueError(
        f"Unexpected filename for label inference: {base}. Expected activations_0.pt or activations_1.pt"
    )


def select_layer(t, layer: int):
    """t: Tensor [B, L, D]"""
    return t[:, layer, :]


def mean_pool_layers(t):
    """t: Tensor [B, L, D] -> [B, D]"""
    return t.mean(dim=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input_dir", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--split", choices=["train", "val", "test"], required=True)
    ap.add_argument("--layer", type=int, default=-1, help="Layer index (e.g., -1 for last)")
    ap.add_argument("--pool", choices=["layer", "mean"], default="layer")
    ap.add_argument("--label_mode", choices=["filename"], default="filename")
    ap.add_argument("--delta_only", action="store_true")
    ap.add_argument("--max_rows", type=int, default=0, help="0 = no cap")
    ap.add_argument("--model", default="", help="Optional provenance string")
    args = ap.parse_args()

    pt_files = sorted(glob(os.path.join(args.input_dir, "*.pt")))
    if not pt_files:
        raise SystemExit(f"No .pt files found in {args.input_dir}")

    rows_written = 0

    with open(args.output, "w", encoding="utf-8") as f:
        for pt_path in pt_files:
            obj = torch.load(pt_path, map_location="cpu")
            if not torch.is_tensor(obj):
                obj = torch.tensor(obj)
            # Normalize dtype for stable downstream JSONL (avoid float16/bfloat16 surprises)
            obj = obj.float()

            if args.split == "train":
                if obj.shape[0] != 3:
                    raise ValueError(f"Expected train[0]=3, got {tuple(obj.shape)}")
                primary = obj[0]   # [B,L,D]
                clean = obj[1]
                poisoned = obj[2]

                # choose pooling
                if args.pool == "mean":
                    prim_v = mean_pool_layers(primary)
                    clean_v = mean_pool_layers(clean)
                    pois_v = mean_pool_layers(poisoned)
                    layer_repr = "mean"
                else:
                    prim_v = select_layer(primary, args.layer)
                    clean_v = select_layer(clean, args.layer)
                    pois_v = select_layer(poisoned, args.layer)
                    layer_repr = str(args.layer)

                # delta = after - before
                clean_delta = (clean_v - prim_v).numpy()
                pois_delta = (pois_v - prim_v).numpy()

                for i in range(clean_delta.shape[0]):
                    for delta, y, variant in (
                        (clean_delta[i], 0, "clean"),
                        (pois_delta[i], 1, "poisoned"),
                    ):
                        # Shapes (train): primary/clean/poisoned each [B, L, D]
                        B, L, D = primary.shape
                        meta = {
                            "src": os.path.basename(pt_path),
                            "split": "train",
                            "variant": variant,
                            "layer": layer_repr,
                            "model": args.model,
                            "example_idx": int(i),
                            "batch_size": int(B),
                            "layers": int(L),
                            "dim": int(D),
                        }
                        if args.delta_only:
                            rec = {"delta": delta.tolist(), "y": y, "meta": meta}
                        else:
                            rec = {"before": prim_v[i].numpy().tolist(), "after": (prim_v[i].numpy() + delta).tolist(), "y": y, "meta": meta}
                        f.write(json.dumps(rec) + "\n")
                        rows_written += 1
                        if args.max_rows and rows_written >= args.max_rows:
                            return

            else:
                if obj.shape[0] != 2:
                    raise ValueError(f"Expected {args.split}[0]=2, got {tuple(obj.shape)}")
                primary = obj[0]  # [B,L,D]
                full = obj[1]

                y = infer_label_from_filename(pt_path)

                if args.pool == "mean":
                    prim_v = mean_pool_layers(primary)
                    full_v = mean_pool_layers(full)
                    layer_repr = "mean"
                else:
                    prim_v = select_layer(primary, args.layer)
                    full_v = select_layer(full, args.layer)
                    layer_repr = str(args.layer)

                delta = (full_v - prim_v).numpy()

                for i in range(delta.shape[0]):
                    # Shapes (val/test): primary/full each [B, L, D]
                    B, L, D = primary.shape
                    meta = {
                        "src": os.path.basename(pt_path),
                        "split": args.split,
                        "layer": layer_repr,
                        "model": args.model,
                        "example_idx": int(i),
                        "batch_size": int(B),
                        "layers": int(L),
                        "dim": int(D),
                    }
                    if args.delta_only:
                        rec = {"delta": delta[i].tolist(), "y": y, "meta": meta}
                    else:
                        rec = {"before": prim_v[i].numpy().tolist(), "after": full_v[i].numpy().tolist(), "y": y, "meta": meta}
                    f.write(json.dumps(rec) + "\n")
                    rows_written += 1
                    if args.max_rows and rows_written >= args.max_rows:
                        return


if __name__ == "__main__":
    main()
