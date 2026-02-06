#!/usr/bin/env node

/**
 * Script to execute SQL schema using Supabase database connection
 * 
 * Usage (with password):
 *   node run-schema.js <database-password>
 * 
 * Usage (with full connection string - recommended):
 *   node run-schema.js --connection-string "postgresql://..."
 * 
 * Or set environment variables:
 *   SUPABASE_DB_PASSWORD=your-password node run-schema.js
 *   SUPABASE_CONNECTION_STRING="postgresql://..." node run-schema.js
 * 
 * To get your connection string:
 *   1. Go to https://supabase.com/dashboard/project/qdilvhwdddjawnyvrhlj/settings/database
 *   2. Find "Connection string" section
 *   3. Copy the "URI" connection string (transaction mode recommended)
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://qdilvhwdddjawnyvrhlj.supabase.co';
const SQL_FILE = path.join(__dirname, 'supabase-schema.sql');

// Get connection string or password from command line or environment
let connectionString = process.env.SUPABASE_CONNECTION_STRING;
let dbPassword = process.env.SUPABASE_DB_PASSWORD;

// Check for --connection-string flag
if (process.argv[2] === '--connection-string' && process.argv[3]) {
  connectionString = process.argv[3];
} else if (process.argv[2] && !process.argv[2].startsWith('--')) {
  dbPassword = process.argv[2];
}

if (!connectionString && !dbPassword) {
  console.error('Error: Database password or connection string required');
  console.error('\nUsage (with password):');
  console.error('   node run-schema.js <database-password>');
  console.error('\nUsage (with connection string - recommended):');
  console.error('   node run-schema.js --connection-string "postgresql://..."');
  console.error('\nTo get your connection string:');
  console.error('  1. Go to: https://supabase.com/dashboard/project/qdilvhwdddjawnyvrhlj/settings/database');
  console.error('  2. Find "Connection string" section');
  console.error('  3. Copy the "URI" connection string (transaction mode)');
  process.exit(1);
}

// Read SQL file
let sql;
try {
  sql = fs.readFileSync(SQL_FILE, 'utf8');
  console.log(`✓ Read SQL file: ${SQL_FILE}`);
} catch (error) {
  console.error(`Error reading SQL file: ${error.message}`);
  process.exit(1);
}

// Execute SQL using direct PostgreSQL connection
async function executeSQL(sql, connStr) {
  // Check if pg is installed
  let pg;
  try {
    pg = require('pg');
  } catch (error) {
    console.error('Error: "pg" package not found. Installing...');
    console.error('Please run: npm install pg');
    throw new Error('pg package required');
  }

  const { Client } = pg;
  
  const client = new Client({
    connectionString: connStr,
    ssl: {
      rejectUnauthorized: false // Supabase uses SSL
    }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    // Execute the SQL
    const result = await client.query(sql);
    
    await client.end();
    return result;
  } catch (error) {
    try {
      await client.end();
    } catch {}
    throw error;
  }
}

// Build connection strings to try
function getConnectionStrings() {
  if (connectionString) {
    return [connectionString];
  }
  
  // Extract project reference from Supabase URL
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
  
  // Try multiple connection string formats
  return [
    // Direct connection (most common)
    `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`,
    // Pooler connection (transaction mode)
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    // Pooler connection (session mode)
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
    // Alternative regions
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
  ];
}

// Main execution
(async () => {
  console.log('🚀 Executing SQL schema...\n');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`SQL file: ${SQL_FILE}\n`);

  const connectionStrings = getConnectionStrings();
  let lastError;

  for (let i = 0; i < connectionStrings.length; i++) {
    const connStr = connectionStrings[i];
    
    try {
      if (connectionStrings.length > 1) {
        console.log(`Trying connection ${i + 1}/${connectionStrings.length}...`);
      }
      const result = await executeSQL(sql, connStr);
      console.log('\n✅ Success! Schema executed successfully.');
      if (result && result.command) {
        console.log(`Command: ${result.command}`);
        if (result.rowCount !== null) {
          console.log(`Rows affected: ${result.rowCount}`);
        }
      }
      return; // Success!
    } catch (error) {
      lastError = error;
      
      // If it's a connection/auth error and we have more to try, continue
      if (i < connectionStrings.length - 1 && (
          error.message.includes('ENOTFOUND') || 
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('Tenant or user not found') ||
          error.message.includes('password authentication failed') ||
          error.message.includes('does not exist'))) {
        continue; // Try next connection string
      }
      
      // If it's a SQL error, we're connected but SQL failed - show the error
      if (!error.message.includes('ENOTFOUND') && 
          !error.message.includes('ECONNREFUSED') &&
          !error.message.includes('Tenant or user not found') &&
          !error.message.includes('password authentication failed')) {
        throw error; // SQL execution error
      }
    }
  }
  
  // If we get here, all connection attempts failed
  console.error('\n❌ Error executing SQL:', lastError?.message || 'All connection attempts failed');
  console.error('\nTroubleshooting:');
  console.error('1. Verify your database password is correct');
  console.error('2. Get the exact connection string from Supabase dashboard:');
  console.error('   https://supabase.com/dashboard/project/qdilvhwdddjawnyvrhlj/settings/database');
  console.error('3. Use it with: node run-schema.js --connection-string "postgresql://..."');
  console.error('4. Check your Supabase project is active');
  console.error('\nAlternative: Use the Supabase dashboard SQL editor:');
  console.error(`  https://supabase.com/dashboard/project/qdilvhwdddjawnyvrhlj/sql`);
  process.exit(1);
})();
