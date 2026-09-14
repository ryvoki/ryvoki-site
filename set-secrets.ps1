# Uploads the store's secrets to the Cloudflare Pages project. Run it yourself:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\austi\Desktop\ryvoki-site\set-secrets.ps1"
# It never prints the secret values. Re-run any time; each secret is simply overwritten.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$project = 'ryvoki-site'

function Put-FileSecret($name, $file) {
    if (-not (Test-Path $file)) { Write-Host "  SKIP $name ($file not found)" -ForegroundColor Yellow; return }
    Write-Host "`n==> $name (from $file)" -ForegroundColor Cyan
    Get-Content $file -Raw | npx wrangler pages secret put $name --project-name $project
}

function Put-TypedSecret($name, $hint) {
    Write-Host "`n==> $name" -ForegroundColor Cyan
    $answer = Read-Host "  Do you have your $hint ready to paste? (y/n)"
    if ($answer -notmatch '^[Yy]') { Write-Host "  Skipped. Re-run this script later for $name." -ForegroundColor Yellow; return }
    Write-Host "  Paste it at the prompt below and press Enter (it stays hidden)."
    npx wrangler pages secret put $name --project-name $project
}

Write-Host "Uploading secrets to Cloudflare Pages project '$project'..."
Put-FileSecret  'ADMIN_TOKEN'            'admin-token.txt'
Put-FileSecret  'LICENSE_SIGNING_KEY'    'signing-key.private.json'
Put-TypedSecret 'NOWPAYMENTS_API_KEY'    'NOWPayments API key'
Put-TypedSecret 'NOWPAYMENTS_IPN_SECRET' 'NOWPayments IPN secret'

Write-Host "`nDone. Current secrets on the project:" -ForegroundColor Green
npx wrangler pages secret list --project-name $project
