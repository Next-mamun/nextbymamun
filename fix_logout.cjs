const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /const logout = async \(\) => \{\n    await signOut\(auth\);\n    localStorage\.removeItem\('next_media_user'\);\n    setCurrentUser\(null\);\n  \};/g,
  `const logout = async () => {
    await signOut(auth);
    localStorage.clear();
    const qc = (window as any).queryClient;
    if (qc) qc.clear();
    setCurrentUser(null);
  };`
);
fs.writeFileSync('src/App.tsx', content);
console.log('Fixed logout');
