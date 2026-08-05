const fs = require('fs');

const files = ['src/pages/Feed.tsx', 'src/pages/Reels.tsx'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('const profileCache = new Map();')) continue;
  
  content = content.replace(
    /const getProfile = async \(userId: string\) => {/g,
    `const profileCache = new Map();\n  const getProfile = async (userId: string) => {\n     if (!userId) return null;\n     if (profileCache.has(userId)) return profileCache.get(userId);\n     const userDoc = await getDoc(doc(db, 'profiles', userId));\n     const data = userDoc.exists() ? userDoc.data() : null;\n     profileCache.set(userId, data);\n     return data;`
  );
  fs.writeFileSync(file, content);
}
console.log('Fixed profile cache');
