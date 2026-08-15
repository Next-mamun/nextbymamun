const fs = require('fs');
let code = fs.readFileSync('src/store/useGlobalStore.ts', 'utf-8');

code = code.replace(
  /name:\s*'next_media_global_store',([\s\S]*?)partialize:\s*\([^)]*\)\s*=>\s*\(\{([^}]*)\}\),/m,
  `name: 'next_media_global_store',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ 
        currentUser: state.currentUser, 
        feedPosts: state.feedPosts, 
        lastFeedFetch: state.lastFeedFetch,
        messages: state.messages,
        notifications: state.notifications,
        unreadMessagesCount: state.unreadMessagesCount,
        unreadNotificationsCount: state.unreadNotificationsCount
      }),`
);

fs.writeFileSync('src/store/useGlobalStore.ts', code);
