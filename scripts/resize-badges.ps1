Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root ".tmp-badges"
$dst = Join-Path $root "public\assets\img"
foreach ($n in @("master","legend","legend1","mythic")) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $src "$n.png"))
  $bmp = New-Object System.Drawing.Bitmap 320,320
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($img, 0, 0, 320, 320)
  $bmp.Save((Join-Path $dst "rank-$n.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  Write-Host "wrote rank-$n.png"
}
