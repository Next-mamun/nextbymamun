const fs = require('fs');
let content = fs.readFileSync('src/pages/Messages.tsx', 'utf8');

// Add long press logic to contact items
content = content.replace(
  /<div\n *key=\{chat\.id\}\n *className=\{\`flex items-center gap-3 p-3 w-full cursor-pointer transition-colors/g,
  `
    <div
      key={chat.id}
      onContextMenu={(e) => {
        e.preventDefault();
        if (window.confirm('Delete this chat?')) {
           const deleted = JSON.parse(localStorage.getItem('deleted_chats_' + currentUser.id) || '[]');
           deleted.push(chat.id);
           localStorage.setItem('deleted_chats_' + currentUser.id, JSON.stringify(deleted));
           queryClient.invalidateQueries({ queryKey: ['contacts'] });
           if (selectedChat?.id === chat.id) setSelectedChat(null);
        }
      }}
      className={\`flex items-center gap-3 p-3 w-full cursor-pointer transition-colors`
);

// Add touch hold logic for mobile (long press)
content = content.replace(
  /onClick=\{\(\) => handleChatSelect\(chat\)\}/g,
  `onClick={() => handleChatSelect(chat)}
      onTouchStart={() => {
        (window as any)._holdTimeout = setTimeout(() => {
          if (window.confirm('Delete this chat?')) {
             const deleted = JSON.parse(localStorage.getItem('deleted_chats_' + currentUser?.id) || '[]');
             deleted.push(chat.id);
             localStorage.setItem('deleted_chats_' + currentUser?.id, JSON.stringify(deleted));
             queryClient.invalidateQueries({ queryKey: ['contacts'] });
             if (selectedChat?.id === chat.id) setSelectedChat(null);
          }
        }, 800);
      }}
      onTouchEnd={() => clearTimeout((window as any)._holdTimeout)}
      onTouchMove={() => clearTimeout((window as any)._holdTimeout)}`
);

// Filter contacts
content = content.replace(
  /return newContacts;\n    \}\);\n    handleMessageTextChange\(''\);/g,
  `return newContacts;\n    });\n    handleMessageTextChange('');`
);

content = content.replace(
  /const sortedContacts = contactsWithMessages\.sort\(\(a, b\) => \{/g,
  `const deletedIds = JSON.parse(localStorage.getItem('deleted_chats_' + currentUser?.id) || '[]');
      const filteredForDeletion = contactsWithMessages.filter(c => !deletedIds.includes(c.id));
      const sortedContacts = filteredForDeletion.sort((a, b) => {`
);

fs.writeFileSync('src/pages/Messages.tsx', content);
console.log('Fixed messages delete');
