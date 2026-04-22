@echo off
cd /d "%~dp0"

set "PYTHONPATH=%cd%\.venv\Lib\site-packages;%PYTHONPATH%"

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" app.py
) else if exist "%ProgramFiles%\Inkscape\bin\python.exe" (
  "%ProgramFiles%\Inkscape\bin\python.exe" app.py
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    py app.py
  ) else (
    python app.py
  )
)

pause
