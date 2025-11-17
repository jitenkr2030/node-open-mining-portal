import net from 'net';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

/**
 * Modern Stratum Server Implementation
 * Full async/await, proper error handling, and security features
 */
class StratumServer extends EventEmitter {
  constructor(options) {
    super();
    
    this.options = {
      port: options.port || 3333,
      difficulty: options.difficulty || 32,
      varDiff: options.varDiff || null,
      maxConnections: options.maxConnections || 10000,
      connectionTimeout: options.connectionTimeout || 600,
      ...options
    };

    this.server = null;
    this.clients = new Map();
    this.bannedIPs = new Map();
    this.connectionCount = 0;
    this.isRunning = false;
  }

  /**
   * Start the Stratum server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = net.createServer((socket) => {
          this.handleConnection(socket);
        });

        this.server.on('error', (error) => {
          logger.error('Stratum server error:', error);
          this.emit('error', error);
          reject(error);
        });

        this.server.on('listening', () => {
          this.isRunning = true;
          logger.stratum(`Stratum server listening on port ${this.options.port}`, {
            port: this.options.port,
            difficulty: this.options.difficulty
          });
          this.emit('started');
          resolve();
        });

        this.server.listen(this.options.port, this.options.host || '0.0.0.0');

        // Start cleanup interval for banned IPs
        this.startBanCleanup();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the Stratum server
   */
  async stop() {
    return new Promise((resolve) => {
      if (!this.server || !this.isRunning) {
        resolve();
        return;
      }

      // Disconnect all clients
      for (const [clientId, client] of this.clients) {
        client.socket.end();
      }

      this.server.close(() => {
        this.isRunning = false;
        logger.stratum(`Stratum server on port ${this.options.port} stopped`);
        this.emit('stopped');
        resolve();
      });
    });
  }

  /**
   * Handle new client connection
   */
  handleConnection(socket) {
    const clientId = uuidv4();
    const clientIP = socket.remoteAddress;

    // Check if IP is banned
    if (this.isIPBanned(clientIP)) {
      logger.warn(`Rejected connection from banned IP: ${clientIP}`);
      socket.end();
      return;
    }

    // Check max connections
    if (this.connectionCount >= this.options.maxConnections) {
      logger.warn(`Max connections reached, rejecting ${clientIP}`);
      socket.end();
      return;
    }

    const client = {
      id: clientId,
      socket,
      ip: clientIP,
      port: socket.remotePort,
      connectedAt: Date.now(),
      authorized: false,
      worker: null,
      difficulty: this.options.difficulty,
      lastActivity: Date.now(),
      shares: {
        valid: 0,
        invalid: 0
      },
      varDiff: this.options.varDiff ? { ...this.options.varDiff } : null,
      subscriptionId: null
    };

    this.clients.set(clientId, client);
    this.connectionCount++;

    logger.stratum(`New connection from ${clientIP}`, {
      clientId,
      totalConnections: this.connectionCount
    });

    // Set up socket handlers
    this.setupSocketHandlers(client);

    // Emit connection event
    this.emit('client.connected', client);

    // Start timeout checker
    this.startClientTimeout(client);
  }

  /**
   * Setup socket event handlers
   */
  setupSocketHandlers(client) {
    let dataBuffer = '';

    client.socket.setEncoding('utf8');
    client.socket.setKeepAlive(true);
    client.socket.setNoDelay(true);

    client.socket.on('data', async (data) => {
      client.lastActivity = Date.now();
      dataBuffer += data;

      // Handle multiple messages in buffer
      let messages = dataBuffer.split('\n');
      dataBuffer = messages.pop(); // Keep incomplete message

      for (const message of messages) {
        if (message.trim()) {
          try {
            await this.handleMessage(client, message);
          } catch (error) {
            logger.error('Error handling stratum message:', {
              clientId: client.id,
              error: error.message
            });
          }
        }
      }
    });

    client.socket.on('error', (error) => {
      logger.error('Client socket error:', {
        clientId: client.id,
        ip: client.ip,
        error: error.message
      });
      this.disconnectClient(client.id);
    });

    client.socket.on('close', () => {
      logger.stratum(`Client disconnected: ${client.ip}`, {
        clientId: client.id,
        duration: Date.now() - client.connectedAt
      });
      this.disconnectClient(client.id);
    });
  }

  /**
   * Handle incoming Stratum message
   */
  async handleMessage(client, message) {
    let data;
    try {
      data = JSON.parse(message);
    } catch (error) {
      logger.warn('Invalid JSON from client:', {
        clientId: client.id,
        message: message.substring(0, 100)
      });
      this.sendError(client, null, 'Invalid JSON', -32700);
      return;
    }

    if (!data.method && !data.result && !data.error) {
      this.sendError(client, data.id, 'Invalid message format', -32600);
      return;
    }

    // Handle method calls
    if (data.method) {
      switch (data.method) {
        case 'mining.subscribe':
          await this.handleSubscribe(client, data);
          break;
        case 'mining.authorize':
          await this.handleAuthorize(client, data);
          break;
        case 'mining.submit':
          await this.handleSubmit(client, data);
          break;
        case 'mining.get_transactions':
          await this.handleGetTransactions(client, data);
          break;
        default:
          this.sendError(client, data.id, 'Unknown method', -32601);
      }
    }
  }

  /**
   * Handle mining.subscribe
   */
  async handleSubscribe(client, data) {
    client.subscriptionId = uuidv4();
    
    const response = {
      id: data.id,
      result: [
        [
          ['mining.set_difficulty', client.subscriptionId],
          ['mining.notify', client.subscriptionId]
        ],
        client.subscriptionId,
        8 // ExtraNonce2 size
      ],
      error: null
    };

    this.sendMessage(client, response);
    this.emit('client.subscribed', client);
    
    logger.stratum('Client subscribed', {
      clientId: client.id,
      subscriptionId: client.subscriptionId
    });
  }

  /**
   * Handle mining.authorize
   */
  async handleAuthorize(client, data) {
    const [workerName, password] = data.params || [];

    if (!workerName) {
      this.sendError(client, data.id, 'Worker name required', 24);
      return;
    }

    // Validate worker name (address validation)
    const isValid = await this.validateWorker(workerName, password);

    if (!isValid) {
      this.sendError(client, data.id, 'Invalid worker credentials', 24);
      this.disconnectClient(client.id);
      return;
    }

    client.authorized = true;
    client.worker = workerName;

    this.sendMessage(client, {
      id: data.id,
      result: true,
      error: null
    });

    // Send initial difficulty
    this.sendDifficulty(client);

    this.emit('client.authorized', client);
    
    logger.stratum('Client authorized', {
      clientId: client.id,
      worker: workerName
    });
  }

  /**
   * Handle mining.submit (share submission)
   */
  async handleSubmit(client, data) {
    if (!client.authorized) {
      this.sendError(client, data.id, 'Unauthorized worker', 24);
      return;
    }

    const [workerName, jobId, extraNonce2, nTime, nonce] = data.params || [];

    if (!jobId || !extraNonce2 || !nTime || !nonce) {
      this.sendError(client, data.id, 'Invalid share parameters', 20);
      client.shares.invalid++;
      return;
    }

    const share = {
      clientId: client.id,
      worker: client.worker,
      jobId,
      extraNonce2,
      nTime,
      nonce,
      difficulty: client.difficulty,
      ip: client.ip
    };

    // Emit share for validation
    this.emit('client.share', client, share, (isValid, error) => {
      if (isValid) {
        client.shares.valid++;
        this.sendMessage(client, {
          id: data.id,
          result: true,
          error: null
        });
        
        // Adjust difficulty if varDiff enabled
        if (client.varDiff) {
          this.adjustDifficulty(client);
        }
      } else {
        client.shares.invalid++;
        this.sendError(client, data.id, error || 'Invalid share', 23);
        
        // Check for ban
        this.checkBan(client);
      }
    });
  }

  /**
   * Handle mining.get_transactions
   */
  async handleGetTransactions(client, data) {
    // Not implemented yet
    this.sendMessage(client, {
      id: data.id,
      result: [],
      error: null
    });
  }

  /**
   * Validate worker credentials
   */
  async validateWorker(workerName, password) {
    // Basic validation - can be extended
    return workerName && workerName.length > 0;
  }

  /**
   * Send difficulty to client
   */
  sendDifficulty(client) {
    this.sendMessage(client, {
      id: null,
      method: 'mining.set_difficulty',
      params: [client.difficulty]
    });
  }

  /**
   * Adjust difficulty for variable difficulty
   */
  adjustDifficulty(client) {
    if (!client.varDiff) return;

    const now = Date.now();
    const timeElapsed = (now - client.connectedAt) / 1000;
    
    if (timeElapsed < client.varDiff.retargetTime) return;

    const targetShares = timeElapsed / client.varDiff.targetTime;
    const actualShares = client.shares.valid;
    
    if (actualShares === 0) return;

    const ratio = targetShares / actualShares;
    let newDiff = client.difficulty * ratio;

    // Clamp to min/max
    newDiff = Math.max(client.varDiff.minDiff, newDiff);
    newDiff = Math.min(client.varDiff.maxDiff, newDiff);

    if (Math.abs(newDiff - client.difficulty) / client.difficulty > 0.1) {
      client.difficulty = Math.round(newDiff);
      this.sendDifficulty(client);
      
      logger.stratum('Difficulty adjusted', {
        clientId: client.id,
        newDifficulty: client.difficulty
      });
    }
  }

  /**
   * Check if client should be banned
   */
  checkBan(client) {
    if (!this.options.banning || !this.options.banning.enabled) return;

    const totalShares = client.shares.valid + client.shares.invalid;
    
    if (totalShares < this.options.banning.checkThreshold) return;

    const invalidPercent = (client.shares.invalid / totalShares) * 100;

    if (invalidPercent > this.options.banning.invalidPercent) {
      this.banIP(client.ip, this.options.banning.time);
      this.disconnectClient(client.id);
      
      logger.warn('Client banned for excessive invalid shares', {
        ip: client.ip,
        invalidPercent: invalidPercent.toFixed(2)
      });
    }
  }

  /**
   * Ban an IP address
   */
  banIP(ip, duration) {
    const until = Date.now() + (duration * 1000);
    this.bannedIPs.set(ip, until);
    this.emit('ip.banned', ip, duration);
  }

  /**
   * Check if IP is banned
   */
  isIPBanned(ip) {
    const banUntil = this.bannedIPs.get(ip);
    if (!banUntil) return false;
    
    if (Date.now() > banUntil) {
      this.bannedIPs.delete(ip);
      return false;
    }
    
    return true;
  }

  /**
   * Start ban cleanup interval
   */
  startBanCleanup() {
    if (!this.options.banning || !this.options.banning.enabled) return;

    setInterval(() => {
      const now = Date.now();
      for (const [ip, until] of this.bannedIPs) {
        if (now > until) {
          this.bannedIPs.delete(ip);
        }
      }
    }, (this.options.banning.purgeInterval || 300) * 1000);
  }

  /**
   * Start client timeout checker
   */
  startClientTimeout(client) {
    const checkInterval = setInterval(() => {
      const inactive = Date.now() - client.lastActivity;
      
      if (inactive > this.options.connectionTimeout * 1000) {
        logger.warn('Client timed out', {
          clientId: client.id,
          inactiveSeconds: Math.round(inactive / 1000)
        });
        this.disconnectClient(client.id);
        clearInterval(checkInterval);
      }
      
      if (!this.clients.has(client.id)) {
        clearInterval(checkInterval);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Disconnect a client
   */
  disconnectClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      client.socket.destroy();
    } catch (error) {
      // Socket already closed
    }

    this.clients.delete(clientId);
    this.connectionCount--;
    this.emit('client.disconnected', client);
  }

  /**
   * Send message to client
   */
  sendMessage(client, message) {
    try {
      const json = JSON.stringify(message) + '\n';
      client.socket.write(json);
    } catch (error) {
      logger.error('Error sending message to client:', {
        clientId: client.id,
        error: error.message
      });
    }
  }

  /**
   * Send error to client
   */
  sendError(client, id, message, code) {
    this.sendMessage(client, {
      id,
      result: null,
      error: [code, message, null]
    });
  }

  /**
   * Broadcast to all clients
   */
  broadcast(message) {
    for (const client of this.clients.values()) {
      if (client.authorized) {
        this.sendMessage(client, message);
      }
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      port: this.options.port,
      isRunning: this.isRunning,
      connections: this.connectionCount,
      bannedIPs: this.bannedIPs.size,
      clients: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        ip: c.ip,
        worker: c.worker,
        authorized: c.authorized,
        difficulty: c.difficulty,
        shares: c.shares,
        connectedAt: c.connectedAt
      }))
    };
  }
}

export default StratumServer;
