#!/bin/bash

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR="$SCRIPT_DIR/.."

cleanup() {
    echo "killing app"
    kill "$backend_pid" 2>/dev/null
}

trap cleanup EXIT

cd "$ROOT_DIR/frontend"
npm run build

cd "$ROOT_DIR/backend"
source .venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 &
backend_pid=$!

echo "backend pid :$backend_pid"

wait