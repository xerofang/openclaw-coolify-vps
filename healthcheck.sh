#!/bin/bash
# Health check script for Coolify monitoring

if pgrep -f "openclaw" > /dev/null 2>&1; then
    echo "OK"
    exit 0
else
    echo "UNHEALTHY"
    exit 1
fi
