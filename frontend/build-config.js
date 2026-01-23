const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '.env');
const env = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  });
}

// Generate config.js
const configContent = `// Configuration for API endpoints (auto-generated from .env)
window.API_CONFIG = {
  BASE_URL: '${env.API_BASE_URL || 'http://localhost:3001/api'}'
};`;

fs.writeFileSync(path.join(__dirname, 'public', 'config.js'), configContent);
console.log('✅ Config generated from .env file');