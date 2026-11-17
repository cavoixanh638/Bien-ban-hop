@echo off
setlocal
cd /d "%~dp0"
echo.
echo =============================================
echo BIEN BAN HOP V1.2 - G10 ALPHA (CHUA NGHIEM THU)
echo =============================================
echo Chi dung de thu voi du lieu gia lap.
echo Khong su dung cho cuoc hop quan trong.
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo KHONG TIM THAY NODE.JS. Hay cai Node.js 22 LTS truoc khi chay.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo KHONG TIM THAY npm. Hay kiem tra Node.js trong PATH.
  pause
  exit /b 1
)
if not exist "node_modules\vite\package.json" (
  echo Dang cai dependency tai thu muc app...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Cai dependency that bai; kiem tra ket noi mang va proxy.
    pause
    exit /b 1
  )
)
echo.
echo Mo Chrome/Edge va truy cap: http://127.0.0.1:5173/
echo De dung server, bam Ctrl+C trong cua so nay.
echo.
call npm run dev
echo.
echo Server da dung.
pause
