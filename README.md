# NOMP v2 - Modern Mining Pool
## Enterprise-Grade Cryptocurrency Mining Pool

[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-GPL--2.0-blue)](LICENSE)

**Fully modernized mining pool software with enterprise-grade features**

---

## 🚀 What's New in v2

### ✅ Complete Modernization
- **Node.js 20+** - Latest LTS with modern features
- **ES Modules** - Modern JavaScript with import/export
- **Async/Await** - No more callback hell
- **TypeScript Ready** - Structured types support

### ✅ New Architecture
- **Modular Design** - Clean separation of concerns
- **Enterprise Structure** - Professional folder organization
- **Service Layer** - Business logic abstraction
- **Event-Driven** - Scalable event architecture

### ✅ Enhanced Security
- **Helmet** - HTTP security headers
- **Rate Limiting** - DDoS protection
- **Input Validation** - Joi schema validation
- **Modern Auth** - Bearer token authentication
- **IP Banning** - Automatic bad actor blocking

### ✅ Advanced Features
- **Winston Logging** - Enterprise-grade logging with rotation
- **Redis 7+ Client** - Modern Redis with connection pooling
- **MySQL2** - Prepared statements and transactions
- **Graceful Shutdown** - Zero-downtime deployments
- **Health Checks** - Monitoring-ready endpoints
- **API Versioning** - Future-proof REST API

### ✅ Multi-Coin Support
Ready for 6+ coins out of the box:
- Bitcoin (SHA256)
- Litecoin (Scrypt)
- Dogecoin (Scrypt)
- Ethereum (Ethash)
- Monero (RandomX)
- IndiCoin (SHA256)

---

## 📋 Requirements

- **Node.js** ≥ 20.0.0 LTS
- **Redis** ≥ 7.0
- **MySQL** ≥ 8.0 (optional, for MPOS mode)
- **Coin Daemon(s)** - Latest version from source
- **Linux/Unix** - Ubuntu 22.04+ recommended

---

## 🔧 Installation

### 1. Clone Repository
```bash
git clone https://github.com/jitenkr2030/node-open-mining-portal.git nomp-v2
cd nomp-v2/nomp-modernized
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
nano .env
```

Edit `.env` with your settings:
```env
NODE_ENV=production
PORT=8080
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
ADMIN_PASSWORD=your-secure-password
```

### 4. Configure Pools
```bash
cd config/pools
cp bitcoin.example.json bitcoin.json
nano bitcoin.json
```

Update with your:
- Wallet address
- RPC credentials
- Fee recipients
- Port configurations

### 5. Start the Pool
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

---

## 📁 Project Structure

```
nomp-modernized/
├── src/
│   ├── core/              # Core business logic
│   │   ├── stratum/       # Stratum server implementation
│   │   ├── pool/          # Pool management
│   │   └── coin/          # Coin-specific handlers
│   ├── services/          # Business services
│   │   ├── payment/       # Payment processing
│   │   ├── share/         # Share validation & storage
│   │   └── stats/         # Statistics calculation
│   ├── api/               # REST API
│   │   ├── routes/        # API endpoints
│   │   ├── middleware/    # Express middleware
│   │   └── controllers/   # Request handlers
│   ├── database/          # Database layer
│   │   ├── redis/         # Redis client
│   │   └── mysql/         # MySQL client
│   ├── config/            # Configuration management
│   ├── utils/             # Utility functions
│   └── index.js           # Application entry point
├── config/                # Configuration files
│   ├── pools/             # Pool configurations
│   └── coins/             # Coin definitions
├── logs/                  # Application logs
├── tests/                 # Test suites
└── docs/                  # Documentation
```

---

## 🔌 API Endpoints

### Public Endpoints

#### Get All Pools
```
GET /api/pools
```

#### Get Pool Details
```
GET /api/pools/:poolName
```

#### Get Worker Statistics
```
GET /api/workers/:address?pool=poolName
```

#### Get Worker Payments
```
GET /api/workers/:address/payments?pool=poolName
```

#### Get Global Statistics
```
GET /api/stats
```

#### Health Check
```
GET /health
```

### Admin Endpoints
Requires `Authorization: Bearer <admin_password>` header

#### Restart Pool
```
POST /api/admin/pools/:poolName/restart
```

#### Stop Pool
```
POST /api/admin/pools/:poolName/stop
```

#### System Information
```
GET /api/admin/system
```

---

## ⚙️ Configuration

### Pool Configuration
Located in `config/pools/*.json`

```json
{
  "enabled": true,
  "name": "bitcoin",
  "coin": "bitcoin.json",
  "address": "your-wallet-address",
  "rewardRecipients": {
    "fee-address": 1.5
  },
  "paymentProcessing": {
    "enabled": true,
    "interval": 30,
    "minimumPayment": 0.01
  },
  "ports": {
    "3333": {
      "diff": 32,
      "varDiff": {
        "minDiff": 8,
        "maxDiff": 512
      }
    }
  }
}
```

### Coin Configuration
Located in `config/coins/*.json`

```json
{
  "name": "Bitcoin",
  "symbol": "BTC",
  "algorithm": "sha256",
  "peerMagic": "f9beb4d9",
  "blockTime": 600,
  "blockReward": 6.25
}
```

---

## 🔒 Security Features

### 1. Rate Limiting
Configurable API rate limits prevent abuse:
```env
API_RATE_LIMIT=100
API_RATE_WINDOW=15
```

### 2. IP Banning
Automatic banning of malicious miners:
```json
"banning": {
  "enabled": true,
  "time": 600,
  "invalidPercent": 50,
  "checkThreshold": 500
}
```

### 3. Authentication
Admin endpoints require bearer token authentication.

### 4. Input Validation
All inputs validated with Joi schemas.

### 5. HTTP Security
Helmet.js provides security headers.

---

## 📊 Monitoring

### Logs
Logs are automatically rotated daily:
- `logs/app-YYYY-MM-DD.log` - General logs
- `logs/error-YYYY-MM-DD.log` - Error logs
- `logs/stratum-YYYY-MM-DD.log` - Stratum activity
- `logs/api-YYYY-MM-DD.log` - API requests

### Health Check
```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": 1700000000000,
  "uptime": 3600,
  "version": "2.0.0"
}
```

---

## 🚀 Production Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start src/index.js --name nomp-v2
pm2 save
pm2 startup
```

### Using Systemd
Create `/etc/systemd/system/nomp.service`:
```ini
[Unit]
Description=NOMP v2 Mining Pool
After=network.target redis.service

[Service]
Type=simple
User=nomp
WorkingDirectory=/opt/nomp-v2
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable nomp
sudo systemctl start nomp
```

---

## 🔧 Maintenance

### Update Dependencies
```bash
npm update
```

### Check for Security Issues
```bash
npm audit
npm audit fix
```

### Clean Old Logs
```bash
find logs/ -name "*.log" -mtime +30 -delete
```

### Backup Redis Data
```bash
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backup/redis-$(date +%Y%m%d).rdb
```

---

## 🐛 Troubleshooting

### Pool Won't Start
1. Check Node.js version: `node --version` (must be ≥20)
2. Verify Redis is running: `redis-cli ping`
3. Check configuration files for syntax errors
4. Review logs in `logs/` directory

### No Shares Accepted
1. Verify daemon RPC credentials
2. Check daemon is synced: `bitcoin-cli getblockcount`
3. Ensure pool address is valid
4. Review stratum logs for errors

### Payment Issues
1. Verify wallet has sufficient balance
2. Check payment processing is enabled
3. Review payment logs
4. Ensure minimum payment threshold is met

---

## 📝 License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.

---

## 👥 Credits

### NOMP v2 (2025)
- **MiniMax Agent** - Complete modernization and refactoring

### Original NOMP
- **Matthew Little** - Original NOMP creator
- **zone117x** - node-stratum-pool module
- [See full credits in original repo](https://github.com/zone117x/node-open-mining-portal#credits)

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📞 Support

- **Issues**: GitHub Issues
- **Documentation**: `/docs` directory
- **Community**: TBD

---

## 🔄 Changelog

### v2.0.0 (2025)
- ✅ Complete rewrite in modern JavaScript (ES modules)
- ✅ Node.js 20+ support
- ✅ Async/await throughout
- ✅ Enterprise logging (Winston)
- ✅ Modern Redis client
- ✅ Enhanced security
- ✅ REST API with versioning
- ✅ Improved error handling
- ✅ Graceful shutdown
- ✅ Health monitoring
- ✅ Multi-coin ready (5+ coins)

---

**Built with ❤️ for the cryptocurrency mining community**
