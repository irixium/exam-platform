#!/bin/bash

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.tx

cd "$ROOT_DIR/frontend"
npm install