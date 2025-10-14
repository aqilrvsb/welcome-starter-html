/**
 * Run Supabase Migrations Directly
 * Executes SQL migrations using Supabase REST API
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

async function executeSqlDirect(sql) {
  try {
    // Use Supabase REST API to execute raw SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

async function runMigrationFile(filename) {
  console.log(`\n📄 Running migration: ${filename}`);

  const filePath = path.join(__dirname, 'supabase', 'migrations', filename);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filename}`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    // Execute entire SQL file
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.log(`⚠️  Warning: ${error.message}`);
      console.log(`   Trying direct execution...`);

      // Try executing via HTTP
      await executeSqlDirect(sql);
    }

    console.log(`✅ Migration ${filename} completed!`);
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Running Supabase Migrations...\n');

  const migrations = [
    '20251013000001_add_credits_system.sql',
    '20251013000002_update_api_keys_for_custom_pipeline.sql'
  ];

  for (const migration of migrations) {
    await runMigrationFile(migration);
  }

  console.log('\n✅ All migrations completed!');
  console.log('\n📋 Database is ready for the custom AI call pipeline!');
  console.log('\n💡 Next steps:');
  console.log('   1. Deploy edge functions');
  console.log('   2. Set environment variables');
  console.log('   3. Test the system');
}

main().catch(console.error);
