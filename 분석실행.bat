@echo off
title Radar Analysis v2

echo.
echo ============================================================
echo   Radar Chart Analyzer v2.0 - Success / Fail Analysis
echo ============================================================
echo.

cd /d "%~dp0"

:: --- Find Python ---
echo [1/3] Finding Python...

set PYTHON_EXE=

python -c "import sys; print(sys.executable)" >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%p in ('python -c "import sys; print(sys.executable)"') do set PYTHON_EXE=%%p
)

if "%PYTHON_EXE%"=="" (
    for %%d in (
        "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"
        "%LOCALAPPDATA%\Python\pythoncore-3.13-64\python.exe"
        "%LOCALAPPDATA%\Python\pythoncore-3.12-64\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
        "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
        "C:\Python314\python.exe"
        "C:\Python313\python.exe"
        "C:\Python312\python.exe"
        "C:\Python311\python.exe"
    ) do (
        if exist %%~d (
            set PYTHON_EXE=%%~d
            goto :found
        )
    )
)

:found
if "%PYTHON_EXE%"=="" (
    echo.
    echo [ERROR] Python not found.
    echo   Please install from: https://www.python.org/downloads/
    echo   Check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo %PYTHON_EXE% | findstr /i "WindowsApps" >nul
if not errorlevel 1 (
    echo.
    echo [ERROR] Microsoft Store Python is not supported.
    echo   Please install real Python from python.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('"%PYTHON_EXE%" --version 2^>^&1') do set PY_VER=%%v
echo  OK: %PY_VER%
echo  Path: %PYTHON_EXE%

:: --- Install packages ---
echo.
echo [2/3] Checking packages...

"%PYTHON_EXE%" -c "import pandas" >nul 2>&1
if errorlevel 1 (
    echo  Installing pandas...
    "%PYTHON_EXE%" -m pip install pandas --quiet --disable-pip-version-check
    if errorlevel 1 goto :pip_error
)

"%PYTHON_EXE%" -c "import openpyxl" >nul 2>&1
if errorlevel 1 (
    echo  Installing openpyxl...
    "%PYTHON_EXE%" -m pip install openpyxl --quiet --disable-pip-version-check
    if errorlevel 1 goto :pip_error
)

"%PYTHON_EXE%" -c "import matplotlib" >nul 2>&1
if errorlevel 1 (
    echo  Installing matplotlib...
    "%PYTHON_EXE%" -m pip install matplotlib --quiet --disable-pip-version-check
    if errorlevel 1 goto :pip_error
)

"%PYTHON_EXE%" -c "import numpy" >nul 2>&1
if errorlevel 1 (
    echo  Installing numpy...
    "%PYTHON_EXE%" -m pip install numpy --quiet --disable-pip-version-check
    if errorlevel 1 goto :pip_error
)

echo  OK: All packages ready

:: --- Run analysis ---
echo.
echo [3/3] Running analysis...
echo.
echo   HOW TO USE:
echo     - Put your .xlsx file in this folder and run this bat
echo     - Excel must have a column with "success"/"fail" values
echo     - If no file found, sample data is auto-created
echo     - Results saved in output\ folder (PNG + HTML report)
echo.

"%PYTHON_EXE%" analyze.py

if errorlevel 1 (
    echo.
    echo [ERROR] Analysis failed. Check the error above.
    pause
    exit /b 1
)

echo.
echo  DONE! Check the browser for results.
echo.

if exist "%~dp0output" start "" "%~dp0output"

pause
exit /b 0

:pip_error
echo.
echo [ERROR] Package install failed.
echo  Check your internet connection or run as Administrator.
pause
exit /b 1
