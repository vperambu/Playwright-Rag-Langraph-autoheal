const { execSync } = require('child_process');
const path = require('path');

const allureResults = path.resolve('allure-results');
const outDir = path.resolve('reports', 'allure-summary');
execSync(`npx allure generate ${allureResults} --clean -o ${outDir}`, { stdio: 'inherit' });
console.log('Generated Allure summary report at', outDir);
