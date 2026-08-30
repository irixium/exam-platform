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
uvicorn main:app --reload &
backend_pid=$!

cd "$ROOT_DIR/frontend"
echo "$(pwd)"
npm run dev &
frontend_pid=$! 

echo "backend pid :$backend_pid"
echo "frontend pid :$frontend_pid"

wait