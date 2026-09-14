# Uploads the mail worker's secrets to Cloudflare. Run it yourself:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\austi\Desktop\ryvoki-site\mail\worker\set-secrets.ps1"
# It never prints the secret values. Re-run any time; each secret is simply overwritten.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

Write-Host "`n==> MAIL_TOKEN (from ..\..\mail-token.txt, the desktop app uses this)" -ForegroundColor Cyan
$tokenFile = Join-Path $PSScriptRoot '..\..\mail-token.txt'
if (Test-Path $tokenFile) { Get-Content $tokenFile -Raw | npx wrangler secret put MAIL_TOKEN } else { Write-Host "  SKIP: mail-token.txt not found" -ForegroundColor Yellow }

Write-Host "`n==> RESEND_API_KEY (for sending; from resend.com -> API Keys)" -ForegroundColor Cyan
$answer = Read-Host "  Do you have your Resend API key ready to paste? (y/n)"
if ($answer -match '^[Yy]') {
    Write-Host "  Paste it at the prompt below and press Enter (it stays hidden)."
    npx wrangler secret put RESEND_API_KEY
} else {
    Write-Host "  Skipped. Re-run this script later to add it. Receiving mail works without it." -ForegroundColor Yellow
}

Write-Host "`nDone. Secrets now on the worker:" -ForegroundColor Green
npx wrangler secret list
