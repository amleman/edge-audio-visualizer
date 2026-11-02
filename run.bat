@echo off
cd /d "%~dp0"
title Edge Audio Visualizer
echo ==============================================
echo  Iniciando Edge Audio Visualizer (Windows)
echo ==============================================
call npm run build
if %errorlevel% neq 0 (
    echo Error al compilar el frontend.
    pause
    exit /b %errorlevel%
)
dotnet run --project src-csharp
if %errorlevel% neq 0 (
    echo Error al iniciar la aplicacion.
    pause
)
