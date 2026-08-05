const fs = require('fs');
let content = fs.readFileSync('src/pages/Friends.tsx', 'utf8');

content = content.replace(
  /const cancelRequest = async \(friendshipId: string\) => \{/,
  `const cancelRequest = async (friendshipId: string) => {
    queryClient.setQueryData(['friends', searchQuery], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        discovery: old.discovery.map((u: any) => u.friendship_id === friendshipId ? { ...u, is_pending: false, friendship_id: null } : u),
        requests: old.requests.filter((u: any) => u.friendship_id !== friendshipId)
      };
    });`
);
fs.writeFileSync('src/pages/Friends.tsx', content);
console.log('Fixed friends cancel');
