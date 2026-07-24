<#
  auto-push.ps1 — idle-triggered publisher for the Pokemon projects.

  WHY THIS EXISTS
  A previous setup ran push-all.bat every ~2 minutes. It produced hundreds of "auto:" commits and,
  when one run collided with a rebase, left the repo wedged and fighting every other git operation.
  This script is the replacement: it is *event*-driven, not clock-driven. It watches for changes and
  pushes ONCE, after the work has stopped. On a day you do not touch the project it does nothing.

  HOW IT DECIDES
    - Every $PollSeconds it asks git whether anything is uncommitted or unpushed.
    - Each time that picture CHANGES, it restarts a quiet-timer.
    - Only when the picture has been unchanged for $QuietMinutes does it commit and push.
  So a working session produces one push at the end of it, not one every two minutes.

  SAFETY RULES (learned from the incident)
    - Refuses to touch a repo that is mid-rebase, mid-merge, or mid-cherry-pick.
    - Never force-pushes and never rewrites history.
    - Single instance only, enforced by a lock file.
    - Everything it does is written to build\auto-push.log.

  RUN:      powershell -ExecutionPolicy Bypass -File build\auto-push.ps1
  INSTALL:  AUTO-PUSH-INSTALL.bat   (starts it hidden at logon)
#>

param(
  [int]$QuietMinutes = 3,     # push once the repos have been unchanged this long
  [int]$PollSeconds  = 20,    # how often to look
  [switch]$Once               # run a single check and exit (for testing)
)

$ErrorActionPreference = 'Continue'
$Root  = Split-Path -Parent $PSScriptRoot          # ...\Pokemon\ABRA
$Log   = Join-Path $PSScriptRoot 'auto-push.log'
$Lock  = Join-Path $PSScriptRoot 'auto-push.lock'

# the three repos this publishes: ABRA, CHOMP, portfolio
$Repos = @(
  $Root,
  (Join-Path (Split-Path -Parent $Root) 'CHOMP'),
  (Join-Path (Split-Path -Parent (Split-Path -Parent $Root)) 'portfolio')
) | Where-Object { Test-Path (Join-Path $_ '.git') }

function Write-Log([string]$msg) {
  $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $Log -Value $line -Encoding UTF8
  Write-Host $line
}

# --- single instance ---------------------------------------------------------
if (Test-Path $Lock) {
  $pidTxt = (Get-Content $Lock -ErrorAction SilentlyContinue | Select-Object -First 1)
  $alive = $false
  if ($pidTxt -match '^\d+$') { $alive = [bool](Get-Process -Id ([int]$pidTxt) -ErrorAction SilentlyContinue) }
  if ($alive) { Write-Log "another auto-push is already running (pid $pidTxt) — exiting"; exit 0 }
  Remove-Item $Lock -Force -ErrorAction SilentlyContinue   # stale lock
}
Set-Content -Path $Lock -Value $PID -Encoding ASCII
try {

Write-Log "auto-push started (quiet=${QuietMinutes}m poll=${PollSeconds}s) watching: $($Repos -join ', ')"

# --- helpers -----------------------------------------------------------------
function Invoke-Git([string]$repo, [string[]]$gitArgs) {
  # returns combined stdout+stderr, sets $global:LastGitExit
  $out = & git -C $repo @gitArgs 2>&1 | Out-String
  $global:LastGitExit = $LASTEXITCODE
  return $out.Trim()
}

function Test-RepoBusy([string]$repo) {
  # a half-finished rebase/merge is exactly what broke things before — never write into one
  foreach ($m in 'rebase-merge','rebase-apply','MERGE_HEAD','CHERRY_PICK_HEAD','BISECT_LOG') {
    if (Test-Path (Join-Path $repo ".git\$m")) { return $m }
  }
  return $null
}

function Get-RepoSignature([string]$repo) {
  # a compact fingerprint of "what is outstanding here": dirty files + unpushed commit count.
  # When this string stops changing, the human has stopped working.
  $status = Invoke-Git $repo @('status','--porcelain')
  $ahead  = Invoke-Git $repo @('rev-list','--count','@{u}..HEAD')
  if ($global:LastGitExit -ne 0) { $ahead = '0' }   # no upstream yet
  return ($status + "|ahead=" + $ahead)
}

function Test-HasWork([string]$sig) {
  if ([string]::IsNullOrWhiteSpace($sig)) { return $false }
  $parts = $sig -split '\|ahead='
  $dirty = -not [string]::IsNullOrWhiteSpace($parts[0])
  $ahead = 0; if ($parts.Count -gt 1) { [int]::TryParse($parts[1].Trim(), [ref]$ahead) | Out-Null }
  return ($dirty -or $ahead -gt 0)
}

function Publish-Repo([string]$repo) {
  $name = Split-Path -Leaf $repo
  $busy = Test-RepoBusy $repo
  if ($busy) { Write-Log "[$name] SKIPPED — $busy in progress; finish it manually (git status)"; return }

  $status = Invoke-Git $repo @('status','--porcelain')
  if (-not [string]::IsNullOrWhiteSpace($status)) {
    $n = ($status -split "`n").Count
    Invoke-Git $repo @('add','-A') | Out-Null
    $msg = "auto-publish {0} ({1} file(s) changed)" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $n
    Invoke-Git $repo @('commit','-m', $msg) | Out-Null
    Write-Log "[$name] committed $n file(s)"
  }

  Invoke-Git $repo @('fetch','origin') | Out-Null
  if ($global:LastGitExit -ne 0) { Write-Log "[$name] fetch failed (offline?) — will retry next cycle"; return }

  # reconcile with whatever the cloud ingest Action pushed. .gitattributes marks the .jsonl stores
  # merge=union so appended games from both sides combine rather than conflict.
  $branch = Invoke-Git $repo @('rev-parse','--abbrev-ref','HEAD')
  $merge  = Invoke-Git $repo @('merge','-X','ours','--no-edit',"origin/$branch")
  if ($global:LastGitExit -ne 0) {
    Write-Log "[$name] merge did not complete cleanly — leaving it for a human. git status in $repo"
    return
  }

  $push = Invoke-Git $repo @('push','origin',$branch)
  if ($global:LastGitExit -ne 0) {
    Write-Log "[$name] PUSH FAILED: $($push -replace "`n",' ')"
  } else {
    $head = Invoke-Git $repo @('log','-1','--format=%h %s')
    Write-Log "[$name] pushed -> $head"
  }
}

# --- main loop ---------------------------------------------------------------
$lastSig  = @{}
$lastMove = @{}
foreach ($r in $Repos) { $lastSig[$r] = ''; $lastMove[$r] = Get-Date }

while ($true) {
  foreach ($repo in $Repos) {
    try {
      $sig = Get-RepoSignature $repo
      if ($sig -ne $lastSig[$repo]) {
        # something changed — restart this repo's quiet timer
        $lastSig[$repo]  = $sig
        $lastMove[$repo] = Get-Date
        continue
      }
      if (-not (Test-HasWork $sig)) { continue }      # nothing outstanding, stay silent
      $idle = (New-TimeSpan -Start $lastMove[$repo] -End (Get-Date)).TotalMinutes
      if ($idle -ge $QuietMinutes) {
        Write-Log "[$(Split-Path -Leaf $repo)] quiet for $([math]::Round($idle,1))m — publishing"
        Publish-Repo $repo
        $lastSig[$repo]  = Get-RepoSignature $repo
        $lastMove[$repo] = Get-Date
      }
    } catch {
      Write-Log "[$(Split-Path -Leaf $repo)] error: $($_.Exception.Message)"
    }
  }
  if ($Once) { break }
  Start-Sleep -Seconds $PollSeconds
}

} finally {
  Remove-Item $Lock -Force -ErrorAction SilentlyContinue
  Write-Log "auto-push stopped"
}
