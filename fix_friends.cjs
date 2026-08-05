const fs = require('fs');
let content = fs.readFileSync('src/pages/Friends.tsx', 'utf8');

content = content.replace(/queryClient\.invalidateQueries\(\{ queryKey: \['friends'\] \}\);/g, '// invalidated by onSnapshot');

fs.writeFileSync('src/pages/Friends.tsx', content);
console.log('Fixed friends.tsx');
