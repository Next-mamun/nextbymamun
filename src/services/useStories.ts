import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Story, User } from '@/types';
export const useStories = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStories = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching stories:', error);
      } else {
        setStories(data || []);
      }
      setLoading(false);
    };

    fetchStories();

    const subscription = supabase
      .channel('public:stories')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, (payload) => {
        setStories(current => [payload.new as Story, ...current]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'stories' }, (payload) => {
        setStories(current => current.filter(s => s.id !== (payload.old as Story).id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (error) {
        console.error('Error fetching users for stories:', error);
      } else {
        setUsers(data || []);
      }
      setLoading(false);
    };

    fetchUsers();

  }, [stories]);

  return { users, loading };
};
