import { get, set, del } from 'idb-keyval';
import { StateStorage } from 'zustand/middleware';

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const val = await get(name);
    return val || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};
