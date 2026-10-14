@echo off
chcp 65001 > nul
REM KNOT 서버 시작. 화면을 다시 빌드하려면: start.bat build
REM .env에 AUTH_ENABLED=1, SERVE_FRONTEND=1 을 넣어 두면 http://127.0.0.1:8000 하나로 열린다
cd /d "%~dp0"

if /I "%1"=="build" (
  pushd frontend
  call npm run build
  if errorlevel 1 (
    echo 화면 빌드에 실패했습니다.
    popd
    pause
    exit /b 1
  )
  popd
)

if not exist frontend\dist\index.html (
  echo frontend\dist가 없습니다. 먼저 "start.bat build"를 실행하세요.
  pause
  exit /b 1
)

call .venv\Scripts\activate.bat
cd src
REM DB에 빠진 표와 칸이 있으면 더한다 (이미 있으면 그냥 지나간다)
python -m scripts.migrate
if errorlevel 1 (
  echo DB 준비에 실패했습니다. MySQL이 켜져 있는지 확인하세요.
  pause
  exit /b 1
)
echo.
echo KNOT: http://127.0.0.1:8000  (끄려면 Ctrl+C)
uvicorn main:app --host 127.0.0.1 --port 8000
