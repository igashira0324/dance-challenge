#!/bin/bash
# AI Dance Challenge - Ubuntu/ARM64 Startup Script

echo "[SYSTEM] Starting AI Dance Challenge for DGX SPARK (Ubuntu/ARM64)"
echo "[INFO] Resolving dependencies..."

# Disable proxy to prevent connection issues during install
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY

# Install dependencies if node_modules does not exist
if [ ! -d "node_modules" ]; then
    npm install
fi

echo "[SYSTEM] Launching dance engine on 0.0.0.0:5173..."
echo "[INFO] Press Alt+C during play to capture poses."

# Start the Vite development server
npm run dev

