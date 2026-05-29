const { setWorldConstructor } = require('@cucumber/cucumber');
const CustomWorld = require('./custom-world');

setWorldConstructor(CustomWorld);
