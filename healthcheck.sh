#!/bin/bash
# Health check script for Coolify monitoring

# Check if openclaw process is running
if pgrep -f "openclaw" > /dev/null 2>&1; then
    echo "OpenClaw process is running"
    exit 0
else
    echo "OpenClaw process not found"
    exit 1
fi
