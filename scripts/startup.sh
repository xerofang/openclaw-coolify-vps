#!/bin/bash
# OpenClaw Startup Script

set -e

echo "Starting OpenClaw..."

# Create directories if needed
mkdir -p ~/.openclaw/workspace
mkdir -p ~/approval-queue/pending
mkdir -p ~/approval-queue/processed

# Copy default config if not exists
if [ ! -f ~/.openclaw/openclaw.json ] && [ -f ~/config/openclaw.json ]; then
    cp ~/config/openclaw.json ~/.openclaw/
fi

echo "Environment ready"

# Start OpenClaw
exec openclaw "$@"
