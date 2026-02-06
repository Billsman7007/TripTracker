#!/usr/bin/env node

/**
 * Execute SQL using Supabase Service Role Key (admin privileges)
 * This bypasses RLS and can execute any SQL via RPC functions
 * 
 * Usage: 
 *   SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/execute-sql-admin.js "SELECT * FROM tenants;"
 *   cat fix-trigger.sql | SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/execute-sql-admin.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read from .env or environment variable
let SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
let SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      const match = line.match(/^([^=]+)="?([^"]+)"?$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key === 'EXPO_PUBLIC_SUPABASE_URL' && !SUPABASE_URL) {
          SUPABASE_URL = value;
        }
        if (key === 'SUPABASE_SERVICE_ROLE_KEY' && !SERVICE_ROLE_KEY) {
          SERVICE_ROLE_KEY = value;
        }
      }
    }
  } catch (e) {
    // .env file not found
  }
}

// Fallback
SUPABASE_URL = SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://qdilvhwdddjawnyvrhlj.supabase.co';
SERVICE_ROLE_KEY = SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY not found');
  console.error('\nPlease add your service role key to .env:');
  console.error('1. Go to: https://supabase.com/dashboard/project/qdilvhwdddjawnyvrhlj/settings/api');
  console.error('2. Find "service_role" key (secret, not anon key)');
  console.error('3. Add to .env: SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('\nOr set it as an environment variable:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY="..." node scripts/execute-sql-admin.js "SELECT 1;"');
  process.exit(1);
}

// Clean URL
SUPABASE_URL = SUPABASE_URL.replace(/^"|"$/g, '').trim();
SERVICE_ROLE_KEY = SERVICE_ROLE_KEY.replace(/^"|"$/g, '').trim();

console.log('Using Supabase URL:', SUPABASE_URL);
console.log('Service Role Key:', SERVICE_ROLE_KEY.substring(0, 20) + '...');

// Supabase doesn't have a direct SQL execution endpoint via REST API
// But we can use the Management API or create a helper function
// For now, let's use the PostgREST RPC approach with a helper function

async function executeSQLViaRPC(sql) {
  // First, we need to create a helper function in the database that can execute SQL
  // This is a security risk, so we'll use a safer approach: execute via direct connection
  // using the service role key to get database connection details
  
  // Actually, the best approach is to use Supabase's Management API if available
  // Or use the service role key with pg library
  
  // For now, let's create a simple RPC function approach
  // But Supabase doesn't allow arbitrary SQL execution via RPC for security
  
  // The most practical solution: use service role key with pg library
  // But we need the database password for that...
  
  // Alternative: Use Supabase Edge Functions or create a helper RPC function
  // But that requires deploying code...
  
  throw new Error('Direct SQL execution via service role key requires database connection string. Use execute-sql.js instead with SUPABASE_DB_CONNECTION_STRING.');
}

async function main() {
  let sql = '';
  
  if (process.argv[2]) {
    sql = process.argv[2];
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    for await (const line of rl) {
      sql += line + '\n';
    }
  }

  if (!sql.trim()) {
    console.error('Error: No SQL provided');
    process.exit(1);
  }

  console.log('\n⚠️  Note: Supabase REST API does not support direct SQL execution.');
  console.log('The service role key is for admin operations via the Supabase client.');
  console.log('\nFor SQL execution, you have two options:');
  console.log('1. Use execute-sql.js with SUPABASE_DB_CONNECTION_STRING');
  console.log('2. Run SQL directly in Supabase dashboard SQL editor');
  console.log('\nHowever, I can help you create a helper RPC function if needed.');
  
  process.exit(1);
}

main();
