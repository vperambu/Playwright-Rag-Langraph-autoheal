const { execSync } = require('child_process');
execSync('npx cucumber-js --tags "@websocket" --publish-quiet', { stdio: 'inherit' });
