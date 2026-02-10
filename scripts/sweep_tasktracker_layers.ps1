param(
  [string]$InputDir = ".\tasktracker_activations\mistral__7B\test",
  [string]$Model = "mistral__7B",
  [ValidateSet('val','test','train')]
  [string]$Split = "test",
  [int]$Steps = 1000,
  [double]$Lr = 0.005,
  [double]$L2 = 1e-4,
  [double]$Threshold = 0.5
)

$ErrorActionPreference = "Stop"

$variants = @(
  @{ Name = "last"; Args = "--layer -1 --pool layer" },
  @{ Name = "mid15"; Args = "--layer 15 --pool layer" },
  @{ Name = "mean"; Args = "--pool mean" }
)

Write-Host "Starting layer sweep for $Model $Split" -ForegroundColor Cyan
Write-Host "Input: $InputDir`n"

$rows = @()

foreach ($v in $variants) {
  $name = $v.Name
  $args = $v.Args

  $outputJsonl = ".\tasktracker_${Model}_${Split}.${name}.jsonl"

  Write-Host "==> Converting: $name" -ForegroundColor Yellow
  $convertCmd = "python .\scripts\convert_tasktracker_pt_to_jsonl.py --input_dir `"$InputDir`" --output `"$outputJsonl`" --split $Split --model $Model $args --delta_only"
  Write-Host $convertCmd -ForegroundColor DarkGray
  Invoke-Expression $convertCmd

  Write-Host "==> Training/eval: $name" -ForegroundColor Yellow
  $cliCmd = "node .\src\cli.js activation-drift-proxy --jsonl `"$outputJsonl`" --steps $Steps --lr $Lr --l2 $L2 --threshold $Threshold"
  Write-Host $cliCmd -ForegroundColor DarkGray

  $json = Invoke-Expression $cliCmd | Out-String | ConvertFrom-Json
  $rows += [pscustomobject]@{
    variant   = $name
    n         = $json.metrics.n
    rocAuc    = $json.metrics.rocAuc
    accuracy  = $json.metrics.accuracy
    threshold = $json.metrics.threshold
    outJsonl  = $outputJsonl
  }

  Write-Host ""  
}

Write-Host "Sweep complete.`n" -ForegroundColor Cyan
$rows | Format-Table -AutoSize

Write-Host "\nTip: JSONL outputs are in the current directory:" -ForegroundColor DarkGray
$rows | ForEach-Object { Write-Host "  $($_.outJsonl)" -ForegroundColor DarkGray }
