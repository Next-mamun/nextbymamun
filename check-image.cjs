const https = require('https');

https.get('https://next-nexto.vercel.app/pwa-192x192.png', (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = [];
  res.on('data', chunk => data.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(data);
    console.log('Size:', buffer.length);
    console.log('First 10 bytes:', buffer.slice(0, 10).toString('hex'));
  });
}).on('error', (e) => {
  console.error(e);
});
