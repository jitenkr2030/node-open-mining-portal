import EventEmitter from 'events';
import redisClient from '../../database/redis/client.js';
import logger from '../../utils/logger.js';

/**
 * Modern Payment Processor
 * Handles payment calculations and distributions using PROP (Proportional) system
 */
class PaymentProcessor extends EventEmitter {
  constructor(poolName, poolConfig, daemonClient) {
    super();
    this.poolName = poolName;
    this.poolConfig = poolConfig;
    this.daemonClient = daemonClient;
    this.isProcessing = false;
    this.paymentInterval = null;
  }

  /**
   * Start payment processing
   */
  async start() {
    if (!this.poolConfig.paymentProcessing?.enabled) {
      logger.system('PaymentProcessor', `Payment processing disabled for ${this.poolName}`);
      return;
    }

    const interval = (this.poolConfig.paymentProcessing.interval || 30) * 1000;
    
    this.paymentInterval = setInterval(async () => {
      await this.processPayments();
    }, interval);

    logger.system('PaymentProcessor', `Started for pool ${this.poolName}`, {
      interval: interval / 1000
    });
  }

  /**
   * Stop payment processing
   */
  async stop() {
    if (this.paymentInterval) {
      clearInterval(this.paymentInterval);
      this.paymentInterval = null;
      logger.system('PaymentProcessor', `Stopped for pool ${this.poolName}`);
    }
  }

  /**
   * Main payment processing function
   */
  async processPayments() {
    if (this.isProcessing) {
      logger.debug('Payment processing already in progress', { pool: this.poolName });
      return;
    }

    this.isProcessing = true;

    try {
      // Get confirmed blocks
      const confirmedBlocks = await this.getConfirmedBlocks();

      if (confirmedBlocks.length === 0) {
        logger.debug('No confirmed blocks to process', { pool: this.poolName });
        return;
      }

      logger.system('PaymentProcessor', `Processing ${confirmedBlocks.length} confirmed blocks`, {
        pool: this.poolName
      });

      // Process each confirmed block
      for (const block of confirmedBlocks) {
        await this.processBlockPayment(block);
      }

    } catch (error) {
      logger.error('Payment processing error:', {
        pool: this.poolName,
        error: error.message
      });
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get confirmed blocks ready for payment
   */
  async getConfirmedBlocks() {
    const blockKey = `${this.poolName}:blocks:confirmed`;
    const blocksData = await redisClient.hGetAll(blockKey);

    if (!blocksData || Object.keys(blocksData).length === 0) {
      return [];
    }

    const blocks = [];
    for (const [hash, data] of Object.entries(blocksData)) {
      const block = JSON.parse(data);
      
      // Check if block is already paid
      if (block.paid) continue;

      // Check if block has required confirmations
      if (block.confirmations >= (this.poolConfig.confirmations || 100)) {
        blocks.push({ hash, ...block });
      }
    }

    return blocks;
  }

  /**
   * Process payment for a single block
   */
  async processBlockPayment(block) {
    try {
      logger.system('PaymentProcessor', `Processing payment for block ${block.height}`, {
        pool: this.poolName,
        hash: block.hash
      });

      // Calculate rewards
      const rewards = await this.calculateRewards(block);

      if (Object.keys(rewards).length === 0) {
        logger.warn('No rewards to distribute', { blockHeight: block.height });
        return;
      }

      // Process rewards and send payments
      const payments = await this.preparePayments(rewards);

      // Send payments via daemon
      await this.sendPayments(payments);

      // Mark block as paid
      await this.markBlockPaid(block);

      logger.system('PaymentProcessor', `Successfully processed payments for block ${block.height}`, {
        pool: this.poolName,
        recipientsCount: Object.keys(payments).length
      });

      this.emit('payment.success', {
        pool: this.poolName,
        block: block.height,
        payments
      });

    } catch (error) {
      logger.error('Error processing block payment:', {
        pool: this.poolName,
        blockHeight: block.height,
        error: error.message
      });
      
      this.emit('payment.error', {
        pool: this.poolName,
        block: block.height,
        error: error.message
      });
    }
  }

  /**
   * Calculate rewards using PROP (Proportional) system
   */
  async calculateRewards(block) {
    const shareKey = `${this.poolName}:shares:round_${block.height}`;
    const shares = await redisClient.hGetAll(shareKey);

    if (!shares || Object.keys(shares).length === 0) {
      logger.warn('No shares found for block', {
        pool: this.poolName,
        height: block.height
      });
      return {};
    }

    // Calculate total shares
    let totalShares = 0;
    for (const workerShares of Object.values(shares)) {
      totalShares += parseFloat(workerShares);
    }

    if (totalShares === 0) {
      return {};
    }

    // Calculate block reward after fees
    const blockReward = parseFloat(block.reward);
    const totalFee = this.calculateTotalFee();
    const minerReward = blockReward * (1 - totalFee);

    // Calculate individual rewards
    const rewards = {};
    for (const [worker, workerShares] of Object.entries(shares)) {
      const sharePercent = parseFloat(workerShares) / totalShares;
      const reward = minerReward * sharePercent;
      
      if (reward > 0) {
        rewards[worker] = reward;
      }
    }

    // Add fee recipients
    if (this.poolConfig.rewardRecipients) {
      for (const [address, feePercent] of Object.entries(this.poolConfig.rewardRecipients)) {
        const feeReward = blockReward * (feePercent / 100);
        rewards[address] = (rewards[address] || 0) + feeReward;
      }
    }

    return rewards;
  }

  /**
   * Calculate total fee percentage
   */
  calculateTotalFee() {
    if (!this.poolConfig.rewardRecipients) {
      return 0;
    }

    let totalFee = 0;
    for (const feePercent of Object.values(this.poolConfig.rewardRecipients)) {
      totalFee += parseFloat(feePercent) / 100;
    }

    return totalFee;
  }

  /**
   * Prepare payments by grouping small amounts
   */
  async preparePayments(rewards) {
    const payments = {};
    const minimumPayment = this.poolConfig.paymentProcessing?.minimumPayment || 0.01;

    for (const [address, amount] of Object.entries(rewards)) {
      // Get pending balance for this address
      const balanceKey = `${this.poolName}:balances:${address}`;
      const pendingBalance = parseFloat(await redisClient.get(balanceKey) || 0);
      
      const totalAmount = amount + pendingBalance;

      if (totalAmount >= minimumPayment) {
        payments[address] = totalAmount;
        
        // Clear pending balance
        await redisClient.set(balanceKey, '0');
      } else {
        // Save for next payment
        await redisClient.set(balanceKey, totalAmount.toString());
        
        logger.debug('Amount below minimum, saved to pending balance', {
          address,
          amount: totalAmount,
          minimum: minimumPayment
        });
      }
    }

    return payments;
  }

  /**
   * Send payments via daemon RPC
   */
  async sendPayments(payments) {
    if (Object.keys(payments).length === 0) {
      return;
    }

    try {
      // Use sendmany RPC command
      const txid = await this.daemonClient.sendMany('', payments);
      
      logger.system('PaymentProcessor', `Payment transaction sent`, {
        pool: this.poolName,
        txid,
        recipientCount: Object.keys(payments).length
      });

      // Store payment record
      await this.storePaymentRecord(txid, payments);

      return txid;

    } catch (error) {
      logger.error('Failed to send payments:', {
        pool: this.poolName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Store payment record
   */
  async storePaymentRecord(txid, payments) {
    const paymentKey = `${this.poolName}:payments`;
    
    const record = {
      txid,
      timestamp: Date.now(),
      payments,
      totalAmount: Object.values(payments).reduce((sum, amt) => sum + amt, 0)
    };

    await redisClient.hSet(paymentKey, txid, JSON.stringify(record));
    
    // Also add to sorted set for time-based queries
    await redisClient.zAdd(
      `${this.poolName}:payments:timeline`,
      record.timestamp,
      txid
    );
  }

  /**
   * Mark block as paid
   */
  async markBlockPaid(block) {
    const confirmedKey = `${this.poolName}:blocks:confirmed`;
    const paidKey = `${this.poolName}:blocks:paid`;

    block.paid = true;
    block.paidAt = Date.now();

    // Move from confirmed to paid
    await redisClient.hDel(confirmedKey, block.hash);
    await redisClient.hSet(paidKey, block.hash, JSON.stringify(block));

    logger.debug('Block marked as paid', {
      pool: this.poolName,
      height: block.height,
      hash: block.hash
    });
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats() {
    const paymentKey = `${this.poolName}:payments`;
    const paymentsData = await redisClient.hGetAll(paymentKey);

    if (!paymentsData || Object.keys(paymentsData).length === 0) {
      return {
        totalPayments: 0,
        totalAmount: 0,
        lastPayment: null
      };
    }

    let totalAmount = 0;
    let lastPaymentTime = 0;
    let lastPaymentTxid = null;

    for (const [txid, data] of Object.entries(paymentsData)) {
      const payment = JSON.parse(data);
      totalAmount += payment.totalAmount;
      
      if (payment.timestamp > lastPaymentTime) {
        lastPaymentTime = payment.timestamp;
        lastPaymentTxid = txid;
      }
    }

    return {
      totalPayments: Object.keys(paymentsData).length,
      totalAmount,
      lastPayment: {
        txid: lastPaymentTxid,
        timestamp: lastPaymentTime
      }
    };
  }

  /**
   * Get worker balance
   */
  async getWorkerBalance(address) {
    const balanceKey = `${this.poolName}:balances:${address}`;
    const balance = await redisClient.get(balanceKey);
    return parseFloat(balance || 0);
  }

  /**
   * Get payment history for worker
   */
  async getWorkerPaymentHistory(address, limit = 10) {
    const paymentKey = `${this.poolName}:payments`;
    const paymentsData = await redisClient.hGetAll(paymentKey);

    if (!paymentsData) {
      return [];
    }

    const history = [];

    for (const [txid, data] of Object.entries(paymentsData)) {
      const payment = JSON.parse(data);
      
      if (payment.payments[address]) {
        history.push({
          txid,
          timestamp: payment.timestamp,
          amount: payment.payments[address]
        });
      }
    }

    // Sort by timestamp descending
    history.sort((a, b) => b.timestamp - a.timestamp);

    return history.slice(0, limit);
  }
}

export default PaymentProcessor;
