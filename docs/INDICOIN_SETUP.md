# IndiCoin Pool Setup Guide

## Overview

IndiCoin is a decentralized digital currency with controlled inflation (5% annual), built on Bitcoin Core with SHA-256 Proof-of-Work mining. This guide will help you set up an IndiCoin mining pool using the modernized NOMP v2 system.

## IndiCoin Specifications

- **Algorithm**: SHA-256 (Bitcoin-compatible)
- **Block Time**: ~10 minutes (600 seconds)
- **Initial Block Reward**: 50 IND per block
- **Inflation Rate**: 5% annually
- **Network Port**: 5533
- **RPC Port**: 5534
- **Genesis Block**: `10e870f6ff26921e54f732934d368e495a49e9643d33a6854fe398fa803fabed`
- **Confirmations Required**: 120 blocks

---

## Prerequisites

### 1. IndiCoin Daemon Setup

First, you need to install and configure the IndiCoin daemon on your pool server.

#### Install IndiCoin

```bash
# Clone IndiCoin repository
git clone https://github.com/jitenkr2030/IndiCoin.git
cd IndiCoin

# Install dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install build-essential pkg-config libc6-dev m4 g++-multilib \
    autoconf libtool ncurses-dev unzip git python3 python3-zmq zlib1g-dev \
    wget curl bsdmainutils automake cmake

# Build IndiCoin
cmake -B build -DENABLE_IPC=OFF
cmake --build build -j$(nproc)

# Install system-wide
sudo cmake --build build --target install
```

#### Configure IndiCoin Daemon

Create configuration file at `~/.indiCoin/indiCoin.conf`:

```ini
# Basic settings
rpcuser=indicoin_pool_rpc
rpcpassword=YOUR_SECURE_RPC_PASSWORD_HERE
rpcallowip=127.0.0.1
rpcport=5534

# Network settings
listen=1
server=1
port=5533
daemon=1

# Mining pool settings
txindex=1
addressindex=1
timestampindex=1
spentindex=1

# Peers (seed nodes)
addnode=seed1.indicoin.money
addnode=seed2.indicoin.money
addnode=seed3.indicoin.money

# Performance
dbcache=4000
maxconnections=125
maxmempool=300

# Wallet
wallet=pool_wallet
```

#### Start IndiCoin Daemon

```bash
# Start daemon
indicoind -daemon

# Wait for blockchain sync
indicoin-cli getblockchaininfo

# Create pool wallet address
indicoin-cli getnewaddress "pool_main"

# Example output: IND1qy9x4k8m2p3n5r7s8t9u0v1w2x3y4z5
```

---

## Pool Configuration

### 1. Configure IndiCoin Coin Settings

The coin configuration is already created at `config/coins/indicoin.json`:

```json
{
  "name": "IndiCoin",
  "symbol": "IND",
  "algorithm": "sha256",
  "blockTime": 600,
  "txfee": 0.0001,
  "coinbaseValue": 5000000000,
  "mposDiffMultiplier": 256,
  "reward": "POW",
  "confirmations": 120
}
```

### 2. Configure Pool Settings

Copy the example configuration and customize:

```bash
cd /path/to/nomp-modernized/config/pools
cp indicoin.example.json indicoin.json
nano indicoin.json
```

**Key Settings to Update:**

```json
{
  "enabled": true,
  "coin": "indicoin",
  "address": "YOUR_INDICOIN_WALLET_ADDRESS",
  
  "rewardRecipients": {
    "YOUR_INDICOIN_WALLET_ADDRESS": 1.5
  },

  "paymentProcessing": {
    "enabled": true,
    "paymentMode": "prop",
    "paymentInterval": 600,
    "minimumPayment": 0.5,
    "maxBlocksPerPayment": 10,
    "daemon": {
      "host": "127.0.0.1",
      "port": 5534,
      "user": "indicoin_pool_rpc",
      "password": "YOUR_SECURE_RPC_PASSWORD_HERE"
    }
  },

  "ports": {
    "3032": {
      "diff": 32,
      "varDiff": {
        "minDiff": 8,
        "maxDiff": 512,
        "targetTime": 15,
        "retargetTime": 90,
        "variancePercent": 30,
        "maxJump": 100
      }
    },
    "3256": {
      "diff": 256,
      "varDiff": {
        "minDiff": 64,
        "maxDiff": 2048,
        "targetTime": 15,
        "retargetTime": 90,
        "variancePercent": 30,
        "maxJump": 100
      }
    }
  },

  "daemons": [
    {
      "host": "127.0.0.1",
      "port": 5534,
      "user": "indicoin_pool_rpc",
      "password": "YOUR_SECURE_RPC_PASSWORD_HERE"
    }
  ],

  "p2p": {
    "enabled": true,
    "host": "127.0.0.1",
    "port": 5533,
    "disableTransactions": true
  }
}
```

### 3. Environment Configuration

Update your `.env` file:

```env
NODE_ENV=production
PORT=8080

# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Database (for MPOS mode)
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=pool_admin
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=indicoin_pool

# API Security
API_TOKEN=your_secure_api_token_here
ADMIN_PASSWORD=your_admin_password

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

---

## Starting the Pool

### 1. Install Pool Dependencies

```bash
cd /path/to/nomp-modernized
npm install
```

### 2. Initialize Database (Optional - for MPOS mode)

```bash
node scripts/setup.js
```

### 3. Start the Pool

```bash
# Development mode
npm run dev

# Production mode
npm start

# Or with PM2 (recommended)
pm2 start src/index.js --name "indicoin-pool"
pm2 save
pm2 startup
```

### 4. Verify Pool is Running

```bash
# Check pool status
curl http://localhost:8080/api/pools

# Check IndiCoin pool specifically
curl http://localhost:8080/api/pools/indicoin

# Check pool health
curl http://localhost:8080/health
```

---

## Miner Configuration

Miners can connect to your pool using any SHA-256 compatible mining software.

### Example: CGMiner

```bash
cgminer -o stratum+tcp://your-pool-domain.com:3032 \
        -u YOUR_INDICOIN_ADDRESS.worker1 \
        -p x
```

### Example: BFGMiner

```bash
bfgminer -o stratum+tcp://your-pool-domain.com:3032 \
         -u YOUR_INDICOIN_ADDRESS.worker1 \
         -p x
```

### Example: Nice Hash

```bash
# Use port 3256 for higher difficulty
-o stratum+tcp://your-pool-domain.com:3256
-u YOUR_INDICOIN_ADDRESS.nicehash
-p x
```

### Mining Pool Ports

- **3032**: Low difficulty (8-512) - For small miners, CPUs
- **3256**: Medium difficulty (64-2048) - For GPU miners
- **3512**: High difficulty (128-4096) - For ASIC miners, NiceHash

---

## Monitoring and Management

### View Pool Statistics

```bash
# Pool statistics
curl http://localhost:8080/api/stats

# Worker statistics
curl http://localhost:8080/api/workers/YOUR_INDICOIN_ADDRESS

# Block statistics
curl http://localhost:8080/api/pools/indicoin/blocks
```

### Admin Operations (Requires API Token)

```bash
# Restart pool
curl -X POST http://localhost:8080/api/admin/pools/indicoin/restart \
     -H "Authorization: Bearer YOUR_API_TOKEN"

# Trigger manual payment
curl -X POST http://localhost:8080/api/admin/pools/indicoin/payments \
     -H "Authorization: Bearer YOUR_API_TOKEN"
```

### View Logs

```bash
# Pool logs
tail -f logs/pool.log

# Error logs
tail -f logs/error.log

# Payment logs
tail -f logs/payments.log

# With PM2
pm2 logs indicoin-pool
```

---

## Payment Configuration

### PROP (Proportional) Payment System

The default payment mode distributes rewards proportionally based on shares submitted.

**Configuration:**

```json
"paymentProcessing": {
  "enabled": true,
  "paymentMode": "prop",
  "paymentInterval": 600,
  "minimumPayment": 0.5,
  "maxBlocksPerPayment": 10
}
```

**Settings Explained:**
- `paymentInterval`: Process payments every 600 seconds (10 minutes)
- `minimumPayment`: Minimum 0.5 IND before payment is sent
- `maxBlocksPerPayment`: Process up to 10 blocks per payment cycle

### Fee Configuration

Pool fees are set in the `rewardRecipients` section:

```json
"rewardRecipients": {
  "YOUR_POOL_FEE_ADDRESS": 1.5
}
```

This sets a 1.5% pool fee. The remaining 98.5% is distributed to miners.

---

## Troubleshooting

### Pool Won't Start

**Check IndiCoin daemon connection:**
```bash
indicoin-cli getblockchaininfo
```

**Verify RPC credentials:**
```bash
curl --user indicoin_pool_rpc:YOUR_PASSWORD \
     --data-binary '{"jsonrpc":"1.0","id":"test","method":"getblockchaininfo","params":[]}' \
     -H 'content-type: text/plain;' \
     http://127.0.0.1:5534/
```

### No Shares Being Accepted

**Check miner connection:**
- Verify pool address and port
- Ensure firewall allows incoming connections on stratum ports
- Check worker address format: `ADDRESS.workername`

**Check difficulty:**
- Start with low difficulty port (3032) for testing
- Monitor share submission rate in logs

### Payments Not Processing

**Check daemon wallet:**
```bash
# Verify wallet balance
indicoin-cli getbalance

# Check pending transactions
indicoin-cli listtransactions "*" 100
```

**Check payment logs:**
```bash
tail -f logs/payments.log
```

**Manually trigger payment:**
```bash
curl -X POST http://localhost:8080/api/admin/pools/indicoin/payments \
     -H "Authorization: Bearer YOUR_API_TOKEN"
```

---

## Security Best Practices

1. **Firewall Configuration**
   ```bash
   # Allow only necessary ports
   sudo ufw allow 3032/tcp   # Stratum low diff
   sudo ufw allow 3256/tcp   # Stratum medium diff
   sudo ufw allow 8080/tcp   # API (or use reverse proxy)
   sudo ufw allow 5533/tcp   # IndiCoin P2P
   sudo ufw enable
   ```

2. **Use Strong Passwords**
   - RPC password: 32+ characters
   - API token: 64+ characters
   - MySQL password: 20+ characters

3. **Secure RPC Access**
   - Only allow localhost connections
   - Use firewall to block external RPC access
   - Never expose port 5534 to the internet

4. **Regular Backups**
   ```bash
   # Backup wallet
   indicoin-cli backupwallet /backup/path/wallet_backup.dat
   
   # Backup pool database
   mysqldump -u pool_admin -p indicoin_pool > pool_backup.sql
   ```

5. **Keep Software Updated**
   ```bash
   # Update IndiCoin daemon
   cd IndiCoin
   git pull
   cmake --build build -j$(nproc)
   sudo cmake --build build --target install
   
   # Update pool software
   cd nomp-modernized
   git pull
   npm install
   pm2 restart indicoin-pool
   ```

---

## Performance Tuning

### Redis Optimization

```bash
# Edit /etc/redis/redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
```

### IndiCoin Daemon Optimization

```ini
# In indiCoin.conf
dbcache=8000          # Increase if you have RAM
maxconnections=200    # Increase for high traffic
maxmempool=500        # Larger mempool for busy periods
```

### System Limits

```bash
# Edit /etc/security/limits.conf
* soft nofile 65536
* hard nofile 65536

# Verify
ulimit -n
```

---

## Resources

- **IndiCoin Official**: https://indicoin.money
- **IndiCoin GitHub**: https://github.com/jitenkr2030/IndiCoin
- **Block Explorer**: https://explorer.indicoin.money
- **Community Discord**: https://discord.gg/indicoin
- **Mining Guide**: https://docs.indicoin.money/mining

---

## Support

For pool-specific issues:
- Check logs: `tail -f logs/*.log`
- Review configuration files
- Test RPC connectivity
- Monitor system resources

For IndiCoin-specific issues:
- IndiCoin Documentation: https://docs.indicoin.money
- Community Support: Discord/Telegram
- GitHub Issues: https://github.com/jitenkr2030/IndiCoin/issues

---

**Happy Mining! 🚀**
