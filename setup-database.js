/**
 * Setup Database - Simple approach using pg connection
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://ahexnoaazbveiyhplfrc.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoZXhub2FhemJ2ZWl5aHBsZnJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI0MzAyMiwiZXhwIjoyMDc1ODE5MDIyfQ.a2Te8vxVqbgKl7E7qK7Uah6lqx6QxXgUh-9sqqtUx8I';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runSQL(sql) {
  try {
    // Use Management API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const text = await response.text();
      console.log(`API Response: ${text}`);
    }

    return response.ok;
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Setting up database...\n');

  // Read migration files
  const migration1 = fs.readFileSync(
    path.join(__dirname, 'supabase', 'migrations', '20251013000001_add_credits_system.sql'),
    'utf8'
  );

  const migration2 = fs.readFileSync(
    path.join(__dirname, 'supabase', 'migrations', '20251013000002_update_api_keys_for_custom_pipeline.sql'),
    'utf8'
  );

  console.log('📄 Migration 1: Credits System');
  console.log(`   SQL length: ${migration1.length} characters`);

  console.log('\n📄 Migration 2: API Keys Update');
  console.log(`   SQL length: ${migration2.length} characters`);

  console.log('\n💡 Since I cannot execute raw SQL directly through the API,');
  console.log('   please run these migrations manually:\n');

  console.log('📋 OPTION 1: Use Supabase SQL Editor');
  console.log('   1. Go to: https://supabase.com/dashboard/project/ahexnoaazbveiyhplfrc/sql/new');
  console.log('   2. Copy the SQL from: supabase/migrations/20251013000001_add_credits_system.sql');
  console.log('   3. Paste and click "RUN"');
  console.log('   4. Repeat for: 20251013000002_update_api_keys_for_custom_pipeline.sql\n');

  console.log('📋 OPTION 2: Install Supabase CLI');
  console.log('   npm install -g supabase');
  console.log('   supabase login');
  console.log('   supabase link --project-ref ahexnoaazbveiyhplfrc');
  console.log('   supabase db push\n');

  console.log('✅ After running migrations, your system will be ready!');
}

main();
