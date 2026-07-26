const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
const tempDir = path.join(__dirname, '..', 'src', 'app', '_api_disabled');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

try {
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, tempDir); // "_" prefix = Next.js ignores it as a route
    console.log('Temporarily disabled src/app/api for static export build.');
  }

  run('next build --webpack');
  run('next-sitemap');
} finally {
  if (fs.existsSync(tempDir)) {
    fs.renameSync(tempDir, apiDir);
    console.log('Restored src/app/api.');
  }
}