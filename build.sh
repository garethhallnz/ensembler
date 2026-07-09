#!/bin/bash

# Build script for Dockarr application
set -e

echo "Building Dockarr application..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf frontend/dist
rm -rf dist-electron
rm -rf backend/dist

# Install root dependencies
echo "Installing root dependencies..."
npm install

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
cd ..

# Package with Electron (call electron-builder directly — do NOT use a script
# that re-runs this build, or it recurses).
echo "Packaging with Electron..."
npx electron-builder --publish=never

echo "Build complete! Check dist-electron for the packaged application." 