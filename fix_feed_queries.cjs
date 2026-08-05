const fs = require('fs');
let content = fs.readFileSync('src/pages/Feed.tsx', 'utf8');

// Replace getPopulatedReel
content = content.replace(
  /const likesQuery = query\(collection\(db, 'likes'\), where\('post_id', '==', id\)\);\s+const likesSnap = await getDocs\(likesQuery\)\.catch\(\(\) => \(\{ docs: \[\] \}\)\);\s+const likes = \(likesSnap as any\)\.docs\.map\(\(ld: any\) => \(\{ id: ld\.id, \.\.\.ld\.data\(\) \}\)\);/g,
  `// Likes will be fetched lazily in the component\n      const likes: any[] = [];`
);

// Replace getPopulatedPost
content = content.replace(
  /const commentsQuery = query\(collection\(db, 'comments'\), where\('post_id', '==', id\)\);\s+const commentsSnap = await getDocs\(commentsQuery\)\.catch\(\(\) => \(\{ docs: \[\] \}\)\);\s+const comments = await Promise\.all\(\(commentsSnap as any\)\.docs\.map\(async \(cd: any\) => \{\s+const cdData = cd\.data\(\);\s+const commentProfile = await getProfile\(cdData\.user_id\);\s+return \{ id: cd\.id, \.\.\.cdData, profiles: commentProfile \};\s+\}\)\);/g,
  `// Comments will be fetched lazily\n      const comments: any[] = [];`
);

fs.writeFileSync('src/pages/Feed.tsx', content);
console.log('Fixed feed queries');
