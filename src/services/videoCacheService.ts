import { localDB, CachedVideo } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, query, limit, getDocs, doc, getDoc, where } from 'firebase/firestore';

const REFRESH_KEY = 'nextmedia_video_refresh_count';
const TARGET_CACHE_COUNT = 120; // Cache 100+ videos at once to save DB calls

export const getRefreshCount = (): number => {
  try {
    const val = localStorage.getItem(REFRESH_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch (e) {
    return 0;
  }
};

export const incrementRefreshCount = (): number => {
  try {
    const next = getRefreshCount() + 1;
    localStorage.setItem(REFRESH_KEY, next.toString());
    return next;
  } catch (e) {
    return 0;
  }
};

export const resetRefreshCount = (): void => {
  try {
    localStorage.setItem(REFRESH_KEY, '0');
  } catch (e) {}
};

// Fallback high quality reels so feed is never empty
export const FALLBACK_REELS: CachedVideo[] = [
  {
    id: 'local_reel_nature_1',
    media_url: 'https://res.cloudinary.com/demo/video/upload/v1689887532/samples/sea-turtle.mp4',
    caption: 'Majestic underwater journey 🌊🐢 #nature #ocean',
    user_id: 'nature_explorer',
    source_type: 'local',
    cachedAt: Date.now(),
    likes_count: 342,
    comments_count: 28,
    profiles: {
      display_name: 'Ocean Planet',
      username: 'ocean_planet',
      avatar_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=150',
      is_verified: true
    }
  },
  {
    id: 'local_reel_city_2',
    media_url: 'https://res.cloudinary.com/demo/video/upload/v1689887532/samples/cld-sample-video.mp4',
    caption: 'Fast-paced city life & night lights ✨🌃 #cityvibes #cinematic',
    user_id: 'urban_lens',
    source_type: 'local',
    cachedAt: Date.now(),
    likes_count: 520,
    comments_count: 45,
    profiles: {
      display_name: 'Urban Explorer',
      username: 'urban_explorer',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      is_verified: true
    }
  },
  {
    id: 'local_reel_nature_3',
    media_url: 'https://res.cloudinary.com/demo/video/upload/q_auto,f_auto/v1689887532/samples/sea-turtle.mp4',
    caption: 'Breathtaking moments in the wild 🌿🐾 #wildlife #peace',
    user_id: 'wild_earth',
    source_type: 'local',
    cachedAt: Date.now(),
    likes_count: 189,
    comments_count: 12,
    profiles: {
      display_name: 'Wild Earth',
      username: 'wild_earth',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      is_verified: false
    }
  }
];

export async function fetchAndCacheVideos(forceFromCloud = false): Promise<CachedVideo[]> {
  try {
    const cachedCount = await localDB.cachedVideos.count();
    const currentRefreshCount = getRefreshCount();

    // If we have cached videos, haven't hit 3 refreshes, and not forced, return cached videos!
    if (cachedCount > 0 && currentRefreshCount < 3 && !forceFromCloud) {
      console.log(`[VideoCache] Serving ${cachedCount} videos from IndexedDB (Refresh count: ${currentRefreshCount}/3)`);
      const cached = await localDB.cachedVideos.toArray();
      // Sort newest cached or by created_at
      return cached.sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0));
    }

    console.log(`[VideoCache] Fetching fresh 100+ videos batch from Firestore (Reason: count=${cachedCount}, refresh=${currentRefreshCount})`);

    // Fetch batch from Firestore
    const profileCache = new Map<string, any>();
    const getProfile = async (userId: string) => {
      if (!userId) return null;
      if (profileCache.has(userId)) return profileCache.get(userId);
      try {
        const uDoc = await getDoc(doc(db, 'profiles', userId));
        const data = uDoc.exists() ? uDoc.data() : null;
        profileCache.set(userId, data);
        return data;
      } catch(e) {
        return null;
      }
    };

    // Query both 'reels' and 'posts' with media_type == 'video'
    const qReels = query(collection(db, 'reels'), limit(TARGET_CACHE_COUNT));
    const qPosts = query(collection(db, 'posts'), where('media_type', '==', 'video'), limit(TARGET_CACHE_COUNT));

    const [reelsSnap, postsSnap] = await Promise.all([
      getDocs(qReels).catch(() => ({ docs: [] })),
      getDocs(qPosts).catch(() => ({ docs: [] }))
    ]);

    const rawDocs = [...(reelsSnap as any).docs, ...(postsSnap as any).docs];
    const populatedList: CachedVideo[] = [];
    const seenIds = new Set<string>();

    for (const d of rawDocs) {
      if (seenIds.has(d.id)) continue;
      seenIds.add(d.id);

      const data = d.data();
      const mediaUrl = data.media_url || data.video_url;
      if (!mediaUrl) continue;

      const profile = await getProfile(data.user_id);
      
      populatedList.push({
        id: d.id,
        media_url: mediaUrl,
        caption: data.caption || data.content || '',
        user_id: data.user_id,
        created_at: data.created_at,
        source_type: data.source_type || 'cloud',
        profiles: profile ? {
          display_name: profile.display_name || profile.username || 'User',
          username: profile.username || profile.id,
          avatar_url: profile.avatar_url || '',
          is_verified: !!profile.is_verified
        } : {
          display_name: 'User',
          username: 'user',
          avatar_url: '',
          is_verified: false
        },
        likes_count: data.likes_count || 0,
        comments_count: data.comments_count || 0,
        cachedAt: Date.now()
      });
    }

    // Merge with fallbacks if list is short
    if (populatedList.length < 3) {
      for (const fb of FALLBACK_REELS) {
        if (!seenIds.has(fb.id)) {
          populatedList.push(fb);
        }
      }
    }

    // Save batch to IndexedDB
    if (populatedList.length > 0) {
      await localDB.cachedVideos.clear();
      await localDB.cachedVideos.bulkPut(populatedList);
      resetRefreshCount();
      console.log(`[VideoCache] Successfully cached ${populatedList.length} videos in IndexedDB`);
    }

    return populatedList;
  } catch (err) {
    console.warn('[VideoCache] Error during fetchAndCacheVideos:', err);
    // Return whatever we have in IndexedDB or fallbacks
    const existing = await localDB.cachedVideos.toArray().catch(() => []);
    if (existing.length > 0) return existing;
    return FALLBACK_REELS;
  }
}

// Silent handler for broken/deleted Cloudinary videos
export async function silentlyRemoveCorruptedVideo(videoId: string) {
  if (!videoId) return;
  try {
    await localDB.cachedVideos.delete(videoId);
    console.log(`[VideoCache] Silently removed corrupted/deleted video: ${videoId}`);
  } catch (e) {}
}
