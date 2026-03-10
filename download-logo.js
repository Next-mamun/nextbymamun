import fs from 'fs';
import https from 'https';

https.get('https://postimg.cc/bDBKL2MF', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const match = data.match(/<meta property="og:image" content="([^"]+)"/);
    if (match && match[1]) {
      const imageUrl = match[1];
      console.log('Found image URL:', imageUrl);
      
      https.get(imageUrl, (imgRes) => {
        const file = fs.createWriteStream('public/custom-logo.png');
        imgRes.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('Image downloaded to public/custom-logo.png');
        });
      });
    } else {
      console.log('Image URL not found');
    }
  });
});
