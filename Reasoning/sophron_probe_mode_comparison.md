# SOPHRON Probe Mode Comparison

| mode | budget | pass_rows/rows | mean p95 (ms) | mean fnr | mean throughput penalty | mean latency CV | min latency margin (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| monolithic | 5 | 0/5 | 266.922 | 0.015809 | 4.497 | 0.058519 | -76.647 |
| chunked | 10 | 5/5 | 169.721 | 0.0 | 9.609 | 0.042149 | 18.482 |
| monolithic | 10 | 0/5 | 221.602 | 0.006674 | 8.994 | 0.037344 | -33.388 |
| monolithic | 15 | 0/5 | 198.746 | 0.002547 | 13.93 | 0.061269 | -11.228 |
| chunked | 20 | 5/5 | 129.782 | 0.0 | 19.415 | 0.039632 | 57.978 |
| monolithic | 20 | 3/5 | 183.059 | 0.000598 | 18.916 | 0.040309 | 4.884 |
| chunked | 25 | 5/5 | 124.54 | 0.0 | 24.484 | 0.058558 | 64.787 |
| monolithic | 25 | 3/5 | 177.614 | 0.000623 | 23.69 | 0.068596 | 15.136 |

## Bridge comparator

- chunked@10 pass_rows: 5/5 (coverage rows 5)
- monolithic@25 pass_rows: 3/5 (coverage rows 5)
- comparator winner (by pass_rows): **chunked@10**
- robustness: chunked@10 min latency margin=18.482 ms, mean latency CV=0.042149
