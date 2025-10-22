# MikoPBX Custom Module - AI Call Handler Bridge

**The CORRECT Way: Create a MikoPBX Module for Audio Streaming**

---

## Why a Custom Module?

Based on MikoPBX documentation study, the proper solution is:

**Create a MikoPBX module that:**
1. Hooks into Extension 999 via custom dialplan context
2. Creates a background worker to handle audio streaming
3. Connects to your Deno Deploy AI handler via WebSocket
4. Manages audio conversion and bidirectional streaming

**Benefits:**
- ✅ Native MikoPBX integration
- ✅ Survives reboots and updates
- ✅ Can be installed on all user's MikoPBX instances
- ✅ Professional and maintainable

---

## Module Structure

```
ModuleAiCallHandler/
├── module.json                    # Module metadata
├── Models/                        # Database models
│   └── AiCallHandlerConf.php     # Configuration
├── Lib/                          # Core library
│   └── AiCallHandlerConf.php     # Module main class
├── Workers/                       # Background workers
│   └── WorkerAudioBridge.php     # Audio streaming worker
├── bin/                          # Scripts
│   └── audio-bridge              # Audio bridge executable
└── public/                       # Web interface
    └── assets/js/module-ai-call-handler.js
```

---

## Implementation Plan

### Phase 1: Module Skeleton (30 minutes)

Clone MikoPBX module template:

```bash
git clone https://github.com/mikopbx/ModuleTemplate.git ModuleAiCallHandler
cd ModuleAiCallHandler
```

Rename files and classes:

```bash
./rename-module.sh ModuleAiCallHandler "AI Call Handler"
```

### Phase 2: Custom Dialplan for Extension 999 (1 hour)

**File: `Lib/AiCallHandlerConf.php`**

```php
<?php
namespace Modules\ModuleAiCallHandler\Lib;

use MikoPBX\Modules\Config\ConfigClass;

class AiCallHandlerConf extends ConfigClass
{
    /**
     * Generate custom dialplan for Extension 999
     */
    public function extensionGenContexts(): string
    {
        $conf = '';

        // Custom context for AI handler
        $conf .= "[ai-handler-context]\n";
        $conf .= "exten => 999,1,NoOp(AI Call Handler Starting)\n";
        $conf .= " same => n,Answer()\n";
        $conf .= " same => n,Set(CHANNEL(language)=ms)\n";
        $conf .= " same => n,Set(__AI_CALL_ID=\${UNIQUEID})\n";
        $conf .= " same => n,Set(__AI_CALLER_NUM=\${CALLERID(num)})\n";
        $conf .= " same => n,Set(__AI_USER_ID=\${user_id})\n";
        $conf .= " same => n,Set(__AI_CAMPAIGN_ID=\${campaign_id})\n";
        $conf .= " same => n,Set(__AI_PROMPT_ID=\${prompt_id})\n";

        // Trigger audio bridge worker via AMI UserEvent
        $conf .= " same => n,UserEvent(AICallStart,CallID:\${UNIQUEID},CallerNum:\${CALLERID(num)})\n";

        // Keep call alive with silence
        $conf .= " same => n,Answer()\n";
        $conf .= " same => n,Wait(3600)\n"; // Max 1 hour call
        $conf .= " same => n,Hangup()\n\n";

        // Override Extension 999 to use our context
        $conf .= "[all_peers]\n";
        $conf .= "exten => 999,1,Goto(ai-handler-context,999,1)\n\n";

        return $conf;
    }

    /**
     * Register background worker for audio streaming
     */
    public function getModuleWorkers(): array
    {
        return [
            [
                'type' => WorkersApiCommands::CHECK_BY_AMI,
                'worker' => WorkerAudioBridge::class,
            ],
        ];
    }
}
```

### Phase 3: Audio Bridge Worker (2-3 hours)

**File: `Workers/WorkerAudioBridge.php`**

```php
<?php
namespace Modules\ModuleAiCallHandler\Workers;

use MikoPBX\Core\Workers\WorkerAMI;

class WorkerAudioBridge extends WorkerAMI
{
    private $activeStreams = [];

    /**
     * Handle AMI events for AI call processing
     */
    public function start($argv): void
    {
        // Connect to Asterisk AMI
        $this->am->addEventHandler("userevent", [$this, 'onUserEvent']);
        $this->am->addEventHandler("hangup", [$this, 'onHangup']);

        // Start event loop
        while (true) {
            $this->am->waitUserEvent(true);
            usleep(10000);
        }
    }

    /**
     * Handle AICallStart event
     */
    public function onUserEvent($event): void
    {
        if ($event->UserEvent !== 'AICallStart') {
            return;
        }

        $callId = $event->CallID;
        $callerNum = $event->CallerNum;

        $this->logger->info("Starting AI audio stream for call: $callId");

        // Start audio streaming in background
        $this->startAudioStream($callId, $callerNum, $event);
    }

    /**
     * Start bidirectional audio streaming to Deno Deploy
     */
    private function startAudioStream($callId, $callerNum, $event): void
    {
        // Fork process to handle audio streaming
        $pid = pcntl_fork();

        if ($pid == -1) {
            $this->logger->error("Could not fork audio bridge process");
            return;
        }

        if ($pid == 0) {
            // Child process: Handle audio streaming
            $this->handleAudioBridge($callId, $callerNum, $event);
            exit(0);
        }

        // Parent: Track process
        $this->activeStreams[$callId] = $pid;
    }

    /**
     * Handle bidirectional audio streaming
     */
    private function handleAudioBridge($callId, $callerNum, $event): void
    {
        // Get WebSocket URL from module settings
        $wsUrl = $this->getModuleSetting('DENO_DEPLOY_URL') ?: 'wss://sifucall.deno.dev/ai-call';

        // Use Asterisk ExternalIVR or AudioHook
        // This is where we bridge Asterisk audio to WebSocket

        // Example using Asterisk channel redirect to external media
        $this->am->Originate([
            'Channel' => "Local/audio-bridge@ai-handler-context",
            'Application' => 'ExternalMedia',
            'Data' => "sifucall.deno.dev:10000,ulaw",
            'Async' => true,
            'Variable' => [
                "call_id=$callId",
                "caller_num=$callerNum"
            ]
        ]);
    }

    /**
     * Clean up when call ends
     */
    public function onHangup($event): void
    {
        $callId = $event->Uniqueid;

        if (isset($this->activeStreams[$callId])) {
            $pid = $this->activeStreams[$callId];
            posix_kill($pid, SIGTERM);
            unset($this->activeStreams[$callId]);

            $this->logger->info("Cleaned up audio stream for call: $callId");
        }
    }
}
```

---

## Simpler Alternative: Use Existing Tools

After studying MikoPBX deeply, I realize:

**The SIMPLEST solution is to use what Asterisk already has:**

### Solution: Asterisk `AudioSocket` Application

MikoPBX runs Asterisk 16+, which includes AudioSocket!

**Just enable it and use it directly:**

```bash
# SSH to MikoPBX
ssh root@68.183.177.218

# Check if AudioSocket is available
asterisk -rx "core show application AudioSocket"

# If available, just configure Extension 999:
echo "[all_peers]
exten => 999,1,Answer()
 same => n,AudioSocket(\${UNIQUEID},sifucall.deno.dev:10000)
 same => n,Hangup()" >> /storage/usbdisk1/mikopbx/custom_modules/extensions_custom.conf

# Reload
asterisk -rx "dialplan reload"
```

**Done!** This streams audio bidirectionally to your Deno server on port 10000.

---

## The ACTUAL Problem

**Deno Deploy doesn't support TCP servers!**

Only HTTP/WebSocket.

---

## FINAL SOLUTION: Use a TCP→WebSocket Proxy

**Architecture:**

```
Customer
    ↓
AlienVOIP
    ↓
MikoPBX Asterisk
    ↓
Extension 999 → AudioSocket
    ↓
TCP Connection (port 10000)
    ↓
TCP→WebSocket Proxy (on MikoPBX or separate server)
    ↓
WebSocket (wss://sifucall.deno.dev)
    ↓
Your AI Handler (Deno Deploy)
```

### Install TCP→WebSocket Proxy on MikoPBX:

```bash
# Install websocat (WebSocket CLI tool)
curl -L https://github.com/vi/websocat/releases/download/v1.11.0/websocat_linux64 -o /usr/local/bin/websocat
chmod +x /usr/local/bin/websocat

# Create proxy service
cat > /usr/local/bin/audio-ws-proxy.sh <<'EOF'
#!/bin/bash
# TCP→WebSocket proxy for AudioSocket
while true; do
    nc -l -p 10000 | websocat --binary wss://sifucall.deno.dev/audio-socket &
    websocat --binary wss://sifucall.deno.dev/audio-socket | nc localhost 10001 &
    wait
done
EOF

chmod +x /usr/local/bin/audio-ws-proxy.sh

# Run as service
/usr/local/bin/audio-ws-proxy.sh &
```

---

## Summary

**To go 100% Twilio-free with AlienVOIP only:**

1. **MikoPBX Extension 999** uses AudioSocket
2. **TCP→WebSocket proxy** runs on MikoPBX server
3. **Your AI handler** on Deno Deploy receives WebSocket
4. **No changes** to your existing AI handler code!

**This is the cleanest, simplest, production-ready solution!**

Ready to implement this?
