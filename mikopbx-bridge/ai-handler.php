#!/usr/bin/php -q
<?php
/**
 * MikoPBX AGI Bridge to AI Handler WebSocket
 *
 * This script runs on MikoPBX and bridges audio between:
 * - Asterisk call (via AGI)
 * - AI Handler WebSocket (Deno Deploy)
 *
 * Installation:
 * 1. Upload to: /storage/usbdisk1/mikopbx/custom_modules/ai-handler.php
 * 2. chmod +x /storage/usbdisk1/mikopbx/custom_modules/ai-handler.php
 * 3. Configure Extension 999 to call this AGI script
 */

require_once '/var/www/html/src/Common/Models/Pbx/Models/Pbx/phpagi.php';

// Initialize AGI
$agi = new AGI();

// Answer the call
$agi->answer();

// Get call parameters
$callerNumber = $agi->request['agi_callerid'];
$callerId = $agi->request['agi_calleridname'];
$uniqueId = $agi->request['agi_uniqueid'];
$channel = $agi->request['agi_channel'];

$agi->verbose("AI Call Handler starting for caller: $callerNumber");

// Extract metadata from channel variables
$userId = $agi->get_variable("user_id");
$campaignId = $agi->get_variable("campaign_id");
$promptId = $agi->get_variable("prompt_id");
$customerName = $agi->get_variable("customer_name");

// WebSocket URL for AI Handler
$wsUrl = getenv('DENO_DEPLOY_URL') ?: 'wss://sifucall.deno.dev';
$wsEndpoint = str_replace(['https://', 'http://'], 'wss://', $wsUrl) . '/ai-call';

$agi->verbose("Connecting to AI Handler: $wsEndpoint");

// Create temporary FIFO pipes for bidirectional audio
$audioInFifo = "/tmp/audio_in_$uniqueId.raw";
$audioOutFifo = "/tmp/audio_out_$uniqueId.raw";

posix_mkfifo($audioInFifo, 0666);
posix_mkfifo($audioOutFifo, 0666);

// Fork process for WebSocket communication
$pid = pcntl_fork();

if ($pid == -1) {
    $agi->verbose("ERROR: Could not fork process", 1);
    $agi->hangup();
    exit(1);
} elseif ($pid == 0) {
    // Child process: Handle WebSocket communication
    handleWebSocketBridge($wsEndpoint, $audioInFifo, $audioOutFifo, [
        'user_id' => $userId['data'],
        'campaign_id' => $campaignId['data'],
        'prompt_id' => $promptId['data'],
        'phone_number' => $callerNumber,
        'customer_name' => $customerName['data'],
        'call_id' => $uniqueId
    ]);
    exit(0);
} else {
    // Parent process: Handle Asterisk audio streaming

    // Start recording from channel to FIFO (customer audio)
    $agi->exec('EAGI', "NOOP");

    // Use Asterisk ExternalIVR or AudioFork to stream audio
    // This sends audio to our FIFO pipes
    $agi->exec('ExternalIVR', "/usr/local/bin/audio-bridge.sh $audioInFifo $audioOutFifo");

    // Wait for call to end
    pcntl_wait($status);

    // Cleanup
    unlink($audioInFifo);
    unlink($audioOutFifo);

    $agi->verbose("Call ended, cleaning up");
    $agi->hangup();
}

/**
 * Handle WebSocket communication with AI Handler
 */
function handleWebSocketBridge($wsUrl, $audioInFifo, $audioOutFifo, $metadata) {
    // Use WebSocket PHP library (need to install: composer require textalk/websocket)
    require_once '/storage/usbdisk1/mikopbx/vendor/autoload.php';

    try {
        $client = new \WebSocket\Client($wsUrl, [
            'timeout' => 300, // 5 minute timeout
            'headers' => [
                'X-Call-Metadata' => json_encode($metadata)
            ]
        ]);

        error_log("Connected to AI Handler WebSocket");

        // Send start event
        $client->text(json_encode([
            'event' => 'start',
            'metadata' => $metadata,
            'media_format' => [
                'encoding' => 'audio/x-mulaw',
                'sample_rate' => 8000,
                'channels' => 1
            ]
        ]));

        // Open audio FIFOs
        $inHandle = fopen($audioInFifo, 'rb');
        $outHandle = fopen($audioOutFifo, 'wb');

        if (!$inHandle || !$outHandle) {
            error_log("ERROR: Could not open audio FIFOs");
            return;
        }

        stream_set_blocking($inHandle, false);
        stream_set_blocking($outHandle, false);

        // Bidirectional audio loop
        while (true) {
            // Read audio from customer (Asterisk -> AI)
            $customerAudio = fread($inHandle, 1024);
            if ($customerAudio !== false && strlen($customerAudio) > 0) {
                // Base64 encode and send to AI Handler
                $client->text(json_encode([
                    'event' => 'media',
                    'media' => [
                        'payload' => base64_encode($customerAudio)
                    ]
                ]));
            }

            // Read messages from AI Handler
            try {
                $message = $client->receive();
                if ($message) {
                    $data = json_decode($message, true);

                    if ($data['event'] === 'media' && isset($data['media']['payload'])) {
                        // Decode audio from AI and write to Asterisk
                        $aiAudio = base64_decode($data['media']['payload']);
                        fwrite($outHandle, $aiAudio);
                    } elseif ($data['event'] === 'stop') {
                        error_log("AI Handler requested call end");
                        break;
                    }
                }
            } catch (\WebSocket\TimeoutException $e) {
                // No message received, continue
            }

            usleep(10000); // 10ms sleep to prevent busy loop
        }

        // Cleanup
        fclose($inHandle);
        fclose($outHandle);
        $client->close();

    } catch (Exception $e) {
        error_log("WebSocket error: " . $e->getMessage());
    }
}
?>
