# Wingits media helper: reports whatever Windows thinks is playing (Spotify, browsers, VLC, ...)
# via the System Media Transport Controls, one JSON object per line on stdout.
# Commands arrive on stdin: toggle | next | prev | seek <seconds>
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($op, $type) {
  $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $t.Wait(-1)
  $t.Result
}
function Emit($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}

$mgrType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
$mgr = Await ($mgrType::RequestAsync()) $mgrType

function Get-Session {
  foreach ($s in $mgr.GetSessions()) {
    if ($s.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { return $s }
  }
  return $mgr.GetCurrentSession()
}

$readTask = [Console]::In.ReadLineAsync()
$lastKey = ''
$haveArt = $false
$artTries = 0
$tick = 0

while ($true) {
  $forceEmit = $false
  if ($readTask.IsCompleted) {
    $line = $readTask.Result
    if ($null -eq $line) { break }          # parent closed stdin: exit
    $readTask = [Console]::In.ReadLineAsync()
    try {
      $parts = $line.Trim().Split(' ')
      $s = Get-Session
      if ($s) {
        switch ($parts[0]) {
          'toggle' { $null = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
          'next'   { $null = Await ($s.TrySkipNextAsync()) ([bool]) }
          'prev'   { $null = Await ($s.TrySkipPreviousAsync()) ([bool]) }
          'seek'   { $null = Await ($s.TryChangePlaybackPositionAsync([long]([double]$parts[1] * 10000000))) ([bool]) }
        }
      }
    } catch { }
    $forceEmit = $true
  }

  if ($forceEmit -or ($tick % 4 -eq 0)) {
    try {
      $s = Get-Session
      if (-not $s) {
        Emit @{ active = $false }
      } else {
        $p = Await ($s.TryGetMediaPropertiesAsync()) $propsType
        $info = $s.GetPlaybackInfo()
        $tl = $s.GetTimelineProperties()
        $key = "$($s.SourceAppUserModelId)|$($p.Title)|$($p.Artist)|$($p.AlbumTitle)"
        if ($key -ne $lastKey) { $lastKey = $key; $haveArt = $false; $artTries = 0 }

        $art = $null
        if (-not $haveArt -and $artTries -lt 8 -and $p.Thumbnail) {
          $artTries++
          try {
            $st = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($st)
            $ms = New-Object System.IO.MemoryStream
            $net.CopyTo($ms)
            if ($ms.Length -gt 0) {
              $mime = $st.ContentType
              if (-not $mime) { $mime = 'image/jpeg' }
              $art = "data:$mime;base64," + [Convert]::ToBase64String($ms.ToArray())
              $haveArt = $true
            }
            $net.Dispose(); $st.Dispose()
          } catch { }
        }

        $playing = ($info.PlaybackStatus -eq 'Playing')
        $pos = $tl.Position.TotalSeconds
        $dur = ($tl.EndTime - $tl.StartTime).TotalSeconds
        if ($playing) { $pos += ([DateTimeOffset]::Now - $tl.LastUpdatedTime).TotalSeconds }
        if ($dur -gt 0 -and $pos -gt $dur) { $pos = $dur }
        if ($pos -lt 0) { $pos = 0 }

        $msg = @{
          active   = $true
          key      = $key
          app      = "$($s.SourceAppUserModelId)"
          title    = "$($p.Title)"
          artist   = "$($p.Artist)"
          album    = "$($p.AlbumTitle)"
          playing  = $playing
          position = [math]::Round($pos, 2)
          duration = [math]::Round($dur, 2)
          canNext  = [bool]$info.Controls.IsNextEnabled
          canPrev  = [bool]$info.Controls.IsPreviousEnabled
          canSeek  = [bool]$info.Controls.IsPlaybackPositionEnabled
        }
        if ($art) { $msg.art = $art }
        Emit $msg
      }
    } catch {
      Emit @{ active = $false; error = "$($_.Exception.Message)" }
    }
  }
  $tick++
  Start-Sleep -Milliseconds 250
}
