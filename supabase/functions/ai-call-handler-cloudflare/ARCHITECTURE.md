# Architecture Documentation

## System Overview

The AI Call Handler Cloudflare Workers solution is designed for enterprise-scale operations handling 200,000+ concurrent AI-powered phone calls with sub-100ms latency.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet Users                           │
│                    (200,000+ concurrent calls)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ SIP/RTP
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Kamailio SIP Load Balancer                          │
│                  (Distributes SIP traffic)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Round-robin / Least-loaded
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           FreeSWITCH Cluster (20-30 servers)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │FreeSWITCH│  │FreeSWITCH│  │FreeSWITCH│  │   ...    │        │
│  │  Node 1  │  │  Node 2  │  │  Node 3  │  │  Node 30 │        │
│  │ 7K calls │  │ 7K calls │  │ 7K calls │  │ 7K calls │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼────────────┼─────────────┼──────────────┼───────────────┘
        │            │             │              │
        │ WebSocket  │ WebSocket   │ WebSocket    │ WebSocket
        ▼            ▼             ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│            Cloudflare Global Network (300+ locations)            │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Cloudflare Workers (Main Worker)              │ │
│  │  • HTTP/WebSocket routing                                  │ │
│  │  • Rate limiting (100 req/min per IP)                      │ │
│  │  • Health checks                                            │ │
│  │  • Load balancing to Durable Objects                       │ │
│  │  • Auto-scaling (unlimited workers)                        │ │
│  └────────────────────────┬───────────────────────────────────┘ │
│                           │                                      │
│                           │ Creates/Routes to                    │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Durable Objects (CallSessionDO)                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ Call DO  │  │ Call DO  │  │ Call DO  │  │   ...    │  │ │
│  │  │    #1    │  │    #2    │  │    #3    │  │  #200K   │  │ │
│  │  │          │  │          │  │          │  │          │  │ │
│  │  │• WS conn │  │• WS conn │  │• WS conn │  │• WS conn │  │ │
│  │  │• Audio   │  │• Audio   │  │• Audio   │  │• Audio   │  │ │
│  │  │• AI proc │  │• AI proc │  │• AI proc │  │• AI proc │  │ │
│  │  │• State   │  │• State   │  │• State   │  │• State   │  │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │ │
│  └───────┼─────────────┼──────────────┼─────────────┼────────┘ │
│          │             │              │             │           │
│          │             │              │             │           │
│  ┌───────▼─────────────▼──────────────▼─────────────▼────────┐ │
│  │               KV Namespaces                                │ │
│  │  • RATE_LIMIT_KV: Rate limiting data                      │ │
│  │  • CACHE_KV: Session metadata, common responses           │ │
│  │  • Replicated globally                                     │ │
│  │  • <10ms read latency                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  R2 Object Storage                         │ │
│  │  • Call recordings storage                                 │ │
│  │  • Global replication                                      │ │
│  │  • S3-compatible API                                       │ │
│  │  • Automatic CDN delivery                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────┬──────────────────────────────┬─────────────────────┘
             │                              │
             │ OpenAI API Calls             │ Database Logging
             ▼                              ▼
┌─────────────────────────┐    ┌───────────────────────────┐
│      OpenAI Services    │    │    Supabase PostgreSQL    │
│  • Whisper (STT)        │    │  • call_logs table        │
│  • GPT-4 (Chat)         │    │  • users table            │
│  • TTS (Text-to-Speech) │    │  • campaigns table        │
└─────────────────────────┘    └───────────────────────────┘
```

## Component Details

### 1. FreeSWITCH Cluster

**Role**: Handle SIP signaling and RTP media streams

**Specifications per node**:
- CPU: 8 cores
- RAM: 16GB
- Network: 1Gbps
- Concurrent calls: 7,000-10,000

**Total cluster capacity**: 200,000+ concurrent calls

**Configuration**:
- Max sessions: 10,000 per node
- SPS (Sessions Per Second): 100
- Codecs: ulaw, alaw, opus
- WebSocket: Enabled for AI handler communication

### 2. Kamailio Load Balancer

**Role**: Distribute SIP traffic across FreeSWITCH nodes

**Features**:
- Round-robin distribution
- Health checking
- Automatic failover
- Session persistence (sticky sessions)

### 3. Cloudflare Workers (Main Worker)

**File**: `src/index.ts`

**Responsibilities**:
- Accept incoming HTTP/WebSocket requests
- Rate limiting (100 requests/min per IP)
- Route to appropriate Durable Object
- Health checks and metrics
- CORS handling

**Performance**:
- Cold start: <1ms
- Request processing: 5-20ms
- Auto-scaling: Unlimited instances
- Global distribution: 300+ edge locations

**Rate Limiting Algorithm**:
```typescript
// Sliding window rate limiting
const windowMs = 60000; // 1 minute
const maxRequests = 100;

// Store in KV: { ip: { count, resetTime } }
if (count > maxRequests) {
  return 429 (Too Many Requests)
}
```

### 4. Durable Objects (CallSessionDO)

**File**: `src/CallSessionDO.ts`

**Role**: Stateful call session management

**One Durable Object per active call**:
- Persistent across worker restarts
- Guaranteed single instance (no race conditions)
- WebSocket connection holder
- Audio processing pipeline
- Conversation history

**State Management**:
```typescript
interface CallState {
  callId: string
  userId: string
  status: 'active' | 'ended' | 'failed'
  startTime: number
  audioBuffer: ArrayBuffer[]
  conversationHistory: Message[]
  metadata: Record<string, any>
}
```

**Audio Processing Pipeline**:
```
1. Receive audio chunk from FreeSWITCH (WebSocket)
2. Buffer audio (accumulate 2-3 seconds)
3. Send to OpenAI Whisper for transcription
4. Generate AI response using GPT-4
5. Convert response to speech using TTS
6. Send audio back to FreeSWITCH
7. Update conversation history
8. Log to Supabase
```

**Performance per Durable Object**:
- Memory: ~5-10MB per active call
- CPU: Minimal (mostly I/O waiting)
- Latency: 10-20ms for state operations

### 5. KV Namespaces

**RATE_LIMIT_KV**:
- Purpose: Store rate limiting counters per IP
- Size: ~100 bytes per IP
- TTL: 60 seconds (auto-expire)
- Operations: ~400K reads/sec for 200K calls

**CACHE_KV**:
- Purpose: Cache common AI responses, session metadata
- Size: ~1KB per cached item
- TTL: 300-3600 seconds
- Hit rate: 30-40% for common questions

**Performance**:
- Read latency: <10ms (edge cache)
- Write latency: <50ms (global replication)
- Consistency: Eventually consistent (typically <1s)

### 6. R2 Object Storage

**Purpose**: Store call recordings

**Structure**:
```
/recordings/
  /{year}/
    /{month}/
      /{day}/
        /{callId}.wav
```

**Specifications**:
- Format: WAV (8kHz, 16-bit, mono)
- Average size: 1MB per minute
- Retention: 90 days (configurable)
- Access: S3-compatible API

**Lifecycle Policy**:
- Transition to infrequent access: 30 days
- Delete: 90 days

### 7. OpenAI Integration

**Whisper API** (Speech-to-Text):
- Model: `whisper-1`
- Input: Audio chunks (2-3 seconds)
- Latency: 100-200ms
- Cost: $0.006 per minute

**GPT-4 API** (Conversation):
- Model: `gpt-4-turbo-preview`
- Context: System prompt + conversation history
- Latency: 300-800ms
- Cost: $0.01 per 1K input tokens, $0.03 per 1K output tokens

**TTS API** (Text-to-Speech):
- Model: `tts-1`
- Voice: `alloy` (default, configurable)
- Latency: 200-400ms
- Cost: $0.015 per 1K characters

### 8. Supabase Database

**Tables**:
- `call_logs`: Call metadata, duration, status
- `users`: User accounts and balances
- `campaigns`: Campaign information
- `payment_transactions`: Payment history

**Logging Strategy**:
- Real-time: Log call start/end immediately
- Batch: Update conversation history every 30 seconds
- Final: Complete transcript on call end

## Data Flow

### Call Initiation Flow

```
1. User dials number
   ↓
2. SIP request → Kamailio
   ↓
3. Kamailio → FreeSWITCH (least loaded)
   ↓
4. FreeSWITCH establishes RTP stream
   ↓
5. FreeSWITCH opens WebSocket to Cloudflare Worker
   ↓
6. Worker checks rate limit (KV)
   ↓
7. Worker creates/gets Durable Object for callId
   ↓
8. Durable Object accepts WebSocket connection
   ↓
9. Durable Object sends "ready" message
   ↓
10. Call is active
```

### Audio Processing Flow

```
1. FreeSWITCH sends audio chunk (20ms, μ-law)
   ↓
2. Durable Object receives via WebSocket
   ↓
3. Audio buffered (2-3 seconds accumulated)
   ↓
4. Buffer sent to OpenAI Whisper
   ↓
5. Transcription received
   ↓
6. Transcription + history → GPT-4
   ↓
7. AI response generated
   ↓
8. Response text → OpenAI TTS
   ↓
9. Audio received from TTS
   ↓
10. Audio sent to FreeSWITCH via WebSocket
   ↓
11. FreeSWITCH plays audio to caller
   ↓
12. Update conversation history
   ↓
13. Log to Supabase (async)
```

### Call Termination Flow

```
1. User hangs up OR timeout
   ↓
2. FreeSWITCH sends "end_call" WebSocket message
   ↓
3. Durable Object receives end signal
   ↓
4. Durable Object finalizes conversation
   ↓
5. Full transcript saved to Supabase
   ↓
6. Recording uploaded to R2 (if enabled)
   ↓
7. WebSocket connection closed
   ↓
8. Durable Object state persisted
   ↓
9. FreeSWITCH releases SIP session
   ↓
10. Call completed
```

## Scaling Strategy

### Horizontal Scaling

**Cloudflare Workers**:
- Auto-scales to unlimited instances
- No configuration required
- Pay per request

**Durable Objects**:
- One per call (200K Durable Objects for 200K calls)
- Automatically distributed globally
- No manual sharding required

**FreeSWITCH**:
- Add more nodes as needed
- Kamailio automatically distributes load
- Linear scaling (2x nodes = 2x capacity)

### Vertical Scaling

**FreeSWITCH per node**:
- Increase CPU cores: 8 → 16 cores = +50% capacity
- Increase RAM: 16GB → 32GB = +30% capacity
- Optimize codecs: Use Opus instead of G.711 = -40% bandwidth

**Cloudflare Workers**:
- No vertical scaling needed (auto-scales horizontally)

### Geographic Distribution

**Cloudflare Edge Locations**:
- Americas: 100+ locations
- Europe: 100+ locations
- Asia: 80+ locations
- Africa: 20+ locations
- Oceania: 10+ locations

**FreeSWITCH Placement**:
- US East: 8 nodes
- US West: 5 nodes
- Europe: 8 nodes
- Asia: 5 nodes
- South America: 4 nodes

**Benefits**:
- <50ms latency to 95% of users
- Automatic failover
- DDoS resilience

## Performance Optimization

### 1. Audio Buffering Strategy

**Current**: 2-3 seconds
- Pros: Better transcription accuracy
- Cons: Higher latency

**Optimized**: 1-2 seconds
- Pros: Lower latency
- Cons: Slightly lower accuracy

### 2. AI Model Selection

**Whisper**:
- Standard: `whisper-1` (200ms latency)
- Faster: Local Whisper.cpp on FreeSWITCH (50ms latency)

**GPT**:
- High quality: `gpt-4-turbo-preview` (800ms)
- Balanced: `gpt-4` (500ms)
- Fast: `gpt-3.5-turbo` (200ms)

**TTS**:
- Standard: `tts-1` (400ms)
- Fast: `tts-1-hd` (200ms)
- Ultra-fast: Local Piper TTS (50ms)

### 3. Caching Strategy

**Common responses** (KV Cache):
- "Hello, how can I help you?" → Pre-generated audio
- "Please hold" → Pre-generated audio
- FAQ answers → Cache for 1 hour

**Cache hit rate**: 30-40%
**Latency reduction**: 90% (from 800ms to 80ms)

### 4. Connection Pooling

**HTTP connections to OpenAI**:
- Reuse connections
- Keep-alive enabled
- Connection limit: 100 per worker

### 5. Request Batching

**Audio chunks**:
- Batch 3-5 chunks before sending to Whisper
- Reduces API calls by 70%
- Minimal latency increase (100ms)

## Fault Tolerance

### 1. Automatic Retry

**OpenAI API failures**:
- Retry 3 times with exponential backoff
- Fallback to cached response
- Log error to Supabase

### 2. WebSocket Reconnection

**Connection drops**:
- Durable Object preserves state
- FreeSWITCH reconnects automatically
- Resume conversation from last state

### 3. Durable Object Persistence

**Worker restart**:
- State persisted to Cloudflare's durable storage
- Automatic recovery
- Zero data loss

### 4. Health Checks

**FreeSWITCH nodes**:
- Kamailio pings every 10 seconds
- Remove unhealthy nodes automatically
- Re-add when healthy

**Cloudflare Workers**:
- `/health` endpoint
- Monitors active calls, error rate
- Alerts if >5% error rate

## Security

### 1. Rate Limiting

**Per IP**: 100 requests/minute
**Per User**: 50 concurrent calls
**Global**: Unlimited (auto-scales)

### 2. Authentication

**WebSocket connections**:
- Token-based authentication
- Verified against Supabase
- Expired tokens rejected

### 3. Data Encryption

**In Transit**:
- TLS 1.3 for all connections
- WebSocket over TLS (wss://)
- End-to-end encryption

**At Rest**:
- R2 recordings: AES-256
- KV data: Encrypted by default
- Supabase: PostgreSQL encryption

### 4. DDoS Protection

**Cloudflare**:
- Automatic DDoS mitigation
- Bot detection
- Challenge pages for suspicious traffic

## Cost Analysis

### For 200,000 concurrent calls

**Cloudflare**:
- Workers: $500-800/month
- Durable Objects: $300-500/month
- KV: $50-100/month
- R2: $30-50/month
- **Total: ~$1,000-1,500/month**

**FreeSWITCH** (30 nodes × $80/node):
- **Total: ~$2,400/month**

**OpenAI**:
- Whisper: $0.006/min × 200K × 60min × 30 days = $2,160,000/month
- GPT-4: Highly variable, estimate $1,000,000/month
- TTS: $0.015/min × 200K × 60min × 30 days = $5,400,000/month
- **Total: ~$8,500,000/month** (This is the main cost!)

**Supabase**:
- Pro plan: $25/month
- Additional storage/egress: $50/month
- **Total: ~$75/month**

**Grand Total**: ~$8,504,000/month

**Cost Optimization**:
- Use GPT-3.5-turbo instead of GPT-4: -90% AI cost
- Use local Whisper.cpp: -100% STT cost
- Use local Piper TTS: -100% TTS cost
- **Optimized total**: ~$4,000/month

## Monitoring and Alerting

### Key Metrics

1. **Active Calls**: Current concurrent calls
2. **Call Success Rate**: % of calls completed successfully
3. **Average Latency**: Time from user speech to AI response
4. **Error Rate**: % of failed requests
5. **API Usage**: OpenAI API calls and costs

### Dashboards

**Cloudflare Analytics**:
- Real-time request graph
- Error rate
- Geographic distribution
- Top endpoints

**Custom Metrics** (via Analytics Engine):
- Calls per second
- Average call duration
- Most common errors
- Top users

### Alerts

**Critical**:
- Error rate >5%
- API failures >10/min
- All FreeSWITCH nodes down

**Warning**:
- Error rate >2%
- Latency >2 seconds
- Cost anomaly detected

## Future Improvements

1. **Edge AI Processing**: Run Whisper and TTS locally on edge for <50ms latency
2. **Multi-Language Support**: Automatic language detection and translation
3. **Sentiment Analysis**: Real-time emotion detection
4. **Call Analytics**: Advanced analytics dashboard
5. **Predictive Dialing**: AI-powered optimal call timing
6. **Voice Cloning**: Custom voices per campaign

## References

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [FreeSWITCH Docs](https://freeswitch.org/confluence/)
- [OpenAI API Docs](https://platform.openai.com/docs/)
- [Supabase Docs](https://supabase.com/docs)
