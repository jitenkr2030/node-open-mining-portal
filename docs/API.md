# NOMP v2 - API Documentation

## Base URL
```
http://your-pool.com:8080/api
```

## Authentication

Admin endpoints require Bearer token authentication:
```bash
Authorization: Bearer <your-admin-password>
```

---

## Public Endpoints

### 1. Health Check
Check system status

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": 1700000000000,
  "uptime": 3600,
  "version": "2.0.0"
}
```

---

### 2. List All Pools
Get list of all configured pools

**Endpoint**: `GET /api/pools`

**Response**:
```json
{
  "success": true,
  "pools": [
    {
      "name": "bitcoin",
      "coin": "Bitcoin",
      "algorithm": "sha256",
      "isRunning": true,
      "workers": 42,
      "ports": ["3333", "3334"]
    }
  ]
}
```

---

### 3. Get Pool Details
Get detailed information about a specific pool

**Endpoint**: `GET /api/pools/:poolName`

**Example**: `GET /api/pools/bitcoin`

**Response**:
```json
{
  "success": true,
  "pool": {
    "pool": "bitcoin",
    "coin": "Bitcoin",
    "algorithm": "sha256",
    "isRunning": true,
    "uptime": 86400000,
    "workers": {
      "connected": 42,
      "list": [...]
    },
    "blocks": {
      "pending": 2,
      "confirmed": 15,
      "orphaned": 1
    },
    "round": {
      "height": 850000,
      "duration": 3600000,
      "totalShares": 1000000
    },
    "ports": {
      "3333": {
        "difficulty": 32,
        "connections": 35
      }
    }
  }
}
```

---

### 4. Get Global Statistics
Get statistics across all pools

**Endpoint**: `GET /api/stats`

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalPools": 3,
    "totalWorkers": 156,
    "totalHashrate": 1500000000,
    "pools": [
      {
        "name": "bitcoin",
        "workers": 42,
        "blocks": {
          "pending": 2,
          "confirmed": 15
        }
      }
    ],
    "timestamp": 1700000000000
  }
}
```

---

### 5. Get Pool Statistics
Get detailed statistics for a specific pool

**Endpoint**: `GET /api/stats/:poolName`

**Example**: `GET /api/stats/bitcoin`

**Response**: Same as "Get Pool Details"

---

### 6. Get Worker Statistics
Get statistics for a specific worker address

**Endpoint**: `GET /api/workers/:address`

**Query Parameters**:
- `pool` (optional) - Get stats for specific pool

**Example**: `GET /api/workers/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?pool=bitcoin`

**Response**:
```json
{
  "success": true,
  "worker": {
    "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "pool": "bitcoin",
    "shares": {
      "worker": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "validShares": 1000,
      "invalidShares": 5,
      "lastShare": 1700000000000,
      "hashrate": 100000000,
      "efficiency": "99.50"
    },
    "balance": 0.05,
    "connected": true
  }
}
```

---

### 7. Get Worker Payment History
Get payment history for a worker

**Endpoint**: `GET /api/workers/:address/payments`

**Query Parameters**:
- `pool` (required) - Pool name
- `limit` (optional, default: 10) - Number of payments to return

**Example**: `GET /api/workers/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa/payments?pool=bitcoin&limit=5`

**Response**:
```json
{
  "success": true,
  "payments": [
    {
      "txid": "abc123...",
      "timestamp": 1700000000000,
      "amount": 0.05
    }
  ]
}
```

---

## Admin Endpoints

All admin endpoints require authentication header:
```
Authorization: Bearer <admin-password>
```

### 1. Restart Pool
Restart a specific pool

**Endpoint**: `POST /api/admin/pools/:poolName/restart`

**Example**: `POST /api/admin/pools/bitcoin/restart`

**Response**:
```json
{
  "success": true,
  "message": "Pool bitcoin restarted"
}
```

---

### 2. Stop Pool
Stop a specific pool

**Endpoint**: `POST /api/admin/pools/:poolName/stop`

**Example**: `POST /api/admin/pools/bitcoin/stop`

**Response**:
```json
{
  "success": true,
  "message": "Pool bitcoin stopped"
}
```

---

### 3. Get System Information
Get system resource information

**Endpoint**: `GET /api/admin/system`

**Response**:
```json
{
  "success": true,
  "system": {
    "platform": "linux",
    "nodeVersion": "v20.9.0",
    "uptime": 86400,
    "memory": {
      "rss": 123456789,
      "heapTotal": 98765432,
      "heapUsed": 87654321
    },
    "cpu": {
      "user": 1000000,
      "system": 500000
    }
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing authentication)
- `403` - Forbidden (invalid credentials)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Limit**: 100 requests per window (configurable)
- **Window**: 15 minutes (configurable)

When rate limit is exceeded:
```json
{
  "error": "Too many requests, please try again later"
}
```

---

## Example Usage

### cURL Examples

**Get Pool Statistics**:
```bash
curl http://localhost:8080/api/pools/bitcoin
```

**Get Worker Stats**:
```bash
curl http://localhost:8080/api/workers/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?pool=bitcoin
```

**Restart Pool (Admin)**:
```bash
curl -X POST \
  -H "Authorization: Bearer your-admin-password" \
  http://localhost:8080/api/admin/pools/bitcoin/restart
```

### JavaScript Examples

**Fetch Pool Stats**:
```javascript
const response = await fetch('http://localhost:8080/api/pools/bitcoin');
const data = await response.json();
console.log(data.pool);
```

**Admin Request**:
```javascript
const response = await fetch('http://localhost:8080/api/admin/system', {
  headers: {
    'Authorization': 'Bearer your-admin-password'
  }
});
const data = await response.json();
console.log(data.system);
```

---

## WebSocket Support (Future)

WebSocket support for real-time updates is planned for a future release.

---

**For more information, see the main [README.md](../README.md)**
