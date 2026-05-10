import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { Story, User } from '@/types';
export const useStories = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'stories'),
      orderBy('created_at', 'desc')
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
      setStories(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching stories:', error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { stories, loading };
};

export const useUsersWithStories = (stories: Story[]) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userIds = [...new Set(stories.map(s => s.user_id))];

    if (userIds.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const usersData = await Promise.all(
          userIds.map(async (userId) => {
            const docRef = doc(db, 'profiles', userId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as User : null;
          })
        );
        setUsers(usersData.filter(Boolean) as User[]);
      } catch (error) {
         console.error('Error fetching users for stories:', error);
      }
      setLoading(false);
    };

    fetchUsers();

  }, [stories]);

  return { users, loading };
};
