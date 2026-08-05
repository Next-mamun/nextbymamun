const fs = require('fs');
let content = fs.readFileSync('src/pages/Feed.tsx', 'utf8');

content = content.replace(
  /const profileCache = new Map\(\);\n  const getProfile = async \(userId: string\) => \{\n     if \(\!userId\) return null;\n     if \(profileCache\.has\(userId\)\) return profileCache\.get\(userId\);\n     const userDoc = await getDoc\(doc\(db, 'profiles', userId\)\);\n     const data = userDoc\.exists\(\) \? userDoc\.data\(\) : null;\n     profileCache\.set\(userId, data\);\n     return data;\n     if \(\!userId\) return null;\n     const userDoc = await getDoc\(doc\(db, 'profiles', userId\)\);\n     return userDoc\.exists\(\) \? userDoc\.data\(\) : null;\n  \};/g,
  `const profileCache = new Map();
  const getProfile = async (userId: string) => {
     if (!userId) return null;
     if (profileCache.has(userId)) return profileCache.get(userId);
     const userDoc = await getDoc(doc(db, 'profiles', userId));
     const data = userDoc.exists() ? userDoc.data() : null;
     profileCache.set(userId, data);
     return data;
  };`
);
fs.writeFileSync('src/pages/Feed.tsx', content);

let content2 = fs.readFileSync('src/pages/Reels.tsx', 'utf8');
content2 = content2.replace(
  /const profileCache = new Map\(\);\n  const getProfile = async \(userId: string\) => \{\n     if \(\!userId\) return null;\n     if \(profileCache\.has\(userId\)\) return profileCache\.get\(userId\);\n     const userDoc = await getDoc\(doc\(db, 'profiles', userId\)\);\n     const data = userDoc\.exists\(\) \? userDoc\.data\(\) : null;\n     profileCache\.set\(userId, data\);\n     return data;\n     if \(\!userId\) return null;\n     const userDoc = await getDoc\(doc\(db, 'profiles', userId\)\);\n     return userDoc\.exists\(\) \? userDoc\.data\(\) : null;\n  \};/g,
  `const profileCache = new Map();
  const getProfile = async (userId: string) => {
     if (!userId) return null;
     if (profileCache.has(userId)) return profileCache.get(userId);
     const userDoc = await getDoc(doc(db, 'profiles', userId));
     const data = userDoc.exists() ? userDoc.data() : null;
     profileCache.set(userId, data);
     return data;
  };`
);
fs.writeFileSync('src/pages/Reels.tsx', content2);
console.log('Fixed profileCache');
