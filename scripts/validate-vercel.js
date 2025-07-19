#!/usr/bin/env node

// Validate Vercel deployment configuration
import fs from 'fs';
import path from 'path';

console.log('🔍 Validating Vercel deployment configuration...\n');

// Check vercel.json exists and is valid
if (fs.existsSync('vercel.json')) {
  try {
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    console.log('✅ vercel.json: Valid JSON configuration');
    
    if (vercelConfig.buildCommand) {
      console.log(`✅ Build command: ${vercelConfig.buildCommand}`);
    }
    
    if (vercelConfig.outputDirectory) {
      console.log(`✅ Output directory: ${vercelConfig.outputDirectory}`);
    }
    
    if (vercelConfig.functions) {
      console.log('✅ Serverless functions configured');
    }
  } catch (error) {
    console.error('❌ vercel.json: Invalid JSON');
    process.exit(1);
  }
} else {
  console.error('❌ vercel.json: File not found');
  process.exit(1);
}

// Check API routes structure
const apiDir = 'pages/api';
if (fs.existsSync(apiDir)) {
  console.log('✅ API routes directory exists');
  
  // List API routes
  const apiFiles = [];
  const scanDir = (dir) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        scanDir(filePath);
      } else if (file.endsWith('.js')) {
        apiFiles.push(filePath);
      }
    });
  };
  
  scanDir(apiDir);
  console.log(`✅ Found ${apiFiles.length} API endpoints:`);
  apiFiles.forEach(file => console.log(`   • ${file}`));
} else {
  console.error('❌ API routes directory not found');
}

// Check if dist directory exists after build
if (fs.existsSync('dist')) {
  console.log('✅ Build output directory exists');
  
  if (fs.existsSync('dist/index.html')) {
    console.log('✅ Main HTML file exists in build output');
  }
} else {
  console.log('⚠️  Build output directory not found (run npm run build first)');
}

// Check package.json scripts
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (pkg.scripts && pkg.scripts.build) {
    console.log(`✅ Build script: ${pkg.scripts.build}`);
  }
}

console.log('\n🎉 Vercel deployment configuration validation complete!');
console.log('\n📝 Next steps:');
console.log('   1. Push changes to GitHub');
console.log('   2. Vercel will automatically deploy');
console.log('   3. Configure environment variables in Vercel dashboard');
console.log('   4. Test API endpoints at /api/deployment-status');