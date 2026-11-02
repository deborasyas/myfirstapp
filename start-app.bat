@echo off
title Smart Grocery & Budget Safety Tracker
echo ================================================================
echo   SMART GROCERY & BUDGET SAFETY TRACKER (PWA)
echo   Mode: Multi-Device Realtime Cloud Firestore
echo ================================================================
echo.
echo Sedang mendeteksi IP jaringan untuk akses HP...

set LOCAL_IP=localhost
for /f "tokens=4" %%a in ('route print 0.0.0.0 2^>nul ^| findstr 0.0.0.0 ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
    goto :ip_found
)

:ip_found
echo.
echo ================================================================
echo   [OK] Server Lokal Siap Digunakan!
echo   Buka di PC ini : http://localhost:3000
echo   Buka di HP     : http://%LOCAL_IP%:3000
echo ================================================================
echo.
echo Tips: Pastikan HP dan PC berada di jaringan Wi-Fi yang sama.
echo Tekan Ctrl + C di jendela ini untuk mematikan server.
echo.

start http://localhost:3000

powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://*:3000/'); try { $listener.Start(); Write-Host 'Server HTTP aktif di port 3000...'; while ($listener.IsListening) { $ctx = $listener.GetContext(); $req = $ctx.Request; $res = $ctx.Response; $urlPath = $req.RawUrl.Split('?')[0]; if ($urlPath -eq '/' -or $urlPath -eq '') { $urlPath = '/index.html' }; $localPath = '.' + $urlPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar); if (Test-Path $localPath -PathType Leaf) { $bytes = [System.IO.File]::ReadAllBytes($localPath); $ext = [System.IO.Path]::GetExtension($localPath).ToLower(); switch ($ext) { '.html' { $res.ContentType = 'text/html; charset=utf-8' } '.css' { $res.ContentType = 'text/css; charset=utf-8' } '.js' { $res.ContentType = 'application/javascript; charset=utf-8' } '.json' { $res.ContentType = 'application/json; charset=utf-8' } '.jpg' { $res.ContentType = 'image/jpeg' } '.jpeg' { $res.ContentType = 'image/jpeg' } '.png' { $res.ContentType = 'image/png' } '.svg' { $res.ContentType = 'image/svg+xml' } default { $res.ContentType = 'application/octet-stream' } }; $res.OutputStream.Write($bytes, 0, $bytes.Length); $res.Close(); } else { $res.StatusCode = 404; $res.Close(); } } } catch { Write-Host 'Port 3000 mungkin sedang dipakai atau butuh Run as Administrator. Anda tetap bisa membuka index.html langsung di browser.' -ForegroundColor Yellow; Start-Process 'index.html' }"
pause

