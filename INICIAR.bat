@echo off
title Produccion Wanderwarm
cd /d "%~dp0"
where node >/dev/null 2>/dev/null || (echo Necesitas instalar Node.js desde https://nodejs.org & pause & exit /b)
if not exist node_modules (
  echo Instalando librerias, la primera vez tarda un par de minutos...
  call npm install
)
start "" http://localhost:5173
call npm run dev
