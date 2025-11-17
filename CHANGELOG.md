# Changelog

All notable changes to NOMP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2025-11-17

### Added
- ✅ IndiCoin (IND) support - SHA-256 cryptocurrency with 5% annual inflation
- ✅ IndiCoin coin configuration (`config/coins/indicoin.json`)
- ✅ IndiCoin pool configuration template (`config/pools/indicoin.example.json`)
- ✅ Comprehensive IndiCoin setup guide (`docs/INDICOIN_SETUP.md`)
- ✅ Updated documentation to reflect 6+ supported coins

### Technical Details
- **Algorithm**: SHA-256 (Bitcoin-compatible)
- **Block Time**: 600 seconds (10 minutes)
- **Block Reward**: 50 IND per block
- **RPC Port**: 5534
- **P2P Port**: 5533
- **Stratum Ports**: 3032 (low), 3256 (medium), 3512 (high difficulty)

## [2.0.0] - 2025-11-17

### 🎉 Complete Modernization Release

#### Added
- ✅ Modern ES Module syntax (import/export)
- ✅ Full async/await implementation throughout codebase
- ✅ Enterprise-grade Winston logging with daily rotation
- ✅ Modern Redis client (@redis/client v1.5+) with reconnection logic
- ✅ MySQL2 with connection pooling and transactions
- ✅ Comprehensive input validation using Joi schemas
- ✅ REST API with Express 4.x
- ✅ Security middleware (Helmet, CORS, Rate Limiting)
- ✅ Health check endpoints for monitoring
- ✅ Graceful shutdown handling
- ✅ Event-driven architecture
- ✅ Modular service layer architecture
- ✅ Support for 6+ coins (Bitcoin, Litecoin, Dogecoin, Ethereum, Monero, IndiCoin)
- ✅ API authentication with Bearer tokens
- ✅ Comprehensive API documentation
- ✅ Security best practices documentation
- ✅ Production deployment guides

#### Changed
- 🔄 Upgraded from Node.js v0.10 to v20+ LTS
- 🔄 Replaced callback-based code with async/await
- 🔄 Modernized folder structure (src/, config/, docs/)
- 🔄 Replaced old redis module with @redis/client
- 🔄 Updated all dependencies to latest stable versions
- 🔄 Improved error handling and logging
- 🔄 Enhanced security features
- 🔄 Refactored Stratum server with modern patterns
- 🔄 Reimplemented share processing with better performance
- 🔄 Modernized payment processing logic

#### Removed
- ❌ Deprecated callback-based patterns
- ❌ Old stratum-pool dependency (rewritten)
- ❌ Legacy configuration format
- ❌ Outdated dependencies
- ❌ Insecure practices

#### Security
- 🔒 Added rate limiting to prevent abuse
- 🔒 Implemented IP banning for malicious miners
- 🔒 Added authentication for admin endpoints
- 🔒 Helmet.js for HTTP security headers
- 🔒 Input validation to prevent injection attacks
- 🔒 Secure password handling
- 🔒 CORS configuration
- 🔒 Connection limits and timeouts

#### Performance
- ⚡ Improved Redis connection pooling
- ⚡ Optimized share processing
- ⚡ Better memory management
- ⚡ Efficient event handling
- ⚡ Reduced database queries

#### Developer Experience
- 🛠 Clear project structure
- 🛠 Comprehensive documentation
- 🛠 Example configurations
- 🛠 Development mode with auto-reload
- 🛠 Better error messages
- 🛠 Logging for debugging

---

## [0.0.4] - Original NOMP

### Original Features
- Basic stratum server
- Share processing
- Payment processing
- Multi-pool support
- MPOS compatibility
- Basic web frontend

---

## Migration Guide from v0.x to v2.0

### Breaking Changes
1. **Node.js Version**: Minimum version is now 20.0.0
2. **Configuration Format**: New JSON structure
3. **Dependencies**: All dependencies updated
4. **API**: New REST API endpoints
5. **File Structure**: Completely reorganized

### Migration Steps
1. Backup your current installation
2. Update Node.js to v20+
3. Install NOMP v2 in new directory
4. Migrate configurations to new format
5. Test with single pool first
6. Gradually migrate all pools

### Configuration Migration
- Old `config.json` → Multiple files in `config/`
- Pool configs moved to `config/pools/`
- Coin configs moved to `config/coins/`
- Environment variables in `.env`

---

## Future Roadmap

### v2.1.0 (Planned)
- [ ] WebSocket support for real-time updates
- [ ] Enhanced statistics and charts
- [ ] Dashboard UI improvements
- [ ] More coin support
- [ ] Pool switching improvements

### v2.2.0 (Planned)
- [ ] TypeScript migration
- [ ] GraphQL API
- [ ] Advanced monitoring
- [ ] Performance optimizations
- [ ] Enhanced security features

### v3.0.0 (Future)
- [ ] Microservices architecture
- [ ] Kubernetes support
- [ ] Cloud-native deployment
- [ ] Advanced analytics
- [ ] Machine learning for fraud detection

---

**For more information, see [README.md](README.md)**
