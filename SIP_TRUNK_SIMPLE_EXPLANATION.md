# SIP Trunk - Simple Explanation

## What is SIP Trunk? (Simple Analogy)

Think of it like a **phone line connection**:

```
Your FreeSWITCH (159.223.45.224)
         ↓
    [SIP Trunk] ← This is like a "phone line" over internet
         ↓
AlienVOIP (sip1.alienvoip.com) ← Phone company
         ↓
   Real phone network
         ↓
Customer's phone
```

**SIP Trunk = Connection between your FreeSWITCH and AlienVOIP**

---

## How It Works

### Without SIP Trunk:
❌ You CANNOT make outgoing calls
❌ You CANNOT receive calls
❌ FreeSWITCH is isolated

### With SIP Trunk:
✅ FreeSWITCH connects to AlienVOIP
✅ AlienVOIP connects to real phone network
✅ You can call any phone number in the world!

---

## What You Need from AlienVOIP

You already have these:

| What | Value |
|------|-------|
| **SIP Server** | sip1.alienvoip.com |
| **Username** | 646006395 |
| **Password** | Xh7Yk5Ydcg |

**That's it!** These 3 things are your "phone line account".

---

## How to Configure SIP Trunk in FreeSWITCH

### Step 1: Access FreeSWITCH Web Interface

1. Open browser: http://159.223.45.224
2. Login with credentials shown after installation

### Step 2: Create Gateway (SIP Trunk)

1. Go to: **Accounts** → **Gateways**
2. Click: **Add New Gateway**
3. Fill in form:

```
Gateway Name: AlienVOIP
(This is just a nickname, can be anything)

Username: 646006395
(Your AlienVOIP username)

Password: Xh7Yk5Ydcg
(Your AlienVOIP password)

Proxy: sip1.alienvoip.com
(AlienVOIP's SIP server address)

Register: Yes
(Tell AlienVOIP we're online and ready to receive calls)

Enabled: Yes
(Turn it on!)
```

4. Click **Save**

### Step 3: Check Status

After saving, you should see:

✅ **Gateway Status: REGED** (green)

This means: "Connected! Phone line is active!"

If you see:
❌ **Gateway Status: FAILED** (red)

This means: "Connection failed, check username/password"

---

## How Calls Flow Through SIP Trunk

### Outgoing Call (You call customer):

```
1. Your code calls batch-call-v2
   ↓
2. batch-call-v2 sends command to FreeSWITCH ESL
   "Call this number: +60123456789"
   ↓
3. FreeSWITCH looks at dialplan
   "Which gateway should I use?"
   → Uses AlienVOIP gateway
   ↓
4. FreeSWITCH sends SIP INVITE to sip1.alienvoip.com
   "Please call +60123456789"
   ↓
5. AlienVOIP connects to real phone network
   ↓
6. Customer's phone rings!
   ↓
7. Customer answers
   ↓
8. Audio flows: Customer ←→ AlienVOIP ←→ FreeSWITCH ←→ AI Handler
```

### Incoming Call (Customer calls you):

```
1. Customer calls AlienVOIP number
   ↓
2. AlienVOIP sends SIP INVITE to FreeSWITCH
   "Incoming call from +60123456789"
   ↓
3. FreeSWITCH receives call
   ↓
4. FreeSWITCH follows dialplan
   → Routes to Extension 999 (AI Handler)
   ↓
5. AI Handler answers via WebSocket
   ↓
6. Conversation starts!
```

---

## Step 4: Configure Outbound Route

After gateway is created, tell FreeSWITCH to use it for calls:

1. Go to: **Dialplan** → **Outbound Routes**
2. Click: **Add New Route**
3. Fill in:

```
Route Name: All Calls via AlienVOIP
Gateway: AlienVOIP (select from dropdown)
Dialplan Expression: ^(\d+)$
(This means: any digits = use this route)
Enabled: Yes
```

4. Save

---

## Step 5: Test SIP Trunk

### Test from FreeSWITCH CLI:

```bash
# SSH into FreeSWITCH server
ssh root@159.223.45.224

# Enter FreeSWITCH console
fs_cli

# Check gateway status
sofia status gateway AlienVOIP

# Expected output:
Gateway: AlienVOIP
State: REGED  ← This means connected!
```

### Make Test Call:

```bash
# In fs_cli console
originate sofia/gateway/AlienVOIP/+60123456789 &echo

# This will:
# 1. Call +60123456789 via AlienVOIP
# 2. Play echo back to them (they hear themselves)
```

---

## What Each Client Needs

Each of your 200 clients needs THEIR OWN AlienVOIP account:

**Client 1:**
- Username: 646006001
- Password: xxxxx
- Server: sip1.alienvoip.com

**Client 2:**
- Username: 646006002
- Password: yyyyy
- Server: sip1.alienvoip.com

**Client 200:**
- Username: 646006200
- Password: zzzzz
- Server: sip1.alienvoip.com

---

## But Wait! How Do 200 Clients Use 1 FreeSWITCH?

**Option 1: Multi-Tenant (Recommended)**

Create 200 gateways in FreeSWITCH:
- Gateway: Client1_AlienVOIP (username: 646006001)
- Gateway: Client2_AlienVOIP (username: 646006002)
- ...
- Gateway: Client200_AlienVOIP (username: 646006200)

When client makes call, use THEIR gateway:
```typescript
await freeswitchClient.originateCall({
  phoneNumber: '+60123456789',
  gateway: 'Client1_AlienVOIP', // Use client's specific gateway
  aiHandlerUrl: 'wss://...'
});
```

**Option 2: Shared Gateway (Simpler)**

All clients share ONE AlienVOIP account (yours: 646006395)
- Pro: Simple setup
- Con: All calls billed to your account
- You charge clients from their credits balance

---

## Which Option Should You Use?

### Use **Option 2 (Shared)** if:
- ✅ You want to manage billing yourself
- ✅ Clients just pay YOU for credits
- ✅ You handle one AlienVOIP bill

### Use **Option 1 (Multi-Tenant)** if:
- ✅ Each client has their own AlienVOIP account
- ✅ Clients pay AlienVOIP directly
- ✅ You just provide the AI calling platform

---

## Your Current Setup (Based on Conversation)

You said: "200 clients will use AlienVOIP only"

This suggests **Option 2 (Shared)**:
- 1 FreeSWITCH server (159.223.45.224)
- 1 AlienVOIP gateway (646006395 / Xh7Yk5Ydcg)
- All 200 clients make calls through this gateway
- You charge clients from their credits_balance
- You pay AlienVOIP at the end of month

**This is the simplest approach!**

---

## Summary - What You Need To Do

1. ✅ Install fspbx on 159.223.45.224 (you're doing this)
2. ✅ Configure AlienVOIP gateway (I showed you how above)
3. ✅ Create outbound route (I showed you how above)
4. ✅ Test gateway is REGED (green status)
5. ✅ Deploy code to Deno
6. ✅ Make test call!

**SIP Trunk is just a configuration - no programming needed!**

---

## Next Step: Let's Configure Your Gateway!

Are you ready to:
1. Access fspbx web interface at http://159.223.45.224?
2. Configure AlienVOIP gateway?
3. Test the connection?

Just say "yes" and I'll guide you step-by-step with screenshots explanations!
