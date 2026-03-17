#!/bin/bash
set -e

echo "Installing root dependencies..."
npm install --legacy-peer-deps

echo "Building frontend..."
cd frontend
npm install
npm run build

echo "Build complete!"
