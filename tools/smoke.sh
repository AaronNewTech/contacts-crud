#!/usr/bin/env zsh
set -euo pipefail

BASE="http://127.0.0.1:8000"
TMPDIR="$(mktemp -d)"
COOKIES="$TMPDIR/cookies.txt"
HTML="$TMPDIR/home.html"
echo "Using temporary dir: $TMPDIR"

# Ensure TMPDIR is reported even if the script exits early
trap 'echo "Smoke script exiting. Temporary files at: $TMPDIR"' EXIT

echo "Fetching home page to obtain csrf meta and cookies..."
curl -s -c "$COOKIES" "$BASE/" -o "$HTML"

# Extract CSRF from meta tag
CSRF_META=$(grep -oE '<meta name="csrf-token" content="[^"]+"' "$HTML" | sed -E 's/.*content="([^"]+)".*/\1/')

if [[ -z "$CSRF_META" ]]; then
  echo "ERROR: csrf meta tag not found in page. Check that the page includes <meta name=\"csrf-token\" content=\"{{ csrf_token }}\">"
  exit 2
fi

echo "CSRF token (from meta): $CSRF_META"
echo

# Helper to post JSON and print response
post_json() {
  local url=$1
  local data=$2
  echo "POST $url"
  echo "Request header X-CSRFToken: $CSRF_META"
  curl -s -S -b "$COOKIES" -c "$COOKIES" \
    -H "Content-Type: application/json" \
    -H "X-CSRFToken: $CSRF_META" \
    -X POST "$url" -d "$data" \
    -o "$TMPDIR/last_response.json" -w "\nHTTP: %{http_code}\n"
  echo "Response body:"
  sed -n '1,200p' "$TMPDIR/last_response.json"
  echo; echo "-----------------------------"
}

delete_req() {
  local url=$1
  echo "DELETE $url"
  echo "Request header X-CSRFToken: $CSRF_META"
  curl -s -S -b "$COOKIES" -c "$COOKIES" \
    -H "X-CSRFToken: $CSRF_META" \
    -X DELETE "$url" -o "$TMPDIR/last_response.json" -w "\nHTTP: %{http_code}\n"
  echo "Response body:"
  sed -n '1,200p' "$TMPDIR/last_response.json"
  echo; echo "-----------------------------"
}

# 1) Create contact
create_payload='{"first_name":"CLI","last_name":"Smoke","contact_methods":[{"type":"email","value":"cli-smoke@example.test"}]}'
post_json "$BASE/contacts/api/create/" "$create_payload"

# parse id from response (jq or python fallback)
if command -v jq >/dev/null 2>&1; then
  CONTACT_ID=$(jq -r '.id // .created?.id // .pk // .id' "$TMPDIR/last_response.json")
else
  CONTACT_ID=$(python - <<PY
import json,sys
try:
  j=json.load(open("$TMPDIR/last_response.json"))
  print(j.get("id") or j.get("created",{}).get("id") or j.get("pk") or "")
except Exception:
  sys.exit(0)
PY
)
fi

if [[ -z "$CONTACT_ID" || "$CONTACT_ID" == "null" ]]; then
  echo "Failed to extract contact id from create response; aborting."
  exit 3
fi

echo "Contact created: id=$CONTACT_ID"
echo

# 2) Update contact
update_payload='{"first_name":"CLI-Updated","last_name":"Smoke","contact_methods":[{"type":"email","value":"cli-updated@example.test"}]}'
post_json "$BASE/contacts/api/${CONTACT_ID}/update/" "$update_payload"

# 3) Create event for contact
event_payload='{"name":"CLI Event","start_date":"2026-03-18","start_time":"10:00","end_date":"2026-03-18","end_time":"11:00"}'
post_json "$BASE/contacts/api/${CONTACT_ID}/events/create/" "$event_payload"

# parse event id
if command -v jq >/dev/null 2>&1; then
  EVENT_ID=$(jq -r '.id // .event?.id // .pk // .id' "$TMPDIR/last_response.json")
else
  EVENT_ID=$(python - <<PY
import json,sys
try:
  j=json.load(open("$TMPDIR/last_response.json"))
  print(j.get("id") or j.get("event",{}).get("id") or j.get("pk") or "")
except Exception:
  sys.exit(0)
PY
)
fi

if [[ -z "$EVENT_ID" || "$EVENT_ID" == "null" ]]; then
  echo "Failed to extract event id from create response; aborting."
  exit 4
fi

echo "Event created: id=$EVENT_ID"
echo

# 4) Update event
event_update_payload='{"name":"CLI Event Updated","start_date":"2026-03-18","start_time":"10:30","end_date":"2026-03-18","end_time":"11:30"}'
post_json "$BASE/contacts/event/${EVENT_ID}/update/" "$event_update_payload"

# 5) Delete event
delete_req "$BASE/contacts/event/${EVENT_ID}/delete/"

# 6) Delete contact
delete_req "$BASE/contacts/api/${CONTACT_ID}/delete/"

echo
echo "Smoke test complete. Temporary files at: $TMPDIR (remove when done)"
