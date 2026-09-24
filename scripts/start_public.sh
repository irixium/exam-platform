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

# Load NVM so npm/node are available in non-interactive SSH sessions
export NVM_DIR="$HOME/.nvm"

if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
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
echo "waiting for backend to start..."

# Wait for backend to become reachable
for i in {1..30}; do
    if curl --silent --fail \
        --output /dev/null \
        http://127.0.0.1:8000/api/health; then

        echo "backend is healthy"
        echo "logs: $ROOT_DIR/backend/uvicorn.log"
        exit 0
    fi

    # Make sure the process hasn't crashed
    if ! kill -0 "$backend_pid" 2>/dev/null; then
        echo "ERROR: backend process exited unexpectedly"
        echo "--- uvicorn.log ---"
        cat "$ROOT_DIR/backend/uvicorn.log"
        exit 1
    fi

    echo "backend not ready yet (attempt $i/30)"
    sleep 2
done

echo "ERROR: backend did not become healthy within 60 seconds"
echo "--- uvicorn.log ---"
cat "$ROOT_DIR/backend/uvicorn.log"

exit 1