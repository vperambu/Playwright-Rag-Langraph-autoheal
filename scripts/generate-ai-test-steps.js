const fs = require('fs');
const path = require('path');
const TestGenerationService = require('../tests/ai/test-generation.service');

const features = ['Home page smoke', 'Users API regression'];
const outputFile = path.resolve('tests', 'features', 'generated-steps.txt');
const content = features.flatMap(name => [`Feature: ${name}`, ...TestGenerationService.generateSteps(name), '']).join('\n');
fs.writeFileSync(outputFile, content);
console.log('Generated AI-driven test steps at', outputFile);
