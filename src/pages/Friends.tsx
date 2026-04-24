
import React, { useState, useEffect } from 'react';
import { UserMinus, MessageSquare, Check, X, UserPlus, Search, Users, Ban, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { redis } from '@/lib/redis';

const Friends: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'discover' | 'blocked'>('discover');

  useEffect(() => {
    if (!currentUser) return;

    const sub = supabase
      .channel('friendships_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `sender_id=eq.${currentUser.id},receiver_id=eq.${currentUser.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['friends'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [currentUser, queryClient]);

  const { data: friendsData, isLoading: loading } = useQuery({
    queryKey: ['friends', searchQuery],
    queryFn: async () => {
      if (!currentUser?.id) return { requests: [], friends: [], discovery: [], blockedUsers: [] };

      const cacheKey = `friends_cache_${currentUser.id}_${searchQuery.trim()}`;
      try {
        const cachedStr = await redis.get(cacheKey);
        if (cachedStr) {
          return typeof cachedStr === 'string' ? JSON.parse(cachedStr) : cachedStr;
        }
      } catch (e) {
        console.warn('Redis read failed for friends cache', e);
      }

      // 1. Fetch relationships
      const { data: allRel, error: relError } = await supabase
        .from('friendships')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      if (relError) throw relError;

      // 2. Fetch profiles based on search query or default
      let profQuery = supabase.from('profiles').select('*').neq('id', currentUser.id);
      
      if (searchQuery.trim()) {
        profQuery = profQuery.or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`);
      }
      
      const { data: allProf, error: profError } = await profQuery.limit(searchQuery.trim() ? 100 : 500);
      
      if (profError) throw profError;

      // Map profiles for quick access
      const profMap = new Map(allProf.map(p => [p.id, p]));
      
      // We also need profiles for existing relationships that might not be in the search results
      const missingProfIds = (allRel || [])
        .map(rel => rel.sender_id === currentUser.id ? rel.receiver_id : rel.sender_id)
        .filter(id => !profMap.has(id));

      if (missingProfIds.length > 0) {
        const { data: missingProfs } = await supabase
          .from('profiles')
          .select('*')
          .in('id', missingProfIds);
        
        missingProfs?.forEach(p => profMap.set(p.id, p));
      }

      const reqs: any[] = [];
      const frs: any[] = [];
      const blks: any[] = [];
      const disc: any[] = [];
      
      const relatedIds = new Set<string>([currentUser.id]);

      (allRel || []).forEach(rel => {
        const otherId = rel.sender_id === currentUser.id ? rel.receiver_id : rel.sender_id;
        const otherProf = profMap.get(otherId);
        if (!otherProf) return;

        relatedIds.add(otherId);

        if (rel.status === 'accepted') {
          frs.push({ ...otherProf, friendship_id: rel.id });
        } else if (rel.status === 'pending') {
          if (rel.receiver_id === currentUser.id) {
            reqs.push({ ...otherProf, friendship_id: rel.id, profiles: otherProf });
          } else {
            disc.push({ ...otherProf, friendship_id: rel.id, is_pending: true });
          }
        } else if (rel.status === 'blocked') {
          blks.push({ ...otherProf, friendship_id: rel.id });
        }
      });

      // Add users from search/default profiles to discovery if not already related
      allProf.forEach(p => {
        if (!relatedIds.has(p.id)) {
          disc.push(p);
        }
      });

      // Final client-side filter to be safe and handle the search query across all tabs
      const filterList = (list: any[]) => {
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(p => {
          const target = p.profiles || p;
          const name = (target.display_name || '').toLowerCase();
          const user = (target.username || '').toLowerCase();
          return name.includes(q) || user.includes(q);
        });
      };

      const uniqueById = (list: any[]) => {
        const map = new Map();
        list.forEach(item => {
          const id = item.id;
          if (!map.has(id)) map.set(id, item);
        });
        return Array.from(map.values());
      };

      const result = {
        requests: uniqueById(filterList(reqs)),
        friends: uniqueById(filterList(frs)),
        blockedUsers: uniqueById(filterList(blks)),
        discovery: uniqueById(filterList(disc))
      };

      try {
        await redis.setex(cacheKey, 600, JSON.stringify(result));
      } catch (e) {
        console.warn('Redis write failed for friends cache', e);
      }

      return result;
    },
    staleTime: 60 * 1000,
    gcTime: Infinity,
  });

  const { requests = [], friends = [], discovery = [], blockedUsers = [] } = friendsData || {};

  useEffect(() => {
    // Subscribe to friendship updates (requests, accepts, blocks)
    const friendshipSub = supabase.channel('friendship_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => queryClient.invalidateQueries({ queryKey: ['friends'] }))
      .subscribe();

    // Subscribe to profile updates (new users joining)
    const profileSub = supabase.channel('profile_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => queryClient.invalidateQueries({ queryKey: ['friends'] }))
      .subscribe();

    return () => { 
      supabase.removeChannel(friendshipSub); 
      supabase.removeChannel(profileSub);
    };
  }, [queryClient]);

  const handleStatus = async (id: string, status: 'accepted' | 'delete' | 'blocked') => {
    // Optimistic Update
    const previousData = queryClient.getQueryData(['friends', searchQuery]);
    queryClient.setQueryData(['friends', searchQuery], (old: any) => {
      if (!old) return old;
      if (status === 'delete') {
        return {
          ...old,
          requests: old.requests.filter((r: any) => r.friendship_id !== id),
          friends: old.friends.filter((f: any) => f.friendship_id !== id)
        };
      }
      if (status === 'accepted') {
        const acceptedReq = old.requests.find((r: any) => r.friendship_id === id);
        if (!acceptedReq) return old;
        return {
          ...old,
          requests: old.requests.filter((r: any) => r.friendship_id !== id),
          friends: [...old.friends, { ...acceptedReq, friendship_id: id }]
        };
      }
      return old;
    });

    try {
      if (status === 'delete') {
          await supabase.from('friendships').delete().eq('id', id);
      } else {
          await supabase.from('friendships').update({ status }).eq('id', id);
          
          if (status === 'accepted') {
            const { data: friendship } = await supabase.from('friendships').select('*').eq('id', id).single();
            if (friendship) {
              const otherId = friendship.sender_id === currentUser?.id ? friendship.receiver_id : friendship.sender_id;
              await supabase.from('notifications').insert([{
                user_id: otherId,
                sender_id: currentUser?.id,
                type: 'friend_accept',
                is_read: false,
                created_at: new Date().toISOString()
              }]);
              queryClient.invalidateQueries({ queryKey: ['notifications', otherId] });
            }
          }
      }
    } catch (err) {
      console.error("Error updating status:", err);
      queryClient.setQueryData(['friends', searchQuery], previousData);
    }
    queryClient.invalidateQueries({ queryKey: ['friends'] });
  };

  const sendRequest = async (targetId: string) => {
    // Optimistic Update
    const previousData = queryClient.getQueryData(['friends', searchQuery]);
    queryClient.setQueryData(['friends', searchQuery], (old: any) => {
      if (!old) return old;
      const targetUser = old.discovery.find((u: any) => u.id === targetId);
      if (!targetUser) return old;
      return {
        ...old,
        discovery: old.discovery.map((u: any) => u.id === targetId ? { ...u, is_pending: true, friendship_id: 'temp-' + Date.now() } : u)
      };
    });

    try {
      const { data, error } = await supabase.from('friendships').insert([{ sender_id: currentUser?.id, receiver_id: targetId, status: 'pending' }]).select().single();
      if (!error) {
        await supabase.from('notifications').insert([{
          user_id: targetId,
          sender_id: currentUser?.id,
          type: 'friend_request',
          is_read: false,
          created_at: new Date().toISOString()
        }]);
        queryClient.invalidateQueries({ queryKey: ['notifications', targetId] });
      } else {
          throw error;
      }
    } catch (err) {
      console.error("Error sending request:", err);
      queryClient.setQueryData(['friends', searchQuery], previousData);
    }
    queryClient.invalidateQueries({ queryKey: ['friends'] });
  };

  const cancelRequest = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) {
        console.error("Error canceling request:", error);
    }
    queryClient.invalidateQueries({ queryKey: ['friends'] });
  };

  const blockUser = async (targetId: string, friendshipId?: string) => {
    if (friendshipId) {
        await supabase.from('friendships').update({ status: 'blocked', sender_id: currentUser?.id, receiver_id: targetId }).eq('id', friendshipId);
    } else {
        await supabase.from('friendships').insert([{ sender_id: currentUser?.id, receiver_id: targetId, status: 'blocked' }]);
    }
    queryClient.invalidateQueries({ queryKey: ['friends'] });
  };

  const unblockUser = async (friendshipId: string) => {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      queryClient.invalidateQueries({ queryKey: ['friends'] });
  }

  return (
    <div className="max-w-[1000px] mx-auto py-8 px-4 pb-24">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Friends Center</h1>
        
        <div className="flex items-center gap-2 bg-white dark:bg-black p-2 rounded-full shadow-sm border border-gray-200 dark:border-gray-800 w-full md:w-auto">
            <Search size={20} className="text-gray-400 ml-2" />
            <input 
                type="text" 
                placeholder="Find friends..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none px-2 py-1 w-full md:w-64 text-gray-900 dark:text-white placeholder-gray-500"
            />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        <button onClick={() => setActiveTab('discover')} className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all ${activeTab === 'discover' ? 'bg-[#1877F2] text-white shadow-md' : 'bg-white dark:bg-black text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-800'}`}>
            Discover
        </button>
        <button onClick={() => setActiveTab('friends')} className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all ${activeTab === 'friends' ? 'bg-[#1877F2] text-white shadow-md' : 'bg-white dark:bg-black text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-800'}`}>
            My Friends <span className="ml-1 opacity-80 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{friends.length}</span>
        </button>
        <button onClick={() => setActiveTab('requests')} className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all ${activeTab === 'requests' ? 'bg-[#1877F2] text-white shadow-md' : 'bg-white dark:bg-black text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-800'}`}>
            Requests <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${requests.length > 0 ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>{requests.length}</span>
        </button>
        <button onClick={() => setActiveTab('blocked')} className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all ${activeTab === 'blocked' ? 'bg-[#1877F2] text-white shadow-md' : 'bg-white dark:bg-black text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-800'}`}>
            Blocked
        </button>
      </div>

      {loading && !friendsData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-black border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col items-center text-center animate-pulse">
                <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-800 mb-3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-4"></div>
                <div className="w-full h-10 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
              </div>
            ))}
          </div>
      ) : (
        <>
            {activeTab === 'requests' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
                    {requests.length === 0 ? (
                        <div className="col-span-full text-center py-20 text-gray-400 font-medium">No pending friend requests.</div>
                    ) : requests.map(r => (
                    <div key={r.id} className="bg-white dark:bg-black border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-5 flex flex-col items-center transition-all hover:shadow-md">
                        <img src={r.profiles.avatar_url} onClick={() => navigate(`/profile/${r.profiles.username}`)} className="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-white dark:border-gray-700 mb-4 cursor-pointer" />
                        <p className="font-bold text-gray-900 dark:text-white text-lg mb-4 flex items-center gap-1">
                          {r.profiles.display_name}
                          {r.profiles.is_verified && <VerifiedBadge />}
                        </p>
                        <div className="flex gap-2 w-full">
                        <button onClick={() => handleStatus(r.friendship_id, 'accepted')} className="flex-1 bg-[#1877F2] text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-[#166fe5] transition-all"><Check size={18}/> Accept</button>
                        <button onClick={() => handleStatus(r.friendship_id, 'delete')} className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-4 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-800 transition-all"><X size={18}/></button>
                        </div>
                    </div>
                    ))}
                </div>
            )}

            {activeTab === 'discover' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                    {discovery.length === 0 ? (
                        <div className="col-span-full text-center py-20 text-gray-400 font-medium">No new users found. Try searching!</div>
                    ) : discovery.map(p => (
                    <div key={p.id} className="bg-white dark:bg-black border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex flex-col items-center text-center transition-all hover:shadow-md relative group">
                        <img src={p.avatar_url} onClick={() => navigate(`/profile/${p.username}`)} className="w-20 h-20 rounded-full object-cover shadow-md mb-3 cursor-pointer border-2 border-white dark:border-gray-700" />
                        <p className="font-bold text-gray-900 dark:text-white truncate w-full flex items-center justify-center gap-1">
                          {p.display_name}
                          {p.is_verified && <VerifiedBadge />}
                        </p>
                        <p className="text-xs text-gray-500 mb-4 font-medium italic">@{p.username}</p>
                        {p.is_pending ? (
                            <button onClick={() => cancelRequest(p.friendship_id)} className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all">
                                <X size={16}/> Cancel Request
                            </button>
                        ) : (
                            <button onClick={() => sendRequest(p.id)} className="w-full bg-[#f0f2f5] dark:bg-gray-900 text-gray-800 dark:text-white py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all">
                                <UserPlus size={16}/> Add Friend
                            </button>
                        )}
                        <button onClick={() => blockUser(p.id)} className="absolute top-2 right-2 p-1.5 text-gray-300 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100" title="Block User">
                            <Ban size={16} />
                        </button>
                    </div>
                    ))}
                </div>
            )}

            {activeTab === 'friends' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                    {friends.length === 0 ? (
                        <div className="col-span-full text-center py-20 text-gray-400 font-medium">You haven't added any friends yet.</div>
                    ) : friends.map(f => (
                    <div key={f.id} className="bg-white dark:bg-black border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/profile/${f.username}`)}>
                        <img src={f.avatar_url} className="w-16 h-16 rounded-full border shadow-sm object-cover" />
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-[#1877F2] transition-colors flex items-center gap-1">
                              {f.display_name}
                              {f.is_verified && <VerifiedBadge />}
                            </p>
                            <p className="text-sm text-gray-500 font-bold">Connected Friend</p>
                        </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => navigate('/messages', { state: { userId: f.id } })} className="bg-[#f0f2f5] dark:bg-gray-900 p-3 rounded-full hover:bg-[#1877F2] hover:text-white transition-all text-[#1877F2]" title="Message"><MessageSquare size={20}/></button>
                            <button onClick={() => handleStatus(f.friendship_id, 'delete')} className="bg-[#f0f2f5] dark:bg-gray-900 p-3 rounded-full hover:bg-red-50 hover:text-red-600 transition-all text-gray-400" title="Unfriend"><UserMinus size={20}/></button>
                            <button onClick={() => blockUser(f.id, f.friendship_id)} className="bg-[#f0f2f5] dark:bg-gray-900 p-3 rounded-full hover:bg-red-50 hover:text-red-600 transition-all text-gray-400" title="Block"><Ban size={20}/></button>
                        </div>
                    </div>
                    ))}
                </div>
            )}

            {activeTab === 'blocked' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                    {blockedUsers.length === 0 ? (
                        <div className="col-span-full text-center py-20 text-gray-400 font-medium">No blocked users.</div>
                    ) : blockedUsers.map(f => (
                    <div key={f.id} className="bg-white dark:bg-black border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-4 opacity-50">
                        <img src={f.avatar_url} className="w-12 h-12 rounded-full border shadow-sm object-cover grayscale" />
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">{f.display_name}</p>
                            <p className="text-xs text-red-500 font-bold">Blocked</p>
                        </div>
                        </div>
                        <button onClick={() => unblockUser(f.friendship_id)} className="bg-gray-100 dark:bg-gray-900 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-800 transition-all text-gray-600 dark:text-gray-300 text-sm">Unblock</button>
                    </div>
                    ))}
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default Friends;
