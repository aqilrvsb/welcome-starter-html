#!/bin/bash
##############################################################################
# MikoPBX Audio Bridge Installation Script
#
# This script:
# 1. Checks if AudioSocket is available in Asterisk
# 2. Installs websocat (WebSocket CLI tool)
# 3. Creates TCP→WebSocket proxy service
# 4. Configures Extension 999 to use AudioSocket
# 5. Sets up systemd service for auto-start
#
# Usage: bash install-audio-bridge.sh
##############################################################################

set -e  # Exit on error

echo "=================================================="
echo "MikoPBX Audio Bridge Installation"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DENO_DEPLOY_URL="${DENO_DEPLOY_URL:-wss://sifucall.deno.dev/audio-socket}"
TCP_PORT=10000
INSTALL_DIR="/usr/local/bin"
SERVICE_DIR="/etc/systemd/system"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Deno Deploy URL: $DENO_DEPLOY_URL"
echo "  TCP Port: $TCP_PORT"
echo ""

# Step 1: Check Asterisk AudioSocket
echo -e "${YELLOW}Step 1: Checking AudioSocket availability...${NC}"
if asterisk -rx "core show application AudioSocket" | grep -q "AudioSocket"; then
    echo -e "${GREEN}✓ AudioSocket is available${NC}"
else
    echo -e "${RED}✗ AudioSocket not found${NC}"
    echo "  AudioSocket requires Asterisk 16.6+. Your MikoPBX version may not support it."
    echo "  Continuing anyway - we'll use alternative method..."
fi
echo ""

# Step 2: Install websocat
echo -e "${YELLOW}Step 2: Installing websocat...${NC}"
if [ -f "$INSTALL_DIR/websocat" ]; then
    echo -e "${GREEN}✓ websocat already installed${NC}"
else
    echo "  Downloading websocat..."
    curl -L https://github.com/vi/websocat/releases/download/v1.11.0/websocat_linux64 -o $INSTALL_DIR/websocat
    chmod +x $INSTALL_DIR/websocat
    echo -e "${GREEN}✓ websocat installed${NC}"
fi
echo ""

# Step 3: Create audio proxy script
echo -e "${YELLOW}Step 3: Creating audio proxy script...${NC}"
cat > $INSTALL_DIR/audio-websocket-proxy.sh <<'PROXY_SCRIPT'
#!/bin/bash
# Audio WebSocket Proxy - Bridges TCP AudioSocket to WebSocket

DENO_URL="${1:-wss://sifucall.deno.dev/audio-socket}"
TCP_PORT="${2:-10000}"

echo "[$(date)] Starting audio WebSocket proxy..."
echo "  TCP Port: $TCP_PORT"
echo "  WebSocket: $DENO_URL"

# Use socat to create bidirectional bridge
# TCP → WebSocket and WebSocket → TCP
/usr/local/bin/websocat --binary -E \
    "tcp-l:$TCP_PORT" \
    "$DENO_URL"
PROXY_SCRIPT

chmod +x $INSTALL_DIR/audio-websocket-proxy.sh
echo -e "${GREEN}✓ Proxy script created${NC}"
echo ""

# Step 4: Create systemd service
echo -e "${YELLOW}Step 4: Creating systemd service...${NC}"
cat > $SERVICE_DIR/audio-websocket-proxy.service <<SERVICE_FILE
[Unit]
Description=MikoPBX Audio WebSocket Proxy
After=network.target asterisk.service

[Service]
Type=simple
User=root
ExecStart=$INSTALL_DIR/audio-websocket-proxy.sh $DENO_DEPLOY_URL $TCP_PORT
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE_FILE

systemctl daemon-reload
systemctl enable audio-websocket-proxy.service
systemctl start audio-websocket-proxy.service

if systemctl is-active --quiet audio-websocket-proxy.service; then
    echo -e "${GREEN}✓ Service started successfully${NC}"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo "  Check logs: journalctl -u audio-websocket-proxy -f"
fi
echo ""

# Step 5: Configure Extension 999
echo -e "${YELLOW}Step 5: Configuring Extension 999...${NC}"

# Create custom dialplan directory if not exists
mkdir -p /storage/usbdisk1/mikopbx/custom_modules

# Backup existing custom extensions
if [ -f /storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf ]; then
    cp /storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf \
       /storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf.bak
    echo "  Backed up existing configuration"
fi

# Add Extension 999 configuration
cat >> /storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf <<'DIALPLAN'

; ========================================
; Extension 999 - AI Call Handler
; ========================================
[all_peers]
exten => 999,1,NoOp(AI Call Handler Starting)
 same => n,Answer()
 same => n,Set(CHANNEL(language)=ms)
 same => n,Set(__CALL_ID=${UNIQUEID})
 same => n,Set(__CALLER_NUM=${CALLERID(num)})
 same => n,Set(__USER_ID=${user_id})
 same => n,Set(__CAMPAIGN_ID=${campaign_id})
 same => n,Set(__PROMPT_ID=${prompt_id})
 same => n,Set(__CUSTOMER_NAME=${customer_name})
 same => n,NoOp(Connecting to AudioSocket on localhost:10000)
 same => n,AudioSocket(${UNIQUEID},127.0.0.1:10000)
 same => n,NoOp(AudioSocket ended)
 same => n,Hangup()

DIALPLAN

# Include custom dialplan in main config
if ! grep -q "extensions_custom.conf" /etc/asterisk/extensions.conf; then
    echo '#include "/storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf"' >> /etc/asterisk/extensions.conf
    echo "  Added include to main extensions.conf"
fi

# Reload dialplan
asterisk -rx "dialplan reload"
echo -e "${GREEN}✓ Extension 999 configured${NC}"
echo ""

# Step 6: Test configuration
echo -e "${YELLOW}Step 6: Testing configuration...${NC}"

# Check if port is listening
sleep 2
if netstat -tulpn | grep -q ":$TCP_PORT"; then
    echo -e "${GREEN}✓ Proxy is listening on port $TCP_PORT${NC}"
else
    echo -e "${RED}✗ Proxy not listening on port $TCP_PORT${NC}"
    echo "  Check service status: systemctl status audio-websocket-proxy"
fi

# Check dialplan
if asterisk -rx "dialplan show all_peers" | grep -q "999"; then
    echo -e "${GREEN}✓ Extension 999 dialplan loaded${NC}"
else
    echo -e "${RED}✗ Extension 999 not found in dialplan${NC}"
fi
echo ""

# Step 7: Summary
echo "=================================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "=================================================="
echo ""
echo "Configuration Summary:"
echo "  • Extension: 999"
echo "  • TCP Port: $TCP_PORT"
echo "  • WebSocket URL: $DENO_DEPLOY_URL"
echo "  • Service: audio-websocket-proxy.service"
echo ""
echo "Useful Commands:"
echo "  • Check service: systemctl status audio-websocket-proxy"
echo "  • View logs: journalctl -u audio-websocket-proxy -f"
echo "  • Restart service: systemctl restart audio-websocket-proxy"
echo "  • Test dialplan: asterisk -rx 'dialplan show 999@all_peers'"
echo "  • Check port: netstat -tulpn | grep $TCP_PORT"
echo ""
echo "Next Steps:"
echo "  1. Deploy updated ai-call-handler to Deno Deploy"
echo "  2. Test call to Extension 999"
echo "  3. Monitor logs during test call"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  Make sure your Deno Deploy endpoint ($DENO_DEPLOY_URL)"
echo "  is ready to receive AudioSocket WebSocket connections!"
echo ""
