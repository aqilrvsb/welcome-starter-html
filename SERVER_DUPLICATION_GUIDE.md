# Server Duplication Guide for Load Balancing
## Current Server: 159.223.45.224

---

## 📋 Current Server Configuration

### Hardware Specs
- **Provider**: DigitalOcean Premium Intel (Singapore)
- **Plan**: $24/month (s-2vcpu-4gb-120gb-intel)
- **CPU**: 2 vCPU cores
- **RAM**: 4GB
- **Disk**: 120GB SSD
- **OS**: Debian GNU/Linux 13 (trixie)
- **Hostname**: debian-s-2vcpu-4gb-120gb-intel-sgp1-01

### Installed Software Stack

#### Core Services (Enabled & Auto-start)
1. **FreeSWITCH 1.10.12** - VoIP server
   - Binary: `/usr/bin/freeswitch`
   - Config: `/etc/freeswitch/`
   - User: `www-data`
   - Max Sessions: 1000 (configurable)
   - Sessions/Second: 30 (configurable)

2. **Nginx 1.26.3** - Web server
   - Config: `/etc/nginx/sites-enabled/fspbx.conf`
   - Serves: FusionPBX Laravel app

3. **PHP 8.1-FPM** - PHP processor
   - Extensions: curl, gd, mbstring, pgsql, redis, xml, zip, imap, ldap, opcache

4. **PostgreSQL 17** - Database
   - Database: `fusionpbx`
   - User: `fusionpbx`
   - Password: `b7ND06rsxZqDt9G5XKub`
   - Port: 5432 (localhost only)

5. **Redis 8.0.2** - Cache & Queue
   - Port: 6379 (localhost only)
   - Used by Laravel Horizon

6. **Supervisor** - Process manager
   - Manages: Horizon workers, ESL listener

### Application Details

#### FusionPBX Laravel App
- **Location**: `/var/www/fspbx/`
- **Type**: Laravel-based PBX management
- **User**: `www-data`
- **Environment**: Production

#### Laravel Horizon (Queue Workers)
- **Config**: `/etc/supervisor/conf.d/horizon.conf`
- **Queues**: default, emails, faxes, messages, slack, stripe, ztp
- **Workers**: 1 process, auto-restart enabled
- **Log**: `/var/www/fspbx/storage/logs/horizon.log`

### Cron Jobs (Root)
```bash
# XML CDR Import (3 processes)
* * * * * cd /var/www/fspbx; /usr/bin/php /var/www/fspbx/public/app/xml_cdr/xml_cdr_import.php 100 abcdef >/dev/null 2>&1
* * * * * cd /var/www/fspbx; /usr/bin/php /var/www/fspbx/public/app/xml_cdr/xml_cdr_import.php 100 01234 >/dev/null 2>&1
* * * * * cd /var/www/fspbx; /usr/bin/php /var/www/fspbx/public/app/xml_cdr/xml_cdr_import.php 100 56789 >/dev/null 2>&1

# Laravel Scheduler
* * * * * cd /var/www/fspbx && php artisan schedule:run >> /dev/null 2>&1
```

### Network Ports (Open)
- **5060** - SIP (TCP/UDP)
- **5080** - SIP/WebRTC
- **5066** - SIP internal
- **8021** - FreeSWITCH ESL (Event Socket Layer)
- **443** - HTTPS
- **80** - HTTP
- **5432** - PostgreSQL (localhost only)
- **6379** - Redis (localhost only)

### Current Performance
- **Load Average**: 0.11, 0.20, 0.15 (very light)
- **Memory Used**: 1.3GB / 4GB (2.5GB available)
- **Disk Used**: 7.8GB / 118GB (106GB free)
- **Uptime**: 4+ days, very stable

---

## 🔄 How to Duplicate This Server for Load Balancing

### Option 1: DigitalOcean Snapshot Method (RECOMMENDED)

#### Step 1: Prepare Current Server
```bash
# SSH into current server
ssh root@159.223.45.224

# Stop non-essential services temporarily
systemctl stop nginx
systemctl stop php8.1-fpm
systemctl stop supervisor

# Clear temporary files and logs
cd /var/www/fspbx/storage/logs
> horizon.log
> laravel.log

# Clear application cache
cd /var/www/fspbx
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Clean up system
apt-get clean
apt-get autoremove -y

# Restart services
systemctl start nginx
systemctl start php8.1-fpm
systemctl start supervisor
```

#### Step 2: Create Snapshot in DigitalOcean Dashboard

1. Go to: https://cloud.digitalocean.com/droplets
2. Click on your droplet (159.223.45.224)
3. Click "Snapshots" tab
4. Click "Take Snapshot"
5. Name it: `freeswitch-loadbalancer-v1-2025-01-27`
6. Wait 5-10 minutes for snapshot to complete

#### Step 3: Create New Droplets from Snapshot

1. Go to: Create → Droplets
2. Choose "Snapshots" tab
3. Select: `freeswitch-loadbalancer-v1-2025-01-27`
4. Choose Region: Singapore (same as original)
5. Choose Size: **$24/month (2 vCPU, 4GB)** OR **$48/month (4 vCPU, 8GB)** for 1000 calls each
6. Choose Quantity: Create 2-5 droplets (for 2000-5000 concurrent calls)
7. Click "Create Droplets"

#### Step 4: Configure Each New Server ⚠️ **CRITICAL STEP!**

**IMPORTANT**: After creating a droplet from snapshot, the Laravel app will still have the OLD server's IP addresses in configuration. This causes **419 CSRF Token Expired** errors when trying to login.

For each new server (let's say IP: 178.x.x.x):

```bash
# SSH into new server
ssh root@178.x.x.x

# 1. Change hostname (optional but recommended)
hostnamectl set-hostname freeswitch-node-2
# (use node-3, node-4, etc. for additional servers)

# 2. FIX LARAVEL APP CONFIGURATION (CRITICAL!)
# Get the new server's IP
NEW_IP=$(hostname -I | awk '{print $1}')
echo "Detected IP: $NEW_IP"

cd /var/www/fspbx

# Backup .env file
cp .env .env.backup.$(date +%Y%m%d%H%M%S)

# Replace OLD IP with NEW IP in Laravel configuration
OLD_IP="159.223.45.224"
sed -i "s|APP_URL=https://$OLD_IP|APP_URL=https://$NEW_IP|g" .env
sed -i "s|SESSION_DOMAIN=$OLD_IP|SESSION_DOMAIN=$NEW_IP|g" .env
sed -i "s|SANCTUM_STATEFUL_DOMAINS=$OLD_IP|SANCTUM_STATEFUL_DOMAINS=$NEW_IP|g" .env

# Verify changes
echo "=== Updated Configuration ==="
grep -E "APP_URL|SESSION_DOMAIN|SANCTUM_STATEFUL_DOMAINS" .env

# Clear all Laravel caches
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Clear old session data
rm -rf storage/framework/sessions/*

# 3. Update FreeSWITCH IP (usually auto-detected, but verify)
# Check current FreeSWITCH IP configuration
fs_cli -x "global_getvar external_sip_ip"
# Should show your NEW_IP automatically. If not, edit manually:
# nano /etc/freeswitch/vars.xml
# Update: <X-PRE-PROCESS cmd="set" data="external_sip_ip=NEW_SERVER_IP"/>
# Update: <X-PRE-PROCESS cmd="set" data="external_rtp_ip=NEW_SERVER_IP"/>

# 4. Configure Database Connection (Choose One Option)
#
# OPTION A: Use Local Database (Independent Server)
# - Keep: DB_HOST=127.0.0.1
# - Each server has its own data (good for testing)
#
# OPTION B: Use Shared Database (Load Balanced)
# - Change: DB_HOST=159.223.45.224 (master DB IP)
# - All servers share same data (required for load balancing)
# - Remember to configure master DB to accept remote connections!

# 5. Configure Redis Connection (Choose One Option)
#
# OPTION A: Use Local Redis (Independent Server)
# - Keep: REDIS_HOST=127.0.0.1
#
# OPTION B: Use Shared Redis (Load Balanced)
# - Change: REDIS_HOST=EXTERNAL_REDIS_IP (Upstash or master)
# - Required for distributed queue/job processing

# 6. Restart ALL services
systemctl restart freeswitch
systemctl restart nginx
systemctl restart php8.1-fpm
systemctl restart supervisor

# 7. Verify Everything is Running
echo "=== Service Status ==="
systemctl is-active freeswitch nginx php8.1-fpm postgresql redis-server supervisor

echo "=== FreeSWITCH Status ==="
fs_cli -x "status"

echo "=== FreeSWITCH IPs ==="
fs_cli -x "global_getvar external_sip_ip"
fs_cli -x "global_getvar external_rtp_ip"

echo "=== Test Web Access ==="
curl -I http://localhost | head -5

echo "✅ Server configured successfully!"
echo "You can now access FusionPBX at: https://$NEW_IP"
```

#### Step 4.1: Automated Fix Script (RECOMMENDED)

To make this easier for future duplications, save this as `/root/fix-new-server-ip.sh`:

```bash
#!/bin/bash
# fix-new-server-ip.sh - Automatically configure new server after snapshot
# Usage: bash fix-new-server-ip.sh

set -e  # Exit on error

echo "🔧 Configuring new server from snapshot..."

# Get new server's IP
NEW_IP=$(hostname -I | awk '{print $1}')
OLD_IP="159.223.45.224"

echo "📍 Detected IP: $NEW_IP"
echo "🔄 Replacing old IP: $OLD_IP"

# Change to app directory
cd /var/www/fspbx

# Backup .env
BACKUP_FILE=".env.backup.$(date +%Y%m%d%H%M%S)"
cp .env "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"

# Replace IPs in .env
sed -i "s|APP_URL=https://$OLD_IP|APP_URL=https://$NEW_IP|g" .env
sed -i "s|SESSION_DOMAIN=$OLD_IP|SESSION_DOMAIN=$NEW_IP|g" .env
sed -i "s|SANCTUM_STATEFUL_DOMAINS=$OLD_IP|SANCTUM_STATEFUL_DOMAINS=$NEW_IP|g" .env

echo "✅ Updated .env configuration:"
grep -E "APP_URL|SESSION_DOMAIN|SANCTUM_STATEFUL_DOMAINS" .env

# Clear Laravel caches
echo "🧹 Clearing Laravel caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Clear sessions
echo "🧹 Clearing old sessions..."
rm -rf storage/framework/sessions/*

# Restart services
echo "🔄 Restarting services..."
systemctl restart php8.1-fpm
systemctl restart nginx
systemctl restart supervisor

# Verify services
echo "✅ Verifying services..."
if systemctl is-active --quiet freeswitch nginx php8.1-fpm postgresql redis-server supervisor; then
    echo "✅ All services running"
else
    echo "⚠️  Warning: Some services may not be running"
    systemctl status freeswitch nginx php8.1-fpm postgresql redis-server supervisor --no-pager
fi

# Check FreeSWITCH IPs
echo "📡 FreeSWITCH Configuration:"
fs_cli -x "global_getvar external_sip_ip" || echo "Could not connect to FreeSWITCH"
fs_cli -x "global_getvar external_rtp_ip" || echo "Could not connect to FreeSWITCH"

echo ""
echo "✅ ✅ ✅ Configuration complete!"
echo ""
echo "🌐 You can now access FusionPBX at: https://$NEW_IP"
echo "🔐 Clear your browser cache/cookies before logging in!"
echo ""
echo "💡 To check status: systemctl status freeswitch nginx php8.1-fpm"
echo "💡 To view logs: tail -f /var/www/fspbx/storage/logs/laravel.log"
```

**How to use the automated script:**

```bash
# After creating new droplet from snapshot:
ssh root@NEW_SERVER_IP

# Create the script
nano /root/fix-new-server-ip.sh
# (paste the script above)

# Make it executable
chmod +x /root/fix-new-server-ip.sh

# Run it
bash /root/fix-new-server-ip.sh

# Done! Server is now configured.
```

---

## 🔀 Load Balancer Setup

### Option A: DigitalOcean Load Balancer (EASIEST)

#### Step 1: Create Load Balancer
1. Go to: https://cloud.digitalocean.com/networking/load_balancers
2. Click "Create Load Balancer"
3. **Region**: Singapore (same as droplets)
4. **Network**: External (Public)
5. **VPC**: Default VPC

#### Step 2: Configure Settings
```
Forwarding Rules:
- Protocol: TCP
- Port: 5060 (SIP)
- Target Port: 5060
- Health Check: TCP on port 5060

Add another rule:
- Protocol: TCP
- Port: 5080 (WebRTC)
- Target Port: 5080
- Health Check: TCP on port 5080
```

#### Step 3: Add Droplets
- Select all your FreeSWITCH droplets
- Load balancer will distribute SIP calls across them

#### Step 4: Configure Health Checks
```
Protocol: TCP
Port: 5060
Check Interval: 10 seconds
Response Timeout: 5 seconds
Unhealthy Threshold: 3
Healthy Threshold: 3
```

**Cost**: $12/month for load balancer

---

### Option B: Kamailio SIP Load Balancer (Advanced)

If you want a SIP-specific load balancer instead of DigitalOcean's generic one:

1. Create a new $6/month droplet
2. Install Kamailio
3. Configure as dispatcher to route calls to FreeSWITCH nodes

**Advantages**:
- Better SIP call distribution
- Can handle SIP-specific routing logic
- Cheaper than DO load balancer ($6 vs $12/month)

**Disadvantages**:
- More complex setup
- You manage it yourself

---

## 📊 Architecture Diagrams

### Current (Single Server)
```
                    ┌─────────────────────┐
AlienVOIP SIP  ───► │  DigitalOcean       │
                    │  159.223.45.224     │
                    │  FreeSWITCH         │
                    │  (100-200 calls)    │
                    └─────────────────────┘
```

### Load Balanced (2000+ concurrent calls)
```
                          ┌──────────────────┐
                          │  Load Balancer   │
AlienVOIP SIP  ───────►   │  (DigitalOcean)  │
                          └────────┬─────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌───────────────┐          ┌───────────────┐        ┌───────────────┐
│ FreeSWITCH #1 │          │ FreeSWITCH #2 │        │ FreeSWITCH #3 │
│ 159.223.45.224│          │ 178.x.x.x     │   ...  │ 188.x.x.x     │
│ 1000 calls    │          │ 1000 calls    │        │ 1000 calls    │
└───────┬───────┘          └───────┬───────┘        └───────┬───────┘
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   ▼
                          ┌──────────────────┐
                          │  Shared Redis    │
                          │  (Upstash)       │
                          └──────────────────┘
                                   │
                          ┌──────────────────┐
                          │  Master Database │
                          │  PostgreSQL      │
                          └──────────────────┘
```

---

## 🎯 Recommended Scaling Plan

### For 500 Concurrent Calls
- **Servers**: 2x current server ($24 each)
- **Load Balancer**: DigitalOcean LB ($12/month)
- **Total**: $60/month

### For 1000 Concurrent Calls
- **Servers**: 2x upgraded server ($48 each, 4 vCPU, 8GB)
- **Load Balancer**: DigitalOcean LB ($12/month)
- **Total**: $108/month

### For 2000 Concurrent Calls
- **Servers**: 4x current server ($24 each)
- **Load Balancer**: DigitalOcean LB ($12/month)
- **Redis**: Upstash ($10/month)
- **Total**: $118/month

### For 5000 Concurrent Calls
- **Servers**: 5x upgraded server ($48 each, 4 vCPU, 8GB)
- **Load Balancer**: DigitalOcean LB ($12/month)
- **Redis**: Upstash Pro ($50/month)
- **PostgreSQL**: External managed ($25/month)
- **Total**: $327/month

---

## ⚠️ Important Considerations

### Database Strategy
**Current**: Each server has its own PostgreSQL instance (isolated)
**Load Balanced**: You need to choose:

1. **Shared Database** (Recommended for < 1000 calls)
   - All servers connect to master DB (159.223.45.224)
   - Pros: Centralized data, easier management
   - Cons: Single point of failure, DB can bottleneck

2. **Separate Databases** (For 1000+ calls)
   - Each server has own DB
   - Use external sync mechanism
   - Pros: Better performance, no single point of failure
   - Cons: Complex data synchronization

### Redis Strategy
**Current**: Each server has local Redis
**Load Balanced**: Use external Redis (Upstash)
- All servers share same queue
- Call distribution via Redis pub/sub
- Cost: $10-50/month

### Session Affinity
- SIP calls need to stick to same server
- Load balancer should use **source IP hashing**
- Prevents call drops during transfer

---

## 🚀 Quick Start Commands

### Test Current Server Capacity
```bash
ssh root@159.223.45.224

# Check current calls
fs_cli -x "show calls"

# Check max sessions
fs_cli -x "show channels" | grep total

# Monitor CPU during calls
htop

# Monitor memory
free -h
```

### After Creating New Servers
```bash
# List all your FreeSWITCH servers
SERVERS="159.223.45.224 178.x.x.x 188.x.x.x"

# Check status of all servers
for server in $SERVERS; do
  echo "=== $server ==="
  ssh root@$server 'fs_cli -x "status"'
done

# Check calls on all servers
for server in $SERVERS; do
  echo "=== $server ==="
  ssh root@$server 'fs_cli -x "show calls count"'
done
```

---

## 📝 Next Steps

1. ✅ **Decision**: How many concurrent calls do you need? (500, 1000, 2000, 5000?)
2. ✅ **Budget**: Confirm monthly budget for infrastructure
3. ✅ **Timeline**: When do you need this ready?
4. ⏭️ **Create Snapshot**: Follow Step 2 above
5. ⏭️ **Duplicate Servers**: Follow Step 3 above
6. ⏭️ **Set Up Load Balancer**: Follow Option A or B
7. ⏭️ **Configure Redis Queue**: Set up Upstash
8. ⏭️ **Test**: Run 100-500 call test batch
9. ⏭️ **Monitor**: Watch performance and optimize
10. ⏭️ **Scale**: Add more servers as needed

---

## 🔧 Troubleshooting Common Issues

### Issue 1: 419 CSRF Token Expired Error When Logging In

**Symptoms:**
- Can access the login page at https://NEW_IP
- When you enter credentials and click login, you get "419 | Page Expired"
- Happens even with wrong credentials

**Root Cause:**
Laravel app is still configured with the OLD server's IP address in `APP_URL`, `SESSION_DOMAIN`, and `SANCTUM_STATEFUL_DOMAINS`. The browser sends cookies for the new IP, but Laravel expects cookies from the old IP domain.

**Solution:**
```bash
ssh root@NEW_SERVER_IP

# Run the fix script
cd /var/www/fspbx

# Get your new IP
NEW_IP=$(hostname -I | awk '{print $1}')
OLD_IP="159.223.45.224"

# Update configuration
sed -i "s|APP_URL=https://$OLD_IP|APP_URL=https://$NEW_IP|g" .env
sed -i "s|SESSION_DOMAIN=$OLD_IP|SESSION_DOMAIN=$NEW_IP|g" .env
sed -i "s|SANCTUM_STATEFUL_DOMAINS=$OLD_IP|SANCTUM_STATEFUL_DOMAINS=$NEW_IP|g" .env

# Clear caches
php artisan config:clear
php artisan cache:clear
rm -rf storage/framework/sessions/*

# Restart PHP
systemctl restart php8.1-fpm nginx

# Clear browser cookies/cache, then try again
```

**Verified Fix:** This was tested on server 159.223.65.33 and confirmed working ✅

---

### Issue 2: FreeSWITCH Not Registering with Correct IP

**Symptoms:**
- FreeSWITCH is running but showing old IP address
- SIP registrations fail
- Calls don't connect

**Root Cause:**
FreeSWITCH vars.xml still has old IP hardcoded (though usually it auto-detects).

**Check Current IP:**
```bash
fs_cli -x "global_getvar external_sip_ip"
fs_cli -x "global_getvar external_rtp_ip"
```

**Solution if IP is wrong:**
```bash
# Edit FreeSWITCH variables
nano /etc/freeswitch/vars.xml

# Find and update these lines (remove hardcoded IPs):
# <X-PRE-PROCESS cmd="set" data="external_sip_ip=$${local_ip_v4}"/>
# <X-PRE-PROCESS cmd="set" data="external_rtp_ip=$${local_ip_v4}"/>

# Restart FreeSWITCH
systemctl restart freeswitch

# Verify
fs_cli -x "global_getvar external_sip_ip"
```

---

### Issue 3: Database Connection Error

**Symptoms:**
- Laravel logs show "SQLSTATE[08006] Connection refused"
- Cannot access FusionPBX web interface
- 500 Internal Server Error

**Root Cause:**
- PostgreSQL not running
- Or wrong database credentials after snapshot

**Solution:**
```bash
# Check if PostgreSQL is running
systemctl status postgresql

# If not running, start it
systemctl start postgresql

# Test database connection
su - postgres -c "psql fusionpbx -c 'SELECT COUNT(*) FROM activity_log;'"

# If connection works, restart Laravel
systemctl restart php8.1-fpm supervisor
```

---

### Issue 4: Horizon Not Processing Jobs

**Symptoms:**
- Jobs stuck in queue
- No call processing happening
- supervisorctl shows horizon is running but not working

**Root Cause:**
- Horizon connected to wrong Redis
- Or cache not cleared after configuration change

**Solution:**
```bash
# Check Redis is running
systemctl status redis-server

# Check Horizon status
supervisorctl status

# Restart Horizon
supervisorctl restart horizon:*

# Check logs
tail -f /var/www/fspbx/storage/logs/horizon.log

# If still issues, clear everything and restart
cd /var/www/fspbx
php artisan horizon:terminate
php artisan config:clear
php artisan cache:clear
systemctl restart supervisor
```

---

### Issue 5: Cannot Access New Server via HTTPS

**Symptoms:**
- Browser shows "Connection refused" or "ERR_CONNECTION_REFUSED"
- Cannot access https://NEW_IP

**Root Cause:**
- Nginx not running
- Or SSL certificate issue
- Or firewall blocking port 443

**Solution:**
```bash
# Check if Nginx is running
systemctl status nginx

# Check if port 443 is listening
netstat -tuln | grep 443

# Restart Nginx
systemctl restart nginx

# Check Nginx error logs
tail -50 /var/log/nginx/error.log

# Test if you can access via HTTP first
curl -I http://localhost
```

---

### Issue 6: Both Old and New Server Show Same Data

**Symptoms:**
- Changes on one server appear on the other
- Both servers seem to be sharing the same database

**Root Cause:**
This might actually be correct if you configured shared database! But if you wanted independent servers:

**Check Configuration:**
```bash
cat /var/www/fspbx/.env | grep DB_HOST
```

**If it shows:** `DB_HOST=159.223.45.224` → You're using shared database (intended for load balancing)

**If it shows:** `DB_HOST=127.0.0.1` → Each server is independent (good for testing)

---

### Issue 7: How to Verify New Server is Working Properly

**Complete Health Check:**
```bash
#!/bin/bash
echo "=== HEALTH CHECK FOR NEW SERVER ==="
echo ""

# 1. System Info
echo "📍 Server IP: $(hostname -I | awk '{print $1}')"
echo "🏷️  Hostname: $(hostname)"
echo "⏱️  Uptime: $(uptime -p)"
echo ""

# 2. Services Status
echo "🔧 Services:"
for service in freeswitch nginx php8.1-fpm postgresql redis-server supervisor; do
    if systemctl is-active --quiet $service; then
        echo "  ✅ $service: running"
    else
        echo "  ❌ $service: NOT running"
    fi
done
echo ""

# 3. FreeSWITCH
echo "📞 FreeSWITCH:"
echo "  IP: $(fs_cli -x 'global_getvar external_sip_ip' 2>/dev/null || echo 'ERROR')"
echo "  Status: $(fs_cli -x 'status' 2>/dev/null | grep 'is ready' || echo 'ERROR')"
echo ""

# 4. Laravel App
echo "🌐 Laravel App:"
cd /var/www/fspbx
echo "  APP_URL: $(grep APP_URL .env | cut -d'=' -f2)"
echo "  SESSION_DOMAIN: $(grep SESSION_DOMAIN .env | cut -d'=' -f2)"
echo "  DB_HOST: $(grep DB_HOST .env | cut -d'=' -f2)"
echo ""

# 5. Web Server
echo "🔌 Web Server:"
curl -I http://localhost 2>&1 | grep "HTTP" || echo "  ❌ Nginx not responding"
echo ""

# 6. Database
echo "💾 Database:"
su - postgres -c "psql fusionpbx -c 'SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = '\''public'\'';'" 2>&1 | grep -E "tables|row" || echo "  ❌ Database error"
echo ""

echo "✅ Health check complete!"
```

Save this as `/root/health-check.sh` and run: `bash /root/health-check.sh`

---

## 🎉 Success Checklist

After creating a new server from snapshot, verify:

- ✅ Can SSH into server
- ✅ All services are running (freeswitch, nginx, php8.1-fpm, postgresql, redis-server)
- ✅ FreeSWITCH shows correct new IP address
- ✅ Can access web interface at https://NEW_IP
- ✅ Can login to FusionPBX (no 419 error)
- ✅ APP_URL, SESSION_DOMAIN, SANCTUM_STATEFUL_DOMAINS all point to new IP
- ✅ Database is accessible (either local or shared)
- ✅ Horizon workers are processing jobs
- ✅ No errors in logs

---

## 📞 Tested Configurations

### Configuration 1: Successfully Tested ✅
- **Date**: 2025-01-27
- **Old Server**: 159.223.45.224
- **New Server**: 159.223.65.33
- **Issue Found**: 419 CSRF error due to old IP in configuration
- **Fix Applied**: Updated APP_URL, SESSION_DOMAIN, SANCTUM_STATEFUL_DOMAINS
- **Result**: Login working perfectly ✅
- **Services**: All running ✅
- **FreeSWITCH**: IP auto-updated to 159.223.65.33 ✅

---

**Document Created**: 2025-01-27
**Document Updated**: 2025-01-27 (Added troubleshooting section)
**Server Audited**: 159.223.45.224
**Tested Duplication**: 159.223.65.33 ✅
**Current Capacity**: 100-200 concurrent calls per server
**Target Capacity**: 500-5000 concurrent calls (with load balancing)
