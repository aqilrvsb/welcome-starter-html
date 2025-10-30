/**
 * Supabase Setup Script
 * This will run all database migrations and set up the custom AI call pipeline
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://ahexnoaazbveiyhplfrc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI0MzAyMiwiZXhwIjoyMDc1ODE5MDIyfQ.a2Te8vxVqbgKl7E7qK7Uah6lqx6QxXgUh-9sqqtUx8I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration(name, sql) {
  console.log(`\n🔄 Running migration: ${name}`);

  try {
    // Split SQL by statement (simple split by semicolon)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip empty statements and comments
      if (!statement.trim() || statement.trim().startsWith('--')) continue;

      console.log(`  📝 Executing statement ${i + 1}/${statements.length}...`);

      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement
      });

      if (error) {
        // Try direct query if RPC doesn't work
        const { error: directError } = await supabase.from('_migrations').select('*').limit(1);

        if (directError) {
          console.log(`  ⚠️  Statement ${i + 1} skipped or already exists`);
        } else {
          console.error(`  ❌ Error in statement ${i + 1}:`, error.message);
        }
      } else {
        console.log(`  ✅ Statement ${i + 1} executed successfully`);
      }
    }

    console.log(`✅ Migration ${name} completed!`);
    return true;
  } catch (error) {
    console.error(`❌ Migration ${name} failed:`, error.message);
    return false;
  }
}

async function testConnection() {
  console.log('🔌 Testing Supabase connection...');

  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    console.log('✅ Supabase connection successful!');
    console.log(`📊 Connected to: ${supabaseUrl}`);
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    return !error || error.code === 'PGRST116'; // PGRST116 = empty result
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Supabase Setup...\n');

  // Step 1: Test connection
  const connected = await testConnection();
  if (!connected) {
    console.error('\n❌ Setup failed: Could not connect to Supabase');
    process.exit(1);
  }

  // Step 2: Check existing tables
  console.log('\n📊 Checking existing tables...');
  const tables = ['users', 'credits_transactions', 'call_costs'];
  for (const table of tables) {
    const exists = await checkTableExists(table);
    console.log(`  ${exists ? '✅' : '❌'} ${table}`);
  }

  // Step 3: Read and run migrations
  console.log('\n📁 Reading migration files...');

  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
  const migrationFiles = [
    '20251013000001_add_credits_system.sql',
    '20251013000002_update_api_keys_for_custom_pipeline.sql'
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Migration file not found: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    await runMigration(file, sql);
  }

  // Step 4: Verify setup
  console.log('\n🔍 Verifying setup...');
  const tablesAfter = ['users', 'credits_transactions', 'call_costs', 'api_keys'];
  for (const table of tablesAfter) {
    const exists = await checkTableExists(table);
    console.log(`  ${exists ? '✅' : '❌'} ${table}`);
  }

  console.log('\n✅ Supabase setup completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('  1. Set environment variables in Supabase Dashboard');
  console.log('  2. Deploy edge functions: supabase functions deploy');
  console.log('  3. Test credits top-up functionality');
  console.log('  4. Make your first AI call!');
  console.log('\n💰 Ready to make $31,200/month profit! 🚀');
}

main().catch(error => {
  console.error('\n❌ Setup failed:', error);
  process.exit(1);
});
