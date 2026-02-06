#!/usr/bin/env node

/**
 * Execute SQL commands directly against Supabase database
 * Usage: node scripts/execute-sql.js "SELECT * FROM tenants;"
 * Or pipe SQL file: cat fix-trigger.sql | node scripts/execute-sql.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read connection string from .env or environment variable
let connectionString = process.env.SUPABASE_DB_CONNECTION_STRING;

if (!connectionString) {
  // Try reading from .env file
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      const match = line.match(/^([^=]+)="?([^"]+)"?$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key === 'SUPABASE_DB_CONNECTION_STRING') {
          connectionString = value;
          break;
        }
      }
    }
  } catch (e) {
    // .env file not found
  }
}

if (!connectionString) {
  console.error('Error: SUPABASE_DB_CONNECTION_STRING not found');
  console.error('\nPlease add your database connection string to .env:');
  console.error('1. Go to: https://supabase.com/dashboard/project/qdilvhwdddjawnyvrhlj/settings/database');
  console.error('2. Copy the "URI" connection string (Transaction mode)');
  console.error('3. Add to .env: SUPABASE_DB_CONNECTION_STRING="postgresql://..."');
  console.error('\nOr set it as an environment variable:');
  console.error('  SUPABASE_DB_CONNECTION_STRING="postgresql://..." node scripts/execute-sql.js "SELECT 1;"');
  process.exit(1);
}

console.log('Using connection string: ' + connectionString.replace(/:[^:@]+@/, ':****@'));

async function executeSQL(sql) {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    const result = await client.query(sql);
    
    await client.end();
    return result;
  } catch (error) {
    await client.end();
    throw error;
  }
}

async function main() {
  let sql = '';
  
  // Check if SQL is provided as command line argument
  if (process.argv[2]) {
    sql = process.argv[2];
  } else {
    // Read from stdin
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
    console.error('Usage: node scripts/execute-sql.js "SELECT * FROM tenants;"');
    console.error('   or: cat file.sql | node scripts/execute-sql.js');
    process.exit(1);
  }

  try {
    console.log('Executing SQL...\n');
    const result = await executeSQL(sql);
    
    if (result.rows && result.rows.length > 0) {
      console.log('\nResults:');
      console.log(JSON.stringify(result.rows, null, 2));
    } else {
      console.log('\n✓ SQL executed successfully');
      if (result.command) {
        console.log(`Command: ${result.command}`);
      }
      if (result.rowCount !== null) {
        console.log(`Rows affected: ${result.rowCount}`);
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    process.exit(1);
  }
}

main();
