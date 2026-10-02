param(
    [int]$ProcessId = 0,
    [int64]$PassThrough = 0,
    [switch]$Enable,
    [string]$HitTest = '',
    [string]$MoveCursor = '',
    [int64]$Poke = 0,
    [switch]$Quiet,
    [string]$Out = ''
)
# Lists the top-level HWNDs of Overtype (or of one process) as JSON:
# geometry in physical pixels, window region box, caption-producing styles,
# pass-through ex-styles, no-activate and tool-window bits. Evidence for the frameless silhouette that a WebView
# screenshot cannot give. Dev switches: -PassThrough <hwnd> [-Enable] sets or
# clears WS_EX_TRANSPARENT | WS_EX_LAYERED on one HWND; -HitTest x,y reports the
# window under a screen point (WindowFromPoint, root and owner process);
# -MoveCursor x,y moves the real cursor (the hit tester reads it); -Poke <hwnd> sends
# WM_NCACTIVATE(FALSE, 0), the message that painted a title band into the frameless
# window until 0.1.7, and compares the screen under the window's top band before and
# after (mean absolute difference per sampled channel: 0 when Windows painted nothing);
# -Quiet with -Poke takes the same two captures without sending anything: the control
# measures what already moves behind the window (a video, a slideshow);
# -Out <dir> also saves both captures (poke-before.png, poke-after.png).
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class FlowTranslateNativeProbe {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtr(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern IntPtr SetWindowLongPtr(IntPtr h, int i, IntPtr v);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetWindowRgnBox(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
}
"@
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$WS_EX_TRANSPARENT = 0x00000020; $WS_EX_LAYERED = 0x00080000
$describe = { param($h)
  $owner = 0; [void][FlowTranslateNativeProbe]::GetWindowThreadProcessId($h, [ref]$owner)
  $text = New-Object System.Text.StringBuilder 256; [void][FlowTranslateNativeProbe]::GetWindowText($h, $text, 256)
  [ordered]@{ hwnd = ('0x{0:X}' -f [int64]$h); pid = [int]$owner; title = $text.ToString() } }
if ($Poke) {
  Add-Type -AssemblyName System.Drawing
  $h = [IntPtr]$Poke
  $rect = New-Object FlowTranslateNativeProbe+RECT; [void][FlowTranslateNativeProbe]::GetWindowRect($h, [ref]$rect)
  $width = $rect.R - $rect.L; $band = [Math]::Min(48, $rect.B - $rect.T)
  $snap = {
    $bmp = New-Object System.Drawing.Bitmap($width, $band)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($rect.L, $rect.T, 0, 0, (New-Object System.Drawing.Size($width, $band)))
    $g.Dispose(); $bmp }
  $before = & $snap
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $returned = if ($Quiet) { -1 } else { [FlowTranslateNativeProbe]::SendMessage($h, 0x86, [IntPtr]0, [IntPtr]0) }
  $sendMs = $sw.ElapsedMilliseconds
  Start-Sleep -Milliseconds 150
  $after = & $snap
  $sum = 0.0; $lumBefore = 0.0; $lumAfter = 0.0; $samples = 0
  for ($y = 0; $y -lt $band; $y += 2) { for ($x = 0; $x -lt $width; $x += 4) {
    $a = $before.GetPixel($x, $y); $b = $after.GetPixel($x, $y)
    $sum += [Math]::Abs($a.R - $b.R) + [Math]::Abs($a.G - $b.G) + [Math]::Abs($a.B - $b.B)
    $lumBefore += ($a.R + $a.G + $a.B) / 3; $lumAfter += ($b.R + $b.G + $b.B) / 3
    $samples++ } }
  if ($Out -and -not $Quiet) { New-Item -ItemType Directory -Path $Out -Force | Out-Null; $before.Save((Join-Path $Out 'poke-before.png')); $after.Save((Join-Path $Out 'poke-after.png')) }
  $before.Dispose(); $after.Dispose()
  $rectAfter = New-Object FlowTranslateNativeProbe+RECT; [void][FlowTranslateNativeProbe]::GetWindowRect($h, [ref]$rectAfter)
  $moved = ($rectAfter.L -ne $rect.L) -or ($rectAfter.T -ne $rect.T) -or ($rectAfter.R -ne $rect.R) -or ($rectAfter.B -ne $rect.B)
  Write-Output (([ordered]@{ hwnd = ('0x{0:X}' -f $Poke); message = $(if ($Quiet) { 'none (control)' } else { 'WM_NCACTIVATE(FALSE, 0)' }); returned = [int64]$returned; sendMs = $sendMs; band = @{ x = $rect.L; y = $rect.T; width = $width; height = $band }; windowMoved = $moved; samples = $samples; meanDiff = [Math]::Round($sum / (3 * $samples), 3); luminanceBefore = [Math]::Round($lumBefore / $samples, 1); luminanceAfter = [Math]::Round($lumAfter / $samples, 1) }) | ConvertTo-Json -Compress -Depth 4)
  return
}
if ($MoveCursor) {
  $p = $MoveCursor -split ','; [void][FlowTranslateNativeProbe]::SetCursorPos([int]$p[0], [int]$p[1])
  Start-Sleep -Milliseconds 40
}
if ($HitTest) {
  $p = $HitTest -split ','
  $point = New-Object FlowTranslateNativeProbe+POINT; $point.X = [int]$p[0]; $point.Y = [int]$p[1]
  $hit = [FlowTranslateNativeProbe]::WindowFromPoint($point)
  $root = [FlowTranslateNativeProbe]::GetAncestor($hit, 2)
  $cursor = New-Object FlowTranslateNativeProbe+POINT; [void][FlowTranslateNativeProbe]::GetCursorPos([ref]$cursor)
  Write-Output (([ordered]@{ x = $point.X; y = $point.Y; hit = (& $describe $hit); root = (& $describe $root); cursor = @{ x = $cursor.X; y = $cursor.Y } }) | ConvertTo-Json -Compress -Depth 4)
  return
}
if ($PassThrough) {
  $h = [IntPtr]$PassThrough
  $ex = [int64][FlowTranslateNativeProbe]::GetWindowLongPtr($h, -20)
  $next = if ($Enable) { $ex -bor $WS_EX_TRANSPARENT -bor $WS_EX_LAYERED } else { $ex -band (-bnot ($WS_EX_TRANSPARENT -bor $WS_EX_LAYERED)) }
  [void][FlowTranslateNativeProbe]::SetWindowLongPtr($h, -20, [IntPtr]$next)
  Write-Output (([ordered]@{ hwnd = ('0x{0:X}' -f [int64]$h); before = ('0x{0:X}' -f $ex); after = ('0x{0:X}' -f [int64][FlowTranslateNativeProbe]::GetWindowLongPtr($h, -20)) }) | ConvertTo-Json -Compress)
  return
}
$owners = if ($ProcessId) { @($ProcessId) } else { @(Get-Process -Name Overtype -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id) }
$foreground = [FlowTranslateNativeProbe]::GetForegroundWindow()
$cursor = New-Object FlowTranslateNativeProbe+POINT; [void][FlowTranslateNativeProbe]::GetCursorPos([ref]$cursor)
$rows = New-Object System.Collections.Generic.List[string]
$callback = [FlowTranslateNativeProbe+EnumProc]{ param($h, $l)
  $owner = 0; [void][FlowTranslateNativeProbe]::GetWindowThreadProcessId($h, [ref]$owner)
  if ($owners -contains [int]$owner) {
    $text = New-Object System.Text.StringBuilder 256; [void][FlowTranslateNativeProbe]::GetWindowText($h, $text, 256)
    $style = [int64][FlowTranslateNativeProbe]::GetWindowLongPtr($h, -16)
    $exStyle = [int64][FlowTranslateNativeProbe]::GetWindowLongPtr($h, -20)
    $rect = New-Object FlowTranslateNativeProbe+RECT; [void][FlowTranslateNativeProbe]::GetWindowRect($h, [ref]$rect)
    $box = New-Object FlowTranslateNativeProbe+RECT; $regionType = [FlowTranslateNativeProbe]::GetWindowRgnBox($h, [ref]$box)
    $styles = @()
    if ($style -band 0x00C00000) { $styles += 'CAPTION' }
    if ($style -band 0x00040000) { $styles += 'THICKFRAME' }
    if ($style -band 0x00080000) { $styles += 'SYSMENU' }
    if ($style -band 0x00020000) { $styles += 'MINIMIZEBOX' }
    if ($style -band 0x00010000) { $styles += 'MAXIMIZEBOX' }
    $exStyles = @()
    if ($exStyle -band $WS_EX_TRANSPARENT) { $exStyles += 'TRANSPARENT' }
    if ($exStyle -band $WS_EX_LAYERED) { $exStyles += 'LAYERED' }
    $region = if ($regionType -eq 0) { $null } else { @{ width = $box.R - $box.L; height = $box.B - $box.T } }
    $row = [ordered]@{
      hwnd = ('0x{0:X}' -f [int64]$h)
      title = $text.ToString()
      visible = [FlowTranslateNativeProbe]::IsWindowVisible($h)
      foreground = ($h -eq $foreground)
      x = $rect.L; y = $rect.T; width = $rect.R - $rect.L; height = $rect.B - $rect.T
      region = $region
      styles = $styles
      exStyles = $exStyles
      # The halo's own bits and the Îlot's after its choice (lot 3), kept apart from exStyles,
      # whose exact list the probe compares with the hit tester's pass-through pair.
      noActivate = [bool]($exStyle -band 0x08000000)
      toolWindow = [bool]($exStyle -band 0x00000080)
      topmost = [bool]($exStyle -band 0x00000008)
      cursor = @{ x = $cursor.X; y = $cursor.Y }
    }
    $rows.Add(($row | ConvertTo-Json -Compress))
  }
  return $true }
[void][FlowTranslateNativeProbe]::EnumWindows($callback, [IntPtr]::Zero)
Write-Output ('[' + ($rows -join ',') + ']')
