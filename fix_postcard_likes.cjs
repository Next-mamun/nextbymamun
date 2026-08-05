const fs = require('fs');
let content = fs.readFileSync('src/components/PostCard.tsx', 'utf8');

// We'll add a useEffect to fetch likes and comments if they are not provided
const hook = `  useEffect(() => {
    let unmounted = false;
    const fetchStats = async () => {
      try {
        if (!post.likes || post.likes.length === 0) {
          const lSnap = await getDocs(query(collection(db, 'likes'), where('post_id', '==', post.id)));
          if (!unmounted) {
            const likesData = lSnap.docs.map(d => d.data());
            setIsLiked(likesData.some(l => l.user_id === currentUser?.id));
            setLikesCount(likesData.length);
          }
        }
        if (!post.comments || post.comments.length === 0) {
          const cSnap = await getDocs(query(collection(db, 'comments'), where('post_id', '==', post.id)));
          if (!unmounted) {
            setLocalComments(await Promise.all(cSnap.docs.map(async cd => {
              const cdData = cd.data();
              const uDoc = await getDoc(doc(db, 'profiles', cdData.user_id));
              return { id: cd.id, ...cdData, profiles: uDoc.exists() ? uDoc.data() : null };
            })));
          }
        }
      } catch(e) {}
    };
    fetchStats();
    return () => { unmounted = true; };
  }, [post.id, currentUser?.id]);`;

if (!content.includes('fetchStats()')) {
  content = content.replace(
    /useEffect\(\(\) => \{\n    if \(cardRef\.current && onObserve\)/,
    hook + "\n\n  useEffect(() => {\n    if (cardRef.current && onObserve)"
  );
  
  if (!content.includes('getDocs')) {
    content = content.replace(
      /import \{ doc, deleteDoc/g,
      "import { doc, deleteDoc, getDocs, query, collection, where, getDoc"
    );
  }
  
  fs.writeFileSync('src/components/PostCard.tsx', content);
  console.log('Fixed PostCard lazy loading');
}
