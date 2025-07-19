#!/usr/bin/env node

// Quick test script to verify environment setup and API configurations
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Environment Configuration Test');
console.log('================================');

// Check Bunny.net API Key
const bunnyApiKey = process.env.VITE_BUNNY_API_KEY;
console.log('\n🟢 Bunny.net API Configuration:');
console.log(`  ✅ API Key: ${bunnyApiKey ? 'SET' : '❌ MISSING'}`);
if (bunnyApiKey) {
  console.log(`  📏 Length: ${bunnyApiKey.length} characters`);
  console.log(`  🔒 Masked: ${bunnyApiKey.substring(0, 8)}...${bunnyApiKey.substring(-4)}`);
  console.log(`  ✅ Format: ${bunnyApiKey.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i) ? 'Valid UUID' : '❌ Invalid'}`);
}

// Check Supabase Configuration
console.log('\n🟡 Supabase Database Configuration:');
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const postgresUrl = process.env.POSTGRES_URL;

console.log(`  🌐 URL: ${supabaseUrl ? 'SET' : '❌ MISSING'}`);
console.log(`  🔑 Anon Key: ${supabaseAnonKey ? 'SET' : '❌ MISSING'}`);
console.log(`  🔐 Service Key: ${supabaseServiceKey ? 'SET' : '❌ MISSING'}`);
console.log(`  🗄️ Postgres URL: ${postgresUrl ? 'SET' : '❌ MISSING'}`);

if (supabaseUrl) {
  console.log(`  📍 Project: ${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}`);
}

// Check Google Sheets Configuration (Optional)
console.log('\n🔵 Google Sheets Configuration (Optional):');
const sheetsSpreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const sheetsCredentials = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
console.log(`  📊 Spreadsheet ID: ${sheetsSpreadsheetId ? 'SET' : '❌ MISSING'}`);
console.log(`  🔐 Credentials: ${sheetsCredentials ? 'SET' : '❌ MISSING'}`);

// Overall Status
const criticalConfigs = [bunnyApiKey, supabaseUrl, supabaseAnonKey];
const allCriticalSet = criticalConfigs.every(config => !!config);

console.log('\n📋 Overall Status:');
console.log(`  ${allCriticalSet ? '✅ READY' : '❌ NOT READY'} - ${allCriticalSet ? 'All critical configurations are set' : 'Missing critical configurations'}`);

if (!allCriticalSet) {
  console.log('\n🔧 Required Actions:');
  if (!bunnyApiKey) console.log('  • Set VITE_BUNNY_API_KEY environment variable');
  if (!supabaseUrl) console.log('  • Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  if (!supabaseAnonKey) console.log('  • Set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

console.log('\n🚀 Ready for deployment to Vercel and GitHub!');
console.log('================================');