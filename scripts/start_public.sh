#!/bin/bash

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR="$SCRIPT_DIR/.."

# Kill existing process using port 8000
echo "checking port 8000..."

PID=$(lsof -ti :8000)

if [ -n "$PID" ]; then
    echo "killing existing process on port 8000: $PID"
    kill $PID 2>/dev/null
    sleep 1

    # Force kill if still running
    PID=$(lsof -ti :8000)
    if [ -n "$PID" ]; then
        kill -9 $PID 2>/dev/null
    fi
fi

cd "$ROOT_DIR/frontend"
npm run build

cd "$ROOT_DIR/backend"
source .venv/bin/activate

nohup uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    > uvicorn.log 2>&1 < /dev/null &

backend_pid=$!

echo "backend pid: $backend_pid"
echo "backend running on port 8000"
echo "logs: $ROOT_DIR/backend/uvicorn.log"