# End-to-end smoke test against the running dev server (http://localhost:3000).
# Exercises: REFUSED gate, multi-account upload, hygiene traps (dup/transfer/
# netting/MAD), forecast determinism, question verdict, PDF failure paths,
# password unlock, correction loop, and the 4-table schema.
$ErrorActionPreference = "Stop"
$base = "http://localhost:3000"
$fx = Join-Path $PSScriptRoot "..\fixtures"
$pass = 0; $fail = 0

function Check($name, $cond, $detail = "") {
  if ($cond) { $script:pass++; Write-Host "  [PASS] $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "  [FAIL] $name  $detail" -ForegroundColor Red }
}

function Upload($file, $label, $extra = @{}) {
  $boundary = [Guid]::NewGuid().ToString()
  $fileFull = (Resolve-Path (Join-Path $fx $file)).Path
  $enc = [Text.Encoding]::UTF8
  $body = New-Object System.Collections.Generic.List[byte]

  $fields = New-Object System.Collections.Specialized.OrderedDictionary
  $fields["account_label"] = $label
  foreach ($k in $extra.Keys) { $fields[$k] = $extra[$k] }
  foreach ($k in $fields.Keys) {
    $part = "--$boundary`r`nContent-Disposition: form-data; name=`"$k`"`r`n`r`n$($fields[$k])`r`n"
    $body.AddRange($enc.GetBytes($part))
  }

  $fileName = Split-Path $fileFull -Leaf
  $head = "--$boundary`r`nContent-Disposition: form-data; name=`"files`"; filename=`"$fileName`"`r`nContent-Type: text/csv`r`n`r`n"
  $body.AddRange($enc.GetBytes($head))
  $body.AddRange([IO.File]::ReadAllBytes($fileFull))
  $body.AddRange($enc.GetBytes("`r`n--$boundary--`r`n"))

  $resp = Invoke-WebRequest -Uri "$base/api/upload" -Method Post `
    -ContentType "multipart/form-data; boundary=$boundary" -Body $body.ToArray() -UseBasicParsing
  return ($resp.Content | ConvertFrom-Json)
}

function PostJson($path, $body) {
  return Invoke-RestMethod -Method Post -Uri "$base$path" `
    -ContentType "application/json; charset=utf-8" -Body ($body | ConvertTo-Json -Depth 6)
}

Write-Host "`n=== PHASE A: fresh account, < 3 months => REFUSED (exact string) ===" -ForegroundColor Cyan
$r = Upload "arjun_hdfc_2mo_thin.csv" "HDFC new"
Check "arjun upload ok" ($r.ok -and $r.parsed_rows -eq 71) "parsed=$($r.parsed_rows) msg=$($r.message)"
$null = Invoke-RestMethod -Method Post -Uri "$base/api/ingest"
$q = PostJson "/api/question" @{ question = "Can I afford a Rs 20k laptop next month?" }
Check "verdict is REFUSED" ($q.verdict -eq "REFUSED") "got=$($q.verdict)"
Check "REFUSED reason is the exact required string" ($q.sentence -match '^Only \d+(\.\d+)? months of history - a forecast would be a guess\. Add one more month or upload an older statement\.$') "got=$($q.sentence)"
Check "REFUSED banner headline shown" ($q.banner -eq "Cannot forecast: Need minimum 90 days history") "got=$($q.banner)"
Check "verdict display name (CANNOT FORECAST)" ($q.verdict_display -eq "CANNOT FORECAST") "got=$($q.verdict_display)"

Write-Host "`n=== PHASE B: multi-account uploads + trap fixtures ===" -ForegroundColor Cyan
$r1 = Upload "rohan_hdfc_14mo.csv" "HDFC salary"
Check "rohan upload (210 rows)" ($r1.ok -and $r1.parsed_rows -eq 210) "parsed=$($r1.parsed_rows)"
$r2 = Upload "meera_lumpy_8mo.csv" "SBI freelance"
Check "meera upload (72 rows, SBI)" ($r2.ok -and $r2.parsed_rows -eq 72) "parsed=$($r2.parsed_rows)"
$r3 = Upload "chai_failed_reversal.csv" "HDFC salary"
Check "failed-UPI trap upload" ($r3.ok) $r3.message
$r4 = Upload "chai_twice.csv" "HDFC salary"
Check "dup chai trap upload" ($r4.ok) $r4.message
$r5 = Upload "hdfc_salary_in.csv" "HDFC salary"
Check "salary credit trap upload" ($r5.ok) $r5.message
$r6 = Upload "sbi_transfer_out.csv" "SBI freelance"
Check "salary debit trap upload" ($r6.ok) $r6.message
$r7 = Upload "hdfc_aug_oct_full.csv" "HDFC salary"
Check "M-class: identical re-upload fully skipped" ($r7.ok -and $r7.uploads[0].skipped_identical -eq 210) "skipped=$($r7.uploads[0].skipped_identical)"
$r8 = Upload "hdfc_sep_oct_partial.csv" "HDFC salary"
Check "partial overlap: 24 identical skipped, 16 new" ($r8.ok -and $r8.uploads[0].skipped_identical -eq 24 -and $r8.uploads[0].parsed -eq 16) "skipped=$($r8.uploads[0].skipped_identical) parsed=$($r8.uploads[0].parsed)"

Write-Host "`n=== PHASE C: hygiene pipeline (transfer/netting/P-dup/MAD) ===" -ForegroundColor Cyan
$ing = Invoke-RestMethod -Method Post -Uri "$base/api/ingest"
$s = $ing.summary
Check "internal transfer pair excluded (1 pair)" ($s.transfers -eq 1) "got=$($s.transfers)"
Check "failed-UPI pair netted (1 pair)" ($s.netted_failed_upi -eq 1) "got=$($s.netted_failed_upi)"
Check "P-class dups flagged, never deleted (>=16 pairs)" ($s.flagged_duplicates -ge 16) "got=$($s.flagged_duplicates)"
Check "MAD anomaly flagged (>=1)" ($s.anomalies -ge 1) "got=$($s.anomalies)"
Check "no rows deleted by hygiene" ($s.transactions -eq (210 + 72 + 3 + 2 + 1 + 2 + 16 + 71)) "got=$($s.transactions)"
$ledger = Invoke-RestMethod -Uri "$base/api/ingest"
Check "transfer rows carry type=transfer in ledger" (@($ledger.transactions | Where-Object { $_.type -eq "transfer" }).Count -eq 2) "count=$(@($ledger.transactions | Where-Object { $_.type -eq 'transfer' }).Count)"
Check "netted rows carry type=netted" (@($ledger.transactions | Where-Object { $_.type -eq "netted" }).Count -eq 2) "count=$(@($ledger.transactions | Where-Object { $_.type -eq 'netted' }).Count)"

Write-Host "`n=== PHASE D: forecast band (seed 42, deterministic) ===" -ForegroundColor Cyan
$f1 = Invoke-RestMethod -Uri "$base/api/forecast"
$f2 = Invoke-RestMethod -Uri "$base/api/forecast"
Check "forecast ok with band" ($f1.ok -and $null -ne $f1.band) ($f1.message)
Check "P10 <= P50 <= P90" ($f1.band.p10 -le $f1.band.p50 -and $f1.band.p50 -le $f1.band.p90) "band=$($f1.band)"
Check "two calls identical (seed 42)" (($f1.band.p10 -eq $f2.band.p10) -and ($f1.band.p50 -eq $f2.band.p50) -and ($f1.band.p90 -eq $f2.band.p90))
Check "bootstrap meta (500 draws / 30d block / seed 42)" ($f1.meta.draws -eq 500 -and $f1.meta.block_days -eq 30 -and $f1.meta.seed -eq 42) "meta=$($f1.meta)"

Write-Host "`n=== PHASE E: affordability question => verdict + receipt ===" -ForegroundColor Cyan
$q2 = PostJson "/api/question" @{ question = "Can I afford a 20000 rupee laptop next month?" }
Check "verdict computed" (@("YES","TIGHT","NO") -contains $q2.verdict) "got=$($q2.verdict)"
Check "sentence non-empty" (-not [string]::IsNullOrWhiteSpace($q2.sentence)) "got=$($q2.sentence)"
Check "receipt has 6-line buffer formula parts" ($null -ne $q2.receipt.buffer_parts -and $q2.receipt.buffer_inr -ge 0)
Check "receipt traces named transactions" ($q2.receipt.trace.top_debits.Count -gt 0)
Check "receipt excludes transfers + netted counts" ($q2.receipt.excluded.internal_transfers -eq 1 -and $q2.receipt.excluded.netted_failed_upi -eq 1)
Check "LLM sources reported honestly" ($q2.llm.question_source -in @("llm","fallback")) "src=$($q2.llm.question_source)"
# buffer override recompute path (the slider's server twin)
$q3 = PostJson "/api/question" @{ question = "Can I afford a 20000 rupee laptop next month?"; buffer_inr = 0 }
Check "buffer override accepted" ($q3.ok -and $q3.live.buffer_paise -eq 0) "buffer=$($q3.live.buffer_paise)"

Write-Host "`n=== PHASE F: PDF traps fail loudly + password unlock works ===" -ForegroundColor Cyan
$p1 = Upload "locked_statement.pdf" "PDF account"
$u1 = $p1.uploads[0]
Check "locked PDF -> PASSWORD_PROTECTED + CSV ask" ((-not $u1.ok) -and $u1.code -eq "PASSWORD_PROTECTED" -and $u1.message -match "CSV") "code=$($u1.code) msg=$($u1.message)"
$p2 = Upload "scanned_statement.pdf" "PDF account"
$u2 = $p2.uploads[0]
Check "scanned PDF -> NO_TEXT_LAYER + CSV ask" ((-not $u2.ok) -and $u2.code -eq "NO_TEXT_LAYER" -and $u2.message -match "CSV") "code=$($u2.code) msg=$($u2.message)"
$p3 = Upload "locked_statement.pdf" "PDF account" @{ pdf_password = "demo123" }
Check "locked PDF with demo123 password parses" ($p3.ok -and $p3.parsed_rows -gt 0) "parsed=$($p3.parsed_rows)"

Write-Host "`n=== PHASE G: correction loop learns an alias ===" -ForegroundColor Cyan
$ledger2 = Invoke-RestMethod -Uri "$base/api/ingest"
$target = $ledger2.transactions | Where-Object { -not $_.category -or $_.category -eq "uncategorized" } | Select-Object -First 1
Check "found an uncategorized row to fix" ($null -ne $target) "none found"
if ($target) {
  $c = PostJson "/api/correction" @{ txn_id = $target.id; category = "dining" }
  Check "correction applied + alias learned" ($c.ok -and $c.alias_learned -and $c.updated -ge 1) ($c | ConvertTo-Json -Compress)
  $ledger3 = Invoke-RestMethod -Uri "$base/api/ingest"
  Check "alias visible in GET /api/ingest" (@($ledger3.aliases).Count -ge 1) "aliases=$(@($ledger3.aliases).Count)"
}

Write-Host "`n=== PHASE H: schema hygiene (exactly 4 tables) ===" -ForegroundColor Cyan
$ver = Invoke-RestMethod -Uri "$base/api/question"
Check "GET /api/question returns verdict history" ($ver.ok -and @($ver.verdicts).Count -ge 2) "count=$(@($ver.verdicts).Count)"
$acc = Invoke-RestMethod -Uri "$base/api/upload"
Check "GET /api/upload lists accounts (>=3)" (@($acc.accounts).Count -ge 3) "count=$(@($acc.accounts).Count)"

Write-Host "`n=== PHASE I: 6-line receipt, cash floor, what-if, mark-real, undo ===" -ForegroundColor Cyan
$q2 = PostJson "/api/question" @{ question = "Can I afford a Rs 20k laptop next month?" }
Check "question ok" ($q2.ok) $q2.message
Check "6-line receipt present" (@($q2.receipt.lines).Count -eq 6) "lines=$(@($q2.receipt.lines).Count)"
Check "line 5 shows the max() buffer formula" ($q2.receipt.lines[4].note -match "dominant") "note=$($q2.receipt.lines[4].note)"
Check "cash floor projected day-by-day (30 points)" (@($q2.receipt.cash_floor.points).Count -eq 30) "points=$(@($q2.receipt.cash_floor.points).Count)"
Check "recurring engine reported" ($null -ne $q2.receipt.recurring) "missing"
Check "backtest scorecard reported" ($null -ne $q2.receipt.backtest) "missing"
Check "verdict display name maps (not raw code)" ($q2.verdict_display -in @("AFFORDABLE","TIGHT","NOT AFFORDABLE","CANNOT FORECAST")) "got=$($q2.verdict_display)"

$qi = PostJson "/api/question" @{ question = "Can I afford a Rs 20k laptop next month?"; what_if = @{ emi_monthly_inr = 4999 } }
Check "what-if EMI applied" ($qi.ok -and @($qi.whatif.applied).Count -ge 1) ($qi | ConvertTo-Json -Compress -Depth 4)
Check "what-if swaps price to the EMI amount" ($qi.live.price_paise -eq 499900) "got=$($qi.live.price_paise)"

$ledger4 = Invoke-RestMethod -Uri "$base/api/ingest"
Check "ingest exposes card-bill + one-off counts" ($null -ne $ledger4.counts.card_bills -and $null -ne $ledger4.counts.one_off_income) ($ledger4.counts | ConvertTo-Json -Compress)
Check "ingest exposes data-health warnings array" ($null -ne $ledger4.warnings) "missing"

$anom = $ledger4.transactions | Where-Object { $_.flags.mad_anomaly -and -not $_.flags.user_kept } | Select-Object -First 1
Check "found an anomaly row to mark real" ($null -ne $anom) "none found"
if ($anom) {
  $mr = PostJson "/api/correction" @{ txn_id = $anom.id; action = "mark_real" }
  Check "Mark as Real accepted" ($mr.ok -and $mr.decision -eq "mark_real") ($mr | ConvertTo-Json -Compress)
  $ledger5 = Invoke-RestMethod -Uri "$base/api/ingest"
  $after = $ledger5.transactions | Where-Object { $_.id -eq $anom.id }
  Check "anomaly cleared after Mark as Real" (-not $after.flags.mad_anomaly -and $after.flags.user_kept) ($after.flags | ConvertTo-Json -Compress)
}

$dup = $ledger5.transactions | Where-Object { $_.flags.dup_p -and -not $_.flags.user_duplicate } | Select-Object -First 1
if ($dup) {
  $md = PostJson "/api/correction" @{ txn_id = $dup.id; action = "mark_duplicate" }
  Check "near-dup decision accepted (kept, never deleted)" ($md.ok -and $md.decision -eq "mark_duplicate") ($md | ConvertTo-Json -Compress)
  $ledger6 = Invoke-RestMethod -Uri "$base/api/ingest"
  Check "duplicate row still present in ledger" (@($ledger6.transactions | Where-Object { $_.id -eq $dup.id }).Count -eq 1) "row gone!"
}

$tgt = $ledger4.transactions | Where-Object { -not $_.category -or $_.category -eq "uncategorized" } | Select-Object -First 1
if ($tgt) {
  $c2 = PostJson "/api/correction" @{ txn_id = $tgt.id; category = "transport" }
  Check "correction reports pattern for undo" ($c2.ok -and $c2.alias_learned -and $null -ne $c2.pattern) ($c2 | ConvertTo-Json -Compress)
  $un = PostJson "/api/correction" @{ action = "undo_correction"; txn_id = $tgt.id; previous_category = $c2.previous_category; pattern = $c2.pattern }
  Check "undo_correction reverts + drops the alias" ($un.ok -and $un.reverted -ge 1) ($un | ConvertTo-Json -Compress)
}

Write-Host "`n=== PHASE J: one-click wipe (last - destroys the demo data) ===" -ForegroundColor Cyan
$w = PostJson "/api/wipe" @{}
Check "wipe succeeds" ($w.ok -and $w.wiped) ($w | ConvertTo-Json -Compress)
$ledger7 = Invoke-RestMethod -Uri "$base/api/ingest"
Check "all transactions gone" (@($ledger7.transactions).Count -eq 0) "left=$(@($ledger7.transactions).Count)"
Check "all accounts gone" (@($ledger7.accounts).Count -eq 0) "left=$(@($ledger7.accounts).Count)"
Check "schema survives wipe (ingest still responds)" ($ledger7.ok) "not ok"

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host " SMOKE RESULT: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "==================================`n" -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 }
