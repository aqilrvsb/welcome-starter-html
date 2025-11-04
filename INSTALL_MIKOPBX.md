# MikoPBX AudioSocket Installation - One Command

**Install the complete audio bridge with a single command!**

---

## One-Line Installation

SSH into your MikoPBX server and run this command:

```bash
ssh root@68.183.177.218

# Then run this ONE command:
curl -sL https://raw.githubusercontent.com/aqilrvsb/welcome-starter-html/master/mikopbx-bridge/install-audio-bridge.sh | bash
```

That's it! The script will:
1. ✅ Install websocat
2. ✅ Create audio proxy service
3. ✅ Configure Extension 999
4. ✅ Start everything automatically

---

## Alternative: Manual Installation (If GitHub is blocked)

If the above doesn't work, follow these manual steps:

### Step 1: Install websocat

```bash
curl -L https://github.com/vi/websocat/releases/download/v1.11.0/websocat_linux64 -o /usr/local/bin/websocat
chmod +x /usr/local/bin/websocat
```

### Step 2: Create proxy script

```bash
cat > /usr/local/bin/audio-websocket-proxy.sh <<'EOF'
#!/bin/bash
DENO_URL="${1:-wss://sifucall.deno.dev/audio-socket}"
TCP_PORT="${2:-10000}"

echo "[$(date)] Starting audio WebSocket proxy..."
echo "  TCP Port: $TCP_PORT"
echo "  WebSocket: $DENO_URL"

/usr/local/bin/websocat --binary -E "tcp-l:$TCP_PORT" "$DENO_URL"
EOF

chmod +x /usr/local/bin/audio-websocket-proxy.sh
```

### Step 3: Create systemd service

```bash
cat > /etc/systemd/system/audio-websocket-proxy.service <<'EOF'
[Unit]
Description=MikoPBX Audio WebSocket Proxy
After=network.target asterisk.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/audio-websocket-proxy.sh wss://sifucall.deno.dev/audio-socket 10000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable audio-websocket-proxy.service
systemctl start audio-websocket-proxy.service
```

### Step 4: Configure Extension 999

```bash
mkdir -p /storage/usbdisk1/mikopbx/custom_modules

cat >> /storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf <<'EOF'

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

EOF

# Include in main config
if ! grep -q "extensions_custom.conf" /etc/asterisk/extensions.conf; then
    echo '#include "/storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf"' >> /etc/asterisk/extensions.conf
fi

# Reload dialplan
asterisk -rx "dialplan reload"
```

### Step 5: Verify Installation

```bash
# Check service status
systemctl status audio-websocket-proxy

# Check if port is listening
netstat -tulpn | grep 10000

# Check dialplan
asterisk -rx "dialplan show 999@all_peers"

# View logs
journalctl -u audio-websocket-proxy -f
```

---

## Troubleshooting

### If websocat download fails:

Try alternative mirror:
```bash
wget https://github.com/vi/websocat/releases/download/v1.11.0/websocat_linux64 -O /usr/local/bin/websocat
chmod +x /usr/local/bin/websocat
```

### If service won't start:

```bash
# Check logs
journalctl -u audio-websocket-proxy -n 50

# Test websocat manually
/usr/local/bin/websocat wss://sifucall.deno.dev/audio-socket

# Restart service
systemctl restart audio-websocket-proxy
```

### If Extension 999 not working:

```bash
# Reload dialplan
asterisk -rx "dialplan reload"

# Check if custom file is included
grep "extensions_custom" /etc/asterisk/extensions.conf

# View full dialplan
asterisk -rx "dialplan show all_peers"
```

---

## What Gets Installed

1. **websocat** - WebSocket CLI tool at `/usr/local/bin/websocat`
2. **Proxy script** - At `/usr/local/bin/audio-websocket-proxy.sh`
3. **Systemd service** - Auto-starts on boot
4. **Extension 999** - Configured for AudioSocket
5. **Custom dialplan** - At `/storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf`

---

## After Installation

Your system is ready! Now:

1. ✅ Proxy is running (port 10000)
2. ✅ Extension 999 connects to proxy
3. ✅ Proxy forwards to Deno Deploy
4. ✅ AI handler processes audio

**Test with a call!**

---

## Quick Status Check

```bash
# One command to check everything
echo "=== Service Status ===" && systemctl is-active audio-websocket-proxy && \
echo "=== Port Status ===" && netstat -tulpn | grep 10000 && \
echo "=== Extension 999 ===" && asterisk -rx "dialplan show 999@all_peers" | head -5
```

---

## Uninstall (if needed)

```bash
systemctl stop audio-websocket-proxy
systemctl disable audio-websocket-proxy
rm /etc/systemd/system/audio-websocket-proxy.service
rm /usr/local/bin/audio-websocket-proxy.sh
rm /usr/local/bin/websocat
systemctl daemon-reload
```

---

**Need help?** Check the logs:
```bash
journalctl -u audio-websocket-proxy -f
```
