const fs = require('fs');
let code = fs.readFileSync('src/pages/Messages.tsx', 'utf-8');

// Insert idb import if not present
if (!code.includes("import { get, set } from 'idb-keyval'")) {
  code = code.replace("import * as idb from 'idb-keyval';", "import { get, set } from 'idb-keyval';");
}

code = code.replace(
  /queryFn:\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)return Array\.from\(partnerMap\.values\(\)\);/m,
  `queryFn: async () => {
      console.log("Fetching contacts for user:", currentUser?.id);
      if (!currentUser) return [];
      
      let cachedContacts = [];
      try {
        cachedContacts = await get('chat_contacts_' + currentUser.id) || [];
      } catch (e) {}

      try {
        // 1. Fetch messages to find active conversations
        const msgQuery = query(
          collection(db, 'messages'),
          or(where('sender_id', '==', currentUser.id), where('receiver_id', '==', currentUser.id)),
          limit(500)
        );
        const msgSnap = await getDocs(msgQuery);
        let messages = msgSnap.docs
          .map(d => ({id: d.id, ...d.data()} as any))
          .filter(m => !m.deleted_for_everyone && !(m.deleted_for || []).includes(currentUser.id));
        
        // Sort in memory to avoid composite index requirement
        messages.sort((a, b) => {
          const timeA = typeof a.created_at === 'string' ? new Date(a.created_at).getTime() : a.created_at?.toMillis ? a.created_at.toMillis() : Date.now();
          const timeB = typeof b.created_at === 'string' ? new Date(b.created_at).getTime() : b.created_at?.toMillis ? b.created_at.toMillis() : Date.now();
          return timeB - timeA;
        });
        
        const partnerMap = new Map<string, any>();
        for (const m of messages) {
          const partnerId = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
          let parsedM: any = { ...m };
          if (typeof m.content === 'string') {
            if (m.content.includes('"JSON_PAYLOAD"')) {
              try {
                const obj = JSON.parse(m.content);
                parsedM.content = obj.text;
                parsedM.is_view_once = obj.is_view_once;
                parsedM.parent_message_id = obj.parent_message_id;
              } catch(e) {}
            } else if (m.content.startsWith('{')) {
              try {
                const obj = JSON.parse(m.content);
                if (obj.text !== undefined) parsedM.content = obj.text;
              } catch(e) {}
            }
          }
          if (!partnerMap.has(partnerId)) {
             partnerMap.set(partnerId, {
               id: partnerId,
               lastMessage: parsedM,
               unreadCount: (m.receiver_id === currentUser.id && !m.is_read) ? 1 : 0
             });
          } else {
             if (m.receiver_id === currentUser.id && !m.is_read) {
               partnerMap.get(partnerId).unreadCount += 1;
             }
          }
        }
        
        // Fetch profiles
        for (const [pId, pData] of partnerMap.entries()) {
          const pDoc = await getDoc(doc(db, 'profiles', pId));
          if (pDoc.exists()) {
             partnerMap.set(pId, { ...pData, ...pDoc.data() });
          }
        }
        
        const finalContacts = Array.from(partnerMap.values());
        await set('chat_contacts_' + currentUser.id, finalContacts);
        return finalContacts;
      } catch (err) {
        console.warn("Using cached contacts due to DB error:", err);
        return cachedContacts;
      }`
);

fs.writeFileSync('src/pages/Messages.tsx', code);
