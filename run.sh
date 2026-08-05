#!/usr/bin/env bash
# SwimAcademy — build & run the whole app via docker compose (isolated network).
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8080}"
export PORT

mkdir -p data
echo "==> Building & starting SwimAcademy on port $PORT (network: swim-academy-net, data in ./data)…"
docker compose up -d --build

echo "==> Waiting for the app to come up…"
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/" -o /dev/null; then
    break
  fi
  sleep 1
done

echo
echo "  SwimAcademy is live →  http://localhost:$PORT"
echo "  API docs           →  http://localhost:$PORT/docs"
echo
echo "  Super admin login: phone 9999999999 (OTP is shown on screen — MVP mode)"
echo "  Demo school: see DEMO_SCHOOL.md (head coach 9800000001)"
echo
echo "  Stop with: docker compose down"
