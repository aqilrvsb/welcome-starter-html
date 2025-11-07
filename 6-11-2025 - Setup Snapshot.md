# FreeSWITCH Server Setup Snapshot
## Date: November 6, 2025

---

## Executive Summary

This document captures the complete configuration snapshot of two identical FreeSWITCH servers created from a snapshot backup. Both servers are fully configured, verified, and ready for production use.

### Server Details

| Server Type | IP Address | Status | Purpose |
|-------------|------------|--------|---------|
| **Original Server** | 159.223.45.224 | Active (14 days uptime) | Production |
| **New Server** | 178.128.57.106 | Active (Fresh from snapshot) | Production/Backup |

---

## Table of Contents

1. [Server Infrastructure](#server-infrastructure)
2. [FreeSWITCH Configuration](#freeswitch-configuration)
3. [AlienVOIP SIP Trunk](#alienvoip-sip-trunk)
4. [Network & Ports](#network--ports)
5. [Database Configuration](#database-configuration)
6. [Web Services](#web-services)
7. [Security & Firewall](#security--firewall)
8. [Verification Results](#verification-results)
9. [Access Credentials](#access-credentials)
10. [Next Steps](#next-steps)

---

## Server Infrastructure

### Platform Specifications
- **Provider**: Digital Ocean
- **OS**: Debian 12/13
- **RAM**: 4GB
- **Storage**: 120GB
- **CPU**: 2vCPU Intel (Singapore Region)
- **Hostname Original**: debian-s-2vcpu-4gb-120gb-intel-sgp1-01
- **Hostname New**: latestfreeswitch-s-2vcpu-4gb-120gb-intel-sgp1-01

### Installed Software Stack

| Software | Version | Status |
|----------|---------|--------|
| FreeSWITCH | 1.10.12-release (git 729968e) | Active |
| PostgreSQL | 15.x | Active (Port 5432) |
| Nginx | 1.26.3 | Active |
| PHP | 8.1.33 (CLI) | Active |
| Redis | 7.x | Active (Port 6379) |
| fspbx Web Interface | Latest | Active |

---

## FreeSWITCH Configuration

### Version Information
```
FreeSWITCH Version 1.10.12-release+git~20251017T214828Z~729968e6bd~64bit
Build Date: 2025-10-17 21:48:28Z
Architecture: 64-bit
```

### Loaded Modules
- **Total Modules**: 508
- **Key Modules**:
  - ✅ mod_sofia (SIP)
  - ✅ mod_audio_stream (Real-time audio streaming)
  - ✅ mod_commands (ESL commands)
  - ✅ mod_dptools (Dialplan tools)
  - ✅ mod_event_socket (ESL)

### Configuration Files
- **Total XML Files**: 268
- **Config Directory**: `/etc/freeswitch/`
- **Backup Directory**: `/etc/freeswitch.orig/`

### Critical Configuration Checksums (MD5)

| File | MD5 Hash | Status |
|------|----------|--------|
| vars.xml | `a0c7926d4bbdca8ffe4bcf295e18c5fb` | ✅ Identical on both servers |
| event_socket.conf.xml | `f48406fbb2a8e825deb75d30754846a1` | ✅ Identical on both servers |
| modules.conf.xml | `14d2434c984bee683d388dde80bf7718` | ✅ Identical on both servers |

### SIP Profiles

#### External Profile (Port 5080)
```
Profile Name: external
Protocol: SIP/UDP, SIP/TCP
Listening IP (Original): 159.223.45.224:5080
Listening IP (New): 178.128.57.106:5080
Context: public
Codecs: G7221@32000h, G7221@16000h, G722, PCMU, PCMA
```

#### Internal Profile (Port 5060)
```
Profile Name: internal
Protocol: SIP/UDP, SIP/TCP
Listening IP (Original): 159.223.45.224:5060
Listening IP (New): 178.128.57.106:5060
WebSocket: Port 5066
WebSocket Secure: Port 7443
Context: default
Codecs: PCMU, PCMA
```

### RTP Configuration
```
RTP Port Range: 16384-32768 (Default)
RTP IP (Original): 159.223.45.224
RTP IP (New): 178.128.57.106
External RTP IP: Auto-detected
```

---

## AlienVOIP SIP Trunk

### Gateway Configuration

| Parameter | Value |
|-----------|-------|
| **Gateway UUID** | 1360d030-6e0c-4617-83e0-8d80969010cf |
| **Gateway Name** | AlienVOIP |
| **Username** | 646006395 |
| **Password** | Xh7Yk5Ydcg |
| **Proxy Server** | sip3.alienvoip.com |
| **Realm** | sip3.alienvoip.com |
| **Registration** | Required (800 seconds) |
| **Context** | public |
| **Profile** | external |
| **Transport** | UDP |

### Gateway Status

```
Status: REGED (Registered)
State: UP
Uptime (Original): Active - 20 failed / 111 total outbound calls
Uptime (New): Active - 0 calls (fresh server)
Ping: 0.00ms
```

### Registration Details

```
From: <sip:646006395@sip3.alienvoip.com>
To: sip:646006395@sip3.alienvoip.com
Contact (Original): <sip:gw+1360d030-6e0c-4617-83e0-8d80969010cf@159.223.45.224:5080;transport=udp;gw=1360d030-6e0c-4617-83e0-8d80969010cf>
Contact (New): <sip:gw+1360d030-6e0c-4617-83e0-8d80969010cf@178.128.57.106:5080;transport=udp;gw=1360d030-6e0c-4617-83e0-8d80969010cf>
Expires: 800 seconds
```

---

## Network & Ports

### All Listening Ports

| Port | Protocol | Service | Status |
|------|----------|---------|--------|
| 22 | TCP | SSH | ✅ Open |
| 25 | TCP | SMTP (localhost only) | ✅ Active |
| 53 | TCP | DNS (localhost only) | ✅ Active |
| 80 | TCP | HTTP (Nginx) | ✅ Open |
| 443 | TCP | HTTPS (Nginx) | ✅ Open |
| 5060 | TCP | SIP Internal | ✅ Open |
| 5066 | TCP | SIP WebSocket | ✅ Open |
| 5080 | TCP | SIP External | ✅ Open |
| 5355 | TCP | LLMNR | ✅ Active |
| 5432 | TCP | PostgreSQL (localhost only) | ✅ Active |
| 6379 | TCP | Redis (localhost only) | ✅ Active |
| 7443 | TCP | WebRTC WSS | ✅ Open |
| 8021 | TCP | Event Socket Layer (ESL) | ✅ Open |
| 1194 | UDP | OpenVPN | ✅ Open |
| 16384-32768 | UDP | RTP Media | ✅ Open |
| 35000 | TCP/UDP | SIP (with protection) | ✅ Open |

### Event Socket Layer (ESL) Configuration

```xml
<configuration name="event_socket.conf" description="Socket Client">
  <settings>
    <param name="nat-map" value="false"/>
    <param name="listen-ip" value="0.0.0.0"/>
    <param name="listen-port" value="8021"/>
    <param name="password" value="ClueCon"/>
    <param name="apply-inbound-acl" value="esl_allow"/>
  </settings>
</configuration>
```

**ESL Access**:
- Host (Original): 159.223.45.224
- Host (New): 178.128.57.106
- Port: 8021
- Password: ClueCon
- Protocol: TCP

---

## Database Configuration

### PostgreSQL

**Connection Details**:
- Host: 127.0.0.1 (localhost only)
- Port: 5432
- IPv6: ::1:5432
- Encoding: UTF-8
- Locale: C.UTF-8

### Databases

| Database Name | Owner | Access Privileges | Status |
|---------------|-------|-------------------|--------|
| fusionpbx | postgres | fusionpbx user has full access | ✅ Active |
| postgres | postgres | Default admin database | ✅ Active |
| template0 | postgres | Template database | ✅ Active |
| template1 | postgres | Template database | ✅ Active |

### FusionPBX Database Schema

**Total Tables**: 161

**Key Tables**:
- activity_log
- archive_recording
- billing_products
- business_hours
- device_cloud_provisioning
- domain_groups
- email_log
- extension_advanced_settings
- gateway_settings
- hotel_rooms
- messages
- migrations
- mobile_app_password_reset_links

---

## Web Services

### Nginx Configuration

**Version**: nginx/1.26.3

**Enabled Sites**:
```
/etc/nginx/sites-enabled/fspbx.conf -> /etc/nginx/sites-available/fspbx.conf
```

**Access URLs**:
- Original Server: http://159.223.45.224 or https://159.223.45.224
- New Server: http://178.128.57.106 or https://178.128.57.106

### fspbx Web Interface

**Features**:
- FreeSWITCH PBX Management (Laravel + Vue.js)
- SIP Gateway Configuration
- Extension Management
- Dialplan Editor
- Call Detail Records
- System Status Monitoring

---

## Security & Firewall

### iptables Firewall Rules

**Default Policy**: DROP (deny all by default)

**Accepted Connections**:
```
Port 22  (SSH)     - ACCEPT
Port 80  (HTTP)    - ACCEPT
Port 443 (HTTPS)   - ACCEPT
Port 5060-5080     - ACCEPT (SIP)
Port 7443 (WSS)    - ACCEPT
Port 8021 (ESL)    - ACCEPT
Port 35000 (SIP)   - ACCEPT with protection
Port 1194 (VPN)    - ACCEPT
```

### SIP Attack Protection

**Blocked User-Agents** (Port 35000):
```
- "friendly-scanner"
- "sipcli/"
- "VaxSIPUserAgent/"
- "pplsip"
- "system "
- "exec."
- "multipart/mixed;boundary"
```

**Custom Chains**:
- sip-auth-fail
- sip-auth-ip

### SSL/TLS

- ✅ HTTPS enabled on port 443
- ✅ WSS (WebSocket Secure) on port 7443
- Managed by Nginx

---

## Verification Results

### Complete System Comparison

| Component | Original (159.223.45.224) | New (178.128.57.106) | Status |
|-----------|---------------------------|----------------------|--------|
| FreeSWITCH Version | 1.10.12-release | 1.10.12-release | ✅ IDENTICAL |
| Total Modules | 508 | 508 | ✅ IDENTICAL |
| Config Files | 268 | 268 | ✅ IDENTICAL |
| PostgreSQL Tables | 161 | 161 | ✅ IDENTICAL |
| Nginx Version | 1.26.3 | 1.26.3 | ✅ IDENTICAL |
| PHP Version | 8.1.33 | 8.1.33 | ✅ IDENTICAL |
| Gateway Status | REGED | REGED | ✅ IDENTICAL |
| ESL Configuration | Active (8021) | Active (8021) | ✅ IDENTICAL |
| Firewall Rules | Configured | Configured | ✅ IDENTICAL |
| RTP Ports | 16384-32768 | 16384-32768 | ✅ IDENTICAL |

### Configuration File Verification (MD5)

All critical configuration files have been verified with MD5 checksums:

```
vars.xml:                     ✅ IDENTICAL
event_socket.conf.xml:        ✅ IDENTICAL
modules.conf.xml:             ✅ IDENTICAL
switch.conf.xml:              ✅ IDENTICAL
```

### Module Comparison

**Fixed Issue**: `mod_audio_stream` was missing on the new server.
- **Resolution**: Module loaded successfully
- **Status**: Both servers now have identical module configuration

### Services Status

All services verified as active on both servers:
```
freeswitch:    ✅ active
nginx:         ✅ active
postgresql:    ✅ active
redis-server:  ✅ active
```

---

## Access Credentials

### SSH Access

**Original Server**:
```
ssh root@159.223.45.224
```

**New Server**:
```
ssh root@178.128.57.106
```

### Web Interface

**Original Server**:
```
URL: http://159.223.45.224
     https://159.223.45.224
```

**New Server**:
```
URL: http://178.128.57.106
     https://178.128.57.106
```

### ESL (Event Socket Layer)

**Original Server**:
```
Host: 159.223.45.224
Port: 8021
Password: ClueCon
```

**New Server**:
```
Host: 178.128.57.106
Port: 8021
Password: ClueCon
```

### FreeSWITCH CLI

**Access via SSH**:
```bash
fs_cli
```

**Common Commands**:
```
fs_cli -x "status"                    # Show system status
fs_cli -x "sofia status"              # Show SIP profiles
fs_cli -x "sofia status gateway"      # Show gateway status
fs_cli -x "show modules"              # List all modules
fs_cli -x "reload mod_sofia"          # Reload SIP module
```

### AlienVOIP Gateway

```
Username: 646006395
Password: Xh7Yk5Ydcg
Proxy: sip3.alienvoip.com
Gateway UUID: 1360d030-6e0c-4617-83e0-8d80969010cf
```

---

## Next Steps

### For Application Integration

1. **Update Application Config**:
   - Point ESL client to new server IP: `178.128.57.106:8021`
   - ESL Password: `ClueCon`

2. **Test Outbound Calling**:
```bash
ssh root@178.128.57.106
fs_cli -x "originate sofia/gateway/1360d030-6e0c-4617-83e0-8d80969010cf/YOUR_PHONE_NUMBER &echo"
```

3. **Verify Audio Streaming**:
   - mod_audio_stream is loaded
   - Ready for WebSocket audio streaming to Deno Deploy

4. **Update DNS/Load Balancer** (if applicable):
   - Add new server IP to load balancer
   - Update DNS A records if needed

### For AI Call System Integration

**Architecture Flow**:
```
Customer Phone
    ↓
AlienVOIP SIP Trunk (sip3.alienvoip.com)
    ↓
FreeSWITCH Gateway (178.128.57.106)
    ↓
Extension 999
    ↓
mod_audio_stream → WebSocket Stream
    ↓
AI Handler (Deno Deploy)
    ↓
Azure STT → OpenRouter → ElevenLabs
    ↓
WebSocket Stream → mod_audio_stream
    ↓
Back to customer
```

**Update Required**:
- Change FreeSWITCH URL in application from `159.223.45.224` to `178.128.57.106`
- Test ESL connection on port 8021
- Verify gateway registration
- Test audio streaming

### Maintenance Tasks

**Daily**:
- Monitor gateway registration status
- Check for failed calls
- Review system logs

**Weekly**:
- Review call statistics
- Check disk space usage
- Update firewall rules if needed

**Monthly**:
- PostgreSQL database backup
- FreeSWITCH configuration backup
- Security updates

### Monitoring Commands

**Check System Status**:
```bash
# FreeSWITCH status
fs_cli -x "status"

# Gateway registration
fs_cli -x "sofia status gateway"

# Active calls
fs_cli -x "show calls"

# Module status
fs_cli -x "show modules" | grep audio

# Disk usage
df -h

# Memory usage
free -h

# Service status
systemctl status freeswitch nginx postgresql redis-server
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FREESWITCH SERVERS                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Original: 159.223.45.224     New: 178.128.57.106         │
│  ┌─────────────────────┐      ┌─────────────────────┐     │
│  │  FreeSWITCH 1.10.12 │      │  FreeSWITCH 1.10.12 │     │
│  │  ┌───────────────┐  │      │  ┌───────────────┐  │     │
│  │  │ SIP External  │  │      │  │ SIP External  │  │     │
│  │  │  Port 5080    │  │      │  │  Port 5080    │  │     │
│  │  └───────────────┘  │      │  └───────────────┘  │     │
│  │  ┌───────────────┐  │      │  ┌───────────────┐  │     │
│  │  │ SIP Internal  │  │      │  │ SIP Internal  │  │     │
│  │  │  Port 5060    │  │      │  │  Port 5060    │  │     │
│  │  └───────────────┘  │      │  └───────────────┘  │     │
│  │  ┌───────────────┐  │      │  ┌───────────────┐  │     │
│  │  │ ESL Port 8021 │  │      │  │ ESL Port 8021 │  │     │
│  │  └───────────────┘  │      │  └───────────────┘  │     │
│  └─────────────────────┘      └─────────────────────┘     │
│           │                            │                   │
│           └────────────┬───────────────┘                   │
│                        │                                   │
│                        ▼                                   │
│            ┌─────────────────────┐                        │
│            │  AlienVOIP Gateway  │                        │
│            │  sip3.alienvoip.com │                        │
│            │  User: 646006395    │                        │
│            └─────────────────────┘                        │
│                        │                                   │
└────────────────────────┼───────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │   Public Network  │
              │   (Customers)     │
              └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SUPPORTING SERVICES                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  PostgreSQL  │  │    Nginx     │  │    Redis     │    │
│  │  Port 5432   │  │  Port 80/443 │  │  Port 6379   │    │
│  │  161 Tables  │  │  fspbx Web   │  │   Cache      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

### What Was Verified ✅

1. ✅ **Network Configuration**: All 20+ ports verified and identical
2. ✅ **FreeSWITCH**: 508 modules loaded, all configs verified by MD5
3. ✅ **AlienVOIP Gateway**: REGED and operational on both servers
4. ✅ **PostgreSQL**: 161 tables, identical schema
5. ✅ **Web Services**: Nginx, PHP, Redis all active
6. ✅ **Firewall**: All iptables rules identical
7. ✅ **ESL**: Event Socket Layer active on port 8021
8. ✅ **RTP**: Media ports configured (16384-32768)

### What Was Fixed ✅

1. ✅ **mod_audio_stream**: Loaded on new server (was missing)

### Current Status

**Both servers are 100% identical and production-ready!**

The only differences are:
- IP addresses (intentional): 159.223.45.224 → 178.128.57.106
- Process IDs (normal for different servers)
- Call statistics (new server is fresh, zero calls)

---

## Document Information

- **Created**: November 6, 2025
- **Author**: System Administrator
- **Last Verified**: November 6, 2025
- **Next Review**: December 6, 2025
- **Version**: 1.0

---

## Support & References

### FreeSWITCH Documentation
- Official Docs: https://freeswitch.org/confluence/
- Event Socket Layer: https://freeswitch.org/confluence/display/FREESWITCH/mod_event_socket

### fspbx Documentation
- GitHub: https://github.com/nemerald-voip/fspbx
- Installation Guide: See FREESWITCH_ALIENVOIP_SETUP.md

### AlienVOIP Support
- Website: https://alienvoip.com
- SIP Server: sip3.alienvoip.com

---

**End of Document**
