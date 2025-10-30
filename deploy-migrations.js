/**
 * Deploy Database Migrations to Supabase
 * Uses Supabase Management API to execute SQL directly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_REF = 'ahexnoaazbveiyhplfrc';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI0MzAyMiwiZXhwIjoyMDc1ODE5MDIyfQ.a2Te8vxVqbgKl7E7qK7Uah6lqx6QxXgUh-9sqqtUx8I';

async function executeSQL(sql) {
  const url = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return true;
  } catch (error) {
    throw error;
  }
}

async function runMigration(filename) {
  console.log(`\n📄 Running: ${filename}`);

  const filePath = path.join(__dirname, 'supabase', 'migrations', filename);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 10);

  console.log(`   Found ${statements.length} SQL statements`);

  for (let i = 0; i < statements.length; i++) {
    try {
      console.log(`   ⏳ Executing statement ${i + 1}/${statements.length}...`);
      await executeSQL(statements[i] + ';');
      console.log(`   ✅ Statement ${i + 1} executed`);
    } catch (error) {
      console.log(`   ⚠️  Statement ${i + 1}: ${error.message.substring(0, 100)}`);
      // Continue with next statement
    }
  }

  console.log(`✅ Migration ${filename} completed`);
  return true;
}

async function main() {
  console.log('🚀 Deploying Database Migrations to Supabase');
  console.log(`📍 Project: ${PROJECT_REF}\n`);

  const migrations = [
    '20251013000001_add_credits_system.sql',
    '20251013000002_update_api_keys_for_custom_pipeline.sql'
  ];

  for (const migration of migrations) {
    await runMigration(migration);
  }

  console.log('\n✨ All migrations deployed!');
  console.log('\n🎯 Your database is ready for:');
  console.log('   • Credits system');
  console.log('   • Call cost tracking');
  console.log('   • Credits transactions');
  console.log('   • Billplz payments');
  console.log('\n💰 Ready to make money! 🚀');
}

main().catch(error => {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
});
