#!/bin/bash

# Build script for Media Center application
set -e

echo "Building Media Center application..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf frontend/dist
rm -rf frontend/dist-electron
rm -rf backend/dist

# Build backend
echo "Building backend..."
cd backend
npm install
npm run build
cd ..

# Build frontend
echo "Building frontend..."
cd frontend
npm install
npm run build

# Package with Electron
echo "Packaging with Electron..."
npm run electron-dist

echo "Build complete! Check frontend/dist-electron for the packaged application." 