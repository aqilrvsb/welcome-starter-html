#!/bin/bash
# MikoPBX Audio WebSocket Bridge
# Bridges Asterisk audio to WebSocket using standard tools

CALL_ID=$1
WS_URL=${2:-"wss://sifucall.deno.dev/ai-call"}
USER_ID=$3
CAMPAIGN_ID=$4
PROMPT_ID=$5
PHONE_NUMBER=$6

# Use websocat (websocket CLI tool) to bridge audio
# Install: curl -L https://github.com/vi/websocat/releases/download/v1.11.0/websocat_linux64 -o /usr/local/bin/websocat && chmod +x /usr/local/bin/websocat

# Create metadata JSON
METADATA=$(cat <<EOF
{
  "event": "start",
  "callId": "$CALL_ID",
  "metadata": {
    "user_id": "$USER_ID",
    "campaign_id": "$CAMPAIGN_ID",
    "prompt_id": "$PROMPT_ID",
    "phone_number": "$PHONE_NUMBER"
  },
  "mediaFormat": {
    "encoding": "audio/x-mulaw",
    "sampleRate": 8000,
    "channels": 1
  }
}
EOF
)

# Send metadata and stream audio bidirectionally
echo "$METADATA" | websocat --binary -n -t "$WS_URL"

# Asterisk will pipe audio through stdin/stdout
# This script acts as a bridge
exec cat
