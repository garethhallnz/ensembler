@echo off
setlocal enabledelayedexpansion

echo Building Media Center application...

REM Clean previous builds
echo Cleaning previous builds...
if exist "frontend\dist" rmdir /s /q "frontend\dist"
if exist "frontend\dist-electron" rmdir /s /q "frontend\dist-electron"
if exist "backend\dist" rmdir /s /q "backend\dist"

REM Build backend
echo Building backend...
cd backend
call npm install
call npm run build
cd ..

REM Build frontend
echo Building frontend...
cd frontend
call npm install
call npm run build

REM Package with Electron
echo Packaging with Electron...
call npm run electron-dist

echo Build complete! Check frontend\dist-electron for the packaged application.
pause 