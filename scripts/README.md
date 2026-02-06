# Database Scripts

## execute-sql.js

Execute SQL commands directly against your Supabase database.

### Setup

1. Get your database connection string from Supabase Dashboard:
   - Go to: https://supabase.com/dashboard/project/qdilvhwdddjawnyvrhlj/settings/database
   - Find "Connection string" section
   - Copy the "URI" connection string (Transaction mode recommended)
   - It should look like: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`

2. Add it to your `.env` file:
   ```
   SUPABASE_DB_CONNECTION_STRING="postgresql://..."
   ```

### Usage

```bash
# Execute a single SQL command
node scripts/execute-sql.js "SELECT * FROM tenants;"

# Execute SQL from a file
cat fix-trigger.sql | node scripts/execute-sql.js

# Or with explicit connection string
SUPABASE_DB_CONNECTION_STRING="postgresql://..." node scripts/execute-sql.js "SELECT 1;"
```

### Alternative: Use Supabase Dashboard

For now, the easiest way is to run SQL directly in the Supabase dashboard:
1. Go to: https://supabase.com/dashboard/project/qdilvhwdddjawnyvrhlj/sql
2. Paste your SQL
3. Click "Run"
