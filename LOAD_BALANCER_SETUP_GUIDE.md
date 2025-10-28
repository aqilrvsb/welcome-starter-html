# DigitalOcean Load Balancer Setup Guide for FreeSWITCH

## Overview
This guide documents the complete setup of a DigitalOcean Load Balancer to distribute SIP call traffic across multiple FreeSWITCH servers for high-volume calling (5000+ concurrent calls).

## Infrastructure Details

### Load Balancer Configuration
- **Name**: FREESWITCH-LOAD-BALANCER
- **Type**: Regional / External (Public) / Network
- **Region**: SGP1 (Singapore)
- **Public IP**: 144.126.243.181
- **Internal VPC IP**: 10.104.0.3
- **Cost**: $15/month
- **Purpose**: Distribute SIP traffic across multiple FreeSWITCH servers

### FreeSWITCH Servers (Backend Droplets)

#### Server 1 (Original):
- **Name**: debian-s-2vcpu-4gb-120gb-intel-sgp1-01
- **Public IP**: 159.223.45.224
- **VPC IP**: 10.104.0.5
- **Specs**: 2 vCPU, 4GB RAM, 120GB SSD
- **Capacity**: 100-200 concurrent calls
- **Cost**: $24/month

#### Server 2 (Duplicated):
- **Name**: freswitch-s-2vcpu-4gb-120gb-intel-sgp1-01
- **Public IP**: 159.223.65.33
- **VPC IP**: 10.104.0.4
- **Specs**: 2 vCPU, 4GB RAM, 120GB SSD
- **Capacity**: 100-200 concurrent calls
- **Cost**: $24/month

#### Combined Capacity:
- **Total Concurrent Calls**: 200-400 calls
- **Target Capacity**: 5000 concurrent calls (requires 25-50 servers total)

### Network Architecture
```
                    Internet
                       |
                       v
            Load Balancer (144.126.243.181)
                  /          \
                 /            \
                v              v
        Server 1           Server 2
     159.223.45.224    159.223.65.33
      (10.104.0.5)      (10.104.0.4)
           |                  |
           v                  v
    PostgreSQL DB      PostgreSQL DB
    (Separate DBs)     (Separate DBs)
```

## Step-by-Step Setup Process

### Prerequisites
1. At least 2 FreeSWITCH servers running and configured
2. Both servers must be in the same region (SGP1)
3. Both servers must be in the same VPC network
4. Both servers tagged with "FreeSwitch" tag
5. FreeSWITCH ESL port (8021) listening on 0.0.0.0

### Step 1: Create Load Balancer

1. Go to DigitalOcean Dashboard → **Networking** → **Load Balancers**
2. Click **Create Load Balancer**

#### Choose Settings:
- **Load Balancer Type**: Regional
- **Network Visibility**: **External (Public)** ⚠️ IMPORTANT: Do NOT choose "Internal"
- **Datacenter Region**: SGP1 - Singapore
- **VPC Network**: Select your existing VPC (or default)

### Step 2: Configure Forwarding Rules

Configure TWO forwarding rules for SIP traffic:

#### Rule 1: Standard SIP
- **Protocol**: TCP
- **Port**: 5060
- **Target Protocol**: TCP
- **Target Port**: 5060

#### Rule 2: WebRTC/SIP-TLS
- **Protocol**: TCP
- **Port**: 5080
- **Target Protocol**: TCP
- **Target Port**: 5080

⚠️ **Common Mistake**: Do NOT use HTTP protocol - must be TCP for SIP traffic!

### Step 3: Configure Health Checks

This is the most critical part. Health checks determine if your FreeSWITCH servers are online and can handle traffic.

#### Health Check Configuration:
- **Protocol**: TCP ⚠️ Must be TCP, NOT HTTP
- **Port**: 8021 (FreeSWITCH ESL port)
- **Check Interval**: 10 seconds
- **Response Timeout**: 5 seconds
- **Unhealthy Threshold**: 3 checks
- **Healthy Threshold**: 3 checks

⚠️ **Common Mistakes**:
- ❌ Using HTTP protocol (will fail)
- ❌ Using port 80 (wrong port)
- ❌ Using port 5060 (SIP port doesn't respond to TCP health checks properly)
- ✅ Use TCP on port 8021 (ESL port that always responds)

### Step 4: Add Droplets

#### Option A: By Tag (Recommended)
- Select **Tag**: FreeSwitch
- This automatically includes all servers with the "FreeSwitch" tag
- Easier to scale (just tag new servers and they're automatically added)

#### Option B: Manual Selection
- Manually select each FreeSWITCH droplet
- debian-s-2vcpu-4gb-120gb-intel-sgp1-01
- freswitch-s-2vcpu-4gb-120gb-intel-sgp1-01

### Step 5: Configure Advanced Settings (Optional)

#### Sticky Sessions:
- **Enable**: Yes (recommended for SIP)
- **Type**: Source IP
- **Reason**: Ensures calls from the same client always go to the same server

#### Algorithm:
- **Round Robin**: Default (distributes evenly)
- **Least Connections**: Better for varying call lengths

### Step 6: Name and Create

- **Name**: FREESWITCH-LOAD-BALANCER (or your preferred name)
- Click **Create Load Balancer**

### Step 7: Wait for Provisioning

⏱️ **Provisioning Time**: 10-15 minutes

During provisioning:
1. Load balancer will show "Creating" status
2. Droplets will initially show as "Down"
3. After 10-15 minutes, droplets should change to "Healthy" (green)
4. Status should show: **2/2 Healthy Droplets**

## Verification Steps

### 1. Check Load Balancer Status
```bash
# You should see this in the DigitalOcean dashboard:
Status: 2/2 Healthy Droplets
```

### 2. Verify FreeSWITCH ESL is Listening (on each server)
```bash
ssh root@159.223.45.224
netstat -tuln | grep 8021
# Expected output: tcp 0 0 0.0.0.0:8021 0.0.0.0:* LISTEN
```

```bash
ssh root@159.223.65.33
netstat -tuln | grep 8021
# Expected output: tcp 0 0 0.0.0.0:8021 0.0.0.0:* LISTEN
```

### 3. Verify VPC Network Configuration
```bash
# On Server 1:
ssh root@159.223.45.224
ip addr show | grep "inet 10.104"
# Expected: inet 10.104.0.5/20

# On Server 2:
ssh root@159.223.65.33
ip addr show | grep "inet 10.104"
# Expected: inet 10.104.0.4/20
```

### 4. Test ESL Response
```bash
# On Server 1:
ssh root@159.223.45.224
echo '' | nc -w 3 10.104.0.5 8021 | head -1
# Expected: Content-Type: auth/request

# On Server 2:
ssh root@159.223.65.33
echo '' | nc -w 3 10.104.0.4 8021 | head -1
# Expected: Content-Type: auth/request
```

### 5. Verify Firewall Rules
```bash
# On both servers:
iptables -L -n | grep 8021
# Expected: ACCEPT tcp -- 0.0.0.0/0 0.0.0.0/0 tcp dpt:8021
```

### 6. Test Load Balancer Connectivity
```bash
# From your local machine or another server:
nc -zv 144.126.243.181 5060
nc -zv 144.126.243.181 5080
# Expected: Connection succeeded
```

## Configuration Files

### FreeSWITCH SIP Profiles
No changes needed to FreeSWITCH configuration. The load balancer works at the network layer (Layer 4 TCP), so FreeSWITCH doesn't need to be aware of it.

### SIP Trunk Configuration (AlienVOIP)
Update your SIP trunk provider to point to the load balancer IP instead of individual server IPs:

**Old Configuration**:
```
SIP Server: 159.223.45.224:5060
```

**New Configuration**:
```
SIP Server: 144.126.243.181:5060
```

## Troubleshooting

### Issue 1: Droplets Showing as "Down"

**Symptoms**: Load balancer shows "0/2 Healthy Droplets" or droplets have red status

**Possible Causes**:
1. Health check using HTTP instead of TCP
2. Health check on wrong port (80 instead of 8021)
3. FreeSWITCH ESL not listening on 0.0.0.0
4. Firewall blocking port 8021
5. Load balancer still provisioning (needs 10-15 minutes)

**Solution**:
```bash
# 1. Verify health check configuration in DigitalOcean:
#    - Protocol: TCP (not HTTP)
#    - Port: 8021 (not 80 or 5060)

# 2. Check ESL is listening on all interfaces:
ssh root@SERVER_IP
netstat -tuln | grep 8021
# Must show: 0.0.0.0:8021 (not 127.0.0.1:8021)

# 3. Check firewall:
iptables -L -n | grep 8021
# Should show ACCEPT rule

# 4. Test ESL response:
echo '' | nc -w 3 localhost 8021 | head -1
# Should return: Content-Type: auth/request

# 5. Wait 10-15 minutes for provisioning to complete
```

### Issue 2: Load Balancer Has No Public IP

**Symptoms**: Load balancer shows only internal IP (10.x.x.x), no public IP listed

**Cause**: Load balancer created as "Internal" instead of "External (Public)"

**Solution**:
1. Delete the internal load balancer
2. Create new load balancer
3. Select **External (Public)** for Network Visibility
4. Complete setup again

### Issue 3: Health Check Shows Wrong Path

**Symptoms**: Health check shows `http://0.0.0.0:8021/` or `tcp://0.0.0.0:8021`

**Explanation**: The `0.0.0.0:8021` is just how DigitalOcean displays the health check in the UI. Behind the scenes, it checks each droplet's actual VPC IP (10.104.0.5 and 10.104.0.4). This is normal and correct.

### Issue 4: Calls Not Distributed Evenly

**Symptoms**: All calls going to one server

**Possible Causes**:
1. Sticky sessions enabled (by design - calls from same source go to same server)
2. One server marked as unhealthy
3. Load balancing algorithm set to "Least Connections" with uneven load

**Solution**:
1. Check both droplets show as "Healthy"
2. Verify sticky sessions setting matches your requirements
3. Consider switching algorithm to "Round Robin" for even distribution

### Issue 5: SIP Registration Fails Through Load Balancer

**Symptoms**: Can't register SIP endpoints through load balancer IP

**Cause**: SIP registration requires UDP, but load balancer only forwards TCP

**Solution**:
- Use direct server IPs for SIP registration (UDP port 5060)
- Use load balancer IP only for incoming calls (TCP ports 5060/5080)
- Or configure additional UDP forwarding rules on the load balancer

### Issue 6: Calls Drop After 60 Seconds

**Symptoms**: All calls disconnect at exactly 60 seconds

**Cause**: Load balancer idle timeout too low

**Solution**:
1. Go to Load Balancer → Settings
2. Increase **Idle Timeout** to 3600 seconds (1 hour)
3. This allows long calls to stay connected

## Database Strategy

### Separate Databases (Recommended) ✅
Each FreeSWITCH server uses its own local PostgreSQL database.

**Advantages**:
- Better performance (no network latency)
- No single point of failure
- Easier to scale horizontally
- Each server is independent

**Disadvantages**:
- Call history is split across multiple databases
- Need to aggregate data for reporting
- More complex backup strategy

**Best For**: High-volume calling (5000+ concurrent calls)

### Shared Database (Alternative)
All FreeSWITCH servers connect to a single PostgreSQL database.

**Advantages**:
- Centralized call history
- Unified reporting
- Single backup point

**Disadvantages**:
- Database becomes bottleneck at scale
- Single point of failure
- Network latency for database queries
- Harder to scale beyond 500-1000 concurrent calls

**Best For**: Low-to-medium volume (< 500 concurrent calls)

**Recommendation**: For your 5000 concurrent call target, **keep separate databases** on each server.

## Scaling Beyond 2 Servers

To reach 5000 concurrent calls:

### Required Servers:
- 2 vCPU / 4GB RAM: ~100-200 calls per server
- For 5000 calls: 25-50 servers needed

### Scaling Process:
1. Create snapshot of working FreeSWITCH server (follow SERVER_DUPLICATION_GUIDE.md)
2. Create new droplet from snapshot
3. Run `fix-new-server-ip.sh` on new server
4. Tag new server with "FreeSwitch" tag
5. Load balancer automatically adds it (if using tag-based selection)
6. Wait 2-3 minutes for health checks to pass
7. New server starts receiving traffic

### Cost Calculation:
- 50 servers × $24/month = $1,200/month
- 1 load balancer × $15/month = $15/month
- **Total**: ~$1,215/month for 5000 concurrent calls

## Monitoring and Maintenance

### Daily Checks:
```bash
# 1. Check load balancer status (should show all droplets healthy)
# Visit: https://cloud.digitalocean.com/networking/load_balancers

# 2. Check FreeSWITCH status on each server:
ssh root@SERVER_IP
fs_cli -x "sofia status"
fs_cli -x "show channels count"

# 3. Monitor call volume:
fs_cli -x "show calls"
```

### Weekly Checks:
- Review call distribution across servers
- Check for any unhealthy droplets
- Monitor server CPU/RAM usage
- Review database sizes

### Alerts to Set Up:
1. Droplet health status changes to "Down"
2. Load balancer becomes unreachable
3. CPU usage > 80% on any server
4. Memory usage > 90% on any server
5. Concurrent calls > 150 per server (time to add more servers)

## Success Criteria

✅ Load balancer status: 2/2 Healthy Droplets (or X/X for more servers)
✅ Public IP assigned: 144.126.243.181
✅ Both forwarding rules active (TCP 5060 and 5080)
✅ Health checks passing (TCP on port 8021)
✅ Can connect to ports 5060 and 5080 on load balancer IP
✅ Calls distributed across both servers
✅ No call drops or quality issues

## Current Status (as of 2025-10-27)

✅ Load balancer created successfully
✅ Public IP: 144.126.243.181
✅ 2/2 droplets healthy
✅ Health checks: TCP on port 8021 (passing)
✅ Forwarding rules: TCP 5060 and 5080 (configured)
✅ Both servers responding to ESL health checks
✅ VPC network configured (10.104.0.5 and 10.104.0.4)
✅ Firewall rules allowing port 8021

**Next Steps**:
1. Test connectivity to 144.126.243.181:5060 and 144.126.243.181:5080
2. Update AlienVOIP SIP trunk to use load balancer IP
3. Test actual call routing through load balancer
4. Monitor call distribution across both servers
5. Scale to more servers as call volume increases

## Important IPs to Remember

- **Load Balancer Public IP**: 144.126.243.181 ← Use this for SIP trunk
- **Server 1 Public IP**: 159.223.45.224 (for SSH access)
- **Server 2 Public IP**: 159.223.65.33 (for SSH access)
- **Server 1 VPC IP**: 10.104.0.5 (internal only)
- **Server 2 VPC IP**: 10.104.0.4 (internal only)

## References

- DigitalOcean Load Balancer Docs: https://docs.digitalocean.com/products/networking/load-balancers/
- FreeSWITCH ESL Documentation: https://freeswitch.org/confluence/display/FREESWITCH/mod_event_socket
- Server Duplication Guide: SERVER_DUPLICATION_GUIDE.md
