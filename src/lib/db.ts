import Dexie, { Table } from 'dexie';

export interface Friend {
  id: string;
  fullName: string;
  avatarBlob: string;
  peerId: string;
  lastSeen: number;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: string;
  receiver: string;
  text: string;
  media?: string;
  mediaType?: 'image' | 'video' | 'audio';
  isViewOnce?: boolean;
  status: 'PENDING_P2P' | 'SENT' | 'DELIVERED' | 'READ';
  timestamp: number;
}

export interface Profile {
  id: string;
  name: string;
  avatarBase64: string;
}

export interface CachedVideo {
  id: string;
  source_type?: string;
  media_url: string;
  caption?: string;
  user_id?: string;
  created_at?: any;
  profiles?: any;
  comments?: any[];
  likes?: any[];
  likes_count?: number;
  comments_count?: number;
  cachedAt: number;
}

export class NextMediaDB extends Dexie {
  friends!: Table<Friend, string>;
  messages!: Table<Message, string>;
  profiles!: Table<Profile, string>;
  cachedVideos!: Table<CachedVideo, string>;

  constructor() {
    super('NextMediaDB');
    this.version(3).stores({
      friends: 'id, fullName, peerId, lastSeen',
      messages: 'id, conversationId, sender, receiver, status, timestamp',
      profiles: 'id, name',
      cachedVideos: 'id, cachedAt, user_id'
    });
  }
}

export const localDB = new NextMediaDB();

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const urlToBase64 = async (url: string): Promise<string> => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (error) {
    console.warn('Could not convert URL to Base64 (CORS or network issue), falling back to URL.');
    return url; // fallback to URL if conversion fails
  }
};
