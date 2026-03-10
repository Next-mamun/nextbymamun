const fs = require('fs');
const buffer = fs.readFileSync('public/custom-logo.png');
console.log('Local Size:', buffer.length);
console.log('Local First 10 bytes:', buffer.slice(0, 10).toString('hex'));
