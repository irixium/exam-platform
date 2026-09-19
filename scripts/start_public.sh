#!/bin/bash

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR="$SCRIPT_DIR/.."

cleanup() {
    echo "killing frontend and backend"
    kill "$frontend_pid" "$backend_pid" 2>/dev/null
}

trap cleanup EXIT

cd "$ROOT_DIR/backend"
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
backend_pid=$!

cd "$ROOT_DIR/frontend"
echo "$(pwd)"
npm run dev -- --host 0.0.0.0 --port 5173 &
frontend_pid=$! 

echo "backend pid :$backend_pid"
echo "frontend pid :$frontend_pid"

wait