# Wingits media helper: reports whatever Windows thinks is playing (Spotify, browsers, VLC, ...)
# via the System Media Transport Controls, one JSON object per line on stdout.
# Reads nothing from stdin except EOF, which tells it to exit when the app closes.
$ErrorActionPreference = 'Stop'
$logFile = Join-Path $env:TEMP 'wingits-media.log'
function Log($text) {
  try { Add-Content -Path $logFile -Value ("{0:s} {1}" -f (Get-Date), $text) } catch { }
}
# Raw UTF-8 stdout/stdin streams: avoids Console encoding setters, which can throw when redirected.
$utf8 = New-Object System.Text.UTF8Encoding($false)
$stdout = New-Object System.IO.StreamWriter([Console]::OpenStandardOutput(), $utf8)
$stdout.AutoFlush = $true
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), $utf8)
function Emit($obj) {
  $stdout.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
}
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType,Windows.Storage.Streams,ContentType=WindowsRuntime]
  $null = [Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
} catch {
  Log "setup failed: $($_.Exception.Message)"
  Emit @{ active = $false; error = "Windows media APIs unavailable: $($_.Exception.Message)" }
  exit 1
}

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($op, $type) {
  $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $t.Wait(-1)
  $t.Result
}
$mgrType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
try {
  $mgr = Await ($mgrType::RequestAsync()) $mgrType
} catch {
  Log "session manager failed: $($_.Exception.Message)"
  Emit @{ active = $false; error = "Could not open the media session manager: $($_.Exception.Message)" }
  exit 1
}

function Get-Session {
  foreach ($s in $mgr.GetSessions()) {
    if ($s.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { return $s }
  }
  return $mgr.GetCurrentSession()
}

$readTask = $stdin.ReadLineAsync()
$lastKey = ''
$haveArt = $false
$artTries = 0
$tick = 0

while ($true) {
  if ($readTask.IsCompleted) {
    if ($null -eq $readTask.Result) { break }   # EOF: the app closed our stdin, so exit
    $readTask = $stdin.ReadLineAsync()
  }

  if ($tick % 4 -eq 0) {
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
        if (-not $haveArt -and $artTries -lt 20 -and $p.Thumbnail) {
          $artTries++
          try {
            $st = Await ($p.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            $bytes = $null
            try {   # method 1: DataReader
              $size = [uint32]$st.Size
              if ($size -gt 0) {
                $reader = [Windows.Storage.Streams.DataReader]::new($st)
                $null = Await ($reader.LoadAsync($size)) ([uint32])
                $bytes = New-Object byte[] $size
                $reader.ReadBytes($bytes)
                $reader.DetachStream() | Out-Null
              }
            } catch { Log "thumbnail DataReader failed: $($_.Exception.Message)" }
            if (-not $bytes -or $bytes.Length -eq 0) {
              try {   # method 2: classic .NET stream adapter
                $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($st)
                $ms = New-Object System.IO.MemoryStream
                $net.CopyTo($ms)
                $bytes = $ms.ToArray()
              } catch { Log "thumbnail AsStreamForRead failed: $($_.Exception.Message)" }
            }
            if ($bytes -and $bytes.Length -gt 0) {
              $mime = $st.ContentType
              if (-not $mime) { $mime = 'image/jpeg' }
              $art = "data:$mime;base64," + [Convert]::ToBase64String($bytes)
              $haveArt = $true
            } else { Log "no thumbnail bytes for $key (try $artTries)" }
            $st.Dispose()
          } catch { Log "thumbnail failed: $($_.Exception.Message)" }
        } elseif (-not $p.Thumbnail -and $artTries -eq 0) {
          $artTries = 99
          Log "player reports no thumbnail for $key"
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
      Log "poll failed: $($_.Exception.Message)"
      Emit @{ active = $false; error = "$($_.Exception.Message)" }
    }
  }
  $tick++
  Start-Sleep -Milliseconds 250
}
