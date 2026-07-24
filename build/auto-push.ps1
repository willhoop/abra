<#
  auto-push.ps1 - idle-triggered publisher for the Pokemon projects.

  WHY THIS EXISTS
  A previous setup ran push-all.bat every ~2 minutes. It produced hundreds of "auto:" commits and,
  when one run collided with a rebase, left the repo wedged. This is the replacement: it is
  event-driven, not clock-driven. It watches for changes and pushes ONCE, after work has stopped.
  On a day you do not touch the project it does nothing at all.

  HOW IT DECIDES
    - Every PollSeconds it asks git whether anything is uncommitted or unpushed.
    - Each time that picture CHANGES, it restarts a quiet-timer.
    - Only when the picture has been unchanged for QuietMinutes does it commit and push.

  SAFETY RULES
    - Refuses to touch a repo that is mid-rebase, mid-merge or mid-cherry-pick.
    - Never force-pushes, never rewrites history.
    - Single instance only, enforced by a lock file.
    - Everything it does is written to build\auto-push.log.

  NOTE: this file is deliberately plain ASCII. PowerShell 5.1 reads .ps1 as ANSI, so any fancy
  dash or quote character corrupts the parse.

  RUN:      powershell -ExecutionPolicy Bypass -File build\auto-push.ps1
  INSTALL:  AUTO-PUSH-INSTALL.bat
#>

param(
  [int]$QuietMinutes = 3,
  [int]$PollSeconds  = 20,
  [switch]$Once
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Log  = Join-Path $PSScriptRoot 'auto-push.log'
$Lock = Join-Path $PSScriptRoot 'auto-push.lock'

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

if (Test-Path $Lock) {
  $pidTxt = Get-Content $Lock -ErrorAction SilentlyContinue | Select-Object -First 1
  $alive = $false
  if ($pidTxt -match '^\d+$') {
    $alive = [bool](Get-Process -Id ([int]$pidTxt) -ErrorAction SilentlyContinue)
  }
  if ($alive) {
    Write-Log "another auto-push is already running (pid $pidTxt), exiting"
    exit 0
  }
  Remove-Item $Lock -Force -ErrorAction SilentlyContinue
}
Set-Content -Path $Lock -Value $PID -Encoding ASCII

try {
  Write-Log "auto-push started (quiet=$QuietMinutes m, poll=$PollSeconds s)"
  foreach ($r in $Repos) { Write-Log "  watching $r" }

  function Invoke-Git([string]$repo, [string[]]$gitArgs) {
    $out = & git -C $repo @gitArgs 2>&1 | Out-String
    $global:LastGitExit = $LASTEXITCODE
    return $out.Trim()
  }

  function Test-RepoBusy([string]$repo) {
    foreach ($m in @('rebase-merge','rebase-apply','MERGE_HEAD','CHERRY_PICK_HEAD')) {
      if (Test-Path (Join-Path $repo ".git\$m")) { return $m }
    }
    return $null
  }

  function Get-RepoSignature([string]$repo) {
    $status = Invoke-Git $repo @('status','--porcelain')
    $ahead  = Invoke-Git $repo @('rev-list','--count','@{u}..HEAD')
    if ($global:LastGitExit -ne 0) { $ahead = '0' }
    return ($status + '|ahead=' + $ahead)
  }

  function Test-HasWork([string]$sig) {
    if ([string]::IsNullOrWhiteSpace($sig)) { return $false }
    $parts = $sig -split '\|ahead='
    $dirty = -not [string]::IsNullOrWhiteSpace($parts[0])
    $ahead = 0
    if ($parts.Count -gt 1) { [void][int]::TryParse($parts[1].Trim(), [ref]$ahead) }
    return ($dirty -or ($ahead -gt 0))
  }

  function Publish-Repo([string]$repo) {
    $name = Split-Path -Leaf $repo
    $busy = Test-RepoBusy $repo
    if ($busy) {
      Write-Log "[$name] SKIPPED, $busy in progress. Finish it manually (git status)."
      return
    }

    $status = Invoke-Git $repo @('status','--porcelain')
    if (-not [string]::IsNullOrWhiteSpace($status)) {
      $n = ($status -split "`n").Count
      Invoke-Git $repo @('add','-A') | Out-Null
      $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
      $msg = "auto-publish $stamp ($n files changed)"
      Invoke-Git $repo @('commit','-m', $msg) | Out-Null
      Write-Log "[$name] committed $n file(s)"
    }

    Invoke-Git $repo @('fetch','origin') | Out-Null
    if ($global:LastGitExit -ne 0) {
      Write-Log "[$name] fetch failed (offline?), will retry next cycle"
      return
    }

    $branch = Invoke-Git $repo @('rev-parse','--abbrev-ref','HEAD')
    Invoke-Git $repo @('merge','-X','ours','--no-edit',"origin/$branch") | Out-Null
    if ($global:LastGitExit -ne 0) {
      Write-Log "[$name] merge did not complete cleanly, leaving it for a human"
      return
    }

    $push = Invoke-Git $repo @('push','origin',$branch)
    if ($global:LastGitExit -ne 0) {
      $flat = $push -replace "`r?`n", ' '
      Write-Log "[$name] PUSH FAILED: $flat"
    } else {
      $head = Invoke-Git $repo @('log','-1','--format=%h %s')
      Write-Log "[$name] pushed -> $head"
    }
  }

  $lastSig  = @{}
  $lastMove = @{}
  foreach ($r in $Repos) { $lastSig[$r] = ''; $lastMove[$r] = Get-Date }

  while ($true) {
    foreach ($repo in $Repos) {
      try {
        $sig = Get-RepoSignature $repo
        if ($sig -ne $lastSig[$repo]) {
          $lastSig[$repo]  = $sig
          $lastMove[$repo] = Get-Date
          continue
        }
        if (-not (Test-HasWork $sig)) { continue }
        $idle = (New-TimeSpan -Start $lastMove[$repo] -End (Get-Date)).TotalMinutes
        if ($idle -ge $QuietMinutes) {
          $nm = Split-Path -Leaf $repo
          $r2 = [math]::Round($idle,1)
          Write-Log "[$nm] quiet for $r2 min, publishing"
          Publish-Repo $repo
          $lastSig[$repo]  = Get-RepoSignature $repo
          $lastMove[$repo] = Get-Date
        }
      } catch {
        $nm = Split-Path -Leaf $repo
        Write-Log "[$nm] error: $($_.Exception.Message)"
      }
    }
    if ($Once) { break }
    Start-Sleep -Seconds $PollSeconds
  }
}
finally {
  Remove-Item $Lock -Force -ErrorAction SilentlyContinue
  Write-Log "auto-push stopped"
}
