#!/usr/bin/env node

/**
 * Setup script for NOMP v2
 * Helps initialize the mining pool with proper configuration
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   NOMP v2 Setup Wizard               ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Check Node version
  const nodeVersion = process.version.match(/^v(\d+)/)[1];
  if (parseInt(nodeVersion) < 20) {
    console.error('❌ Node.js version 20 or higher is required!');
    console.error(`   Current version: ${process.version}`);
    process.exit(1);
  }
  console.log('✓ Node.js version check passed\n');

  // Create .env file
  if (!existsSync('.env')) {
    console.log('Creating .env file...');
    
    const adminPassword = await question('Enter admin password (min 8 chars): ');
    const redisHost = await question('Redis host (127.0.0.1): ') || '127.0.0.1';
    const redisPort = await question('Redis port (6379): ') || '6379';
    
    const envContent = readFileSync('.env.example', 'utf8')
      .replace('ADMIN_PASSWORD=changeme', `ADMIN_PASSWORD=${adminPassword}`)
      .replace('REDIS_HOST=127.0.0.1', `REDIS_HOST=${redisHost}`)
      .replace('REDIS_PORT=6379', `REDIS_PORT=${redisPort}`);
    
    writeFileSync('.env', envContent);
    console.log('✓ .env file created\n');
  } else {
    console.log('✓ .env file already exists\n');
  }

  // Create logs directory
  if (!existsSync('logs')) {
    mkdirSync('logs', { recursive: true });
    console.log('✓ Logs directory created\n');
  }

  // Check for pool configs
  const poolConfigDir = join(__dirname, '..', 'config', 'pools');
  const hasConfigs = existsSync(poolConfigDir) && 
    require('fs').readdirSync(poolConfigDir)
      .filter(f => f.endsWith('.json') && !f.includes('example')).length > 0;

  if (!hasConfigs) {
    console.log('⚠️  No pool configurations found!');
    console.log('   Copy and configure pool files from config/pools/*.example.json\n');
  }

  console.log('═══════════════════════════════════════');
  console.log('Setup complete! Next steps:\n');
  console.log('1. Configure your pools in config/pools/');
  console.log('2. Update coin daemon settings');
  console.log('3. Run: npm start');
  console.log('═══════════════════════════════════════\n');

  rl.close();
}

setup().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});
