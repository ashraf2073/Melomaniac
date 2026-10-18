import { create } from 'zustand';
import { fetchLikedIds, setLiked } from '../services/catalog';
import type { Track } from '../types';

interface LibraryState {
  likedIds: Set<string>;
  /** Bumps whenever likes change so lists (Liked Songs) know to refetch. */
  likesVersion: number;
  load: () => Promise<void>;
  toggleLike: (track: Track) => Promise<void>;
  reset: () => void;
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  likedIds: new Set(),
  likesVersion: 0,

  load: async () => {
    try {
      set({ likedIds: new Set(await fetchLikedIds()) });
    } catch {
      // offline: keep whatever we have
    }
  },

  toggleLike: async (track) => {
    const wasLiked = get().likedIds.has(track.id);
    const next = new Set(get().likedIds);
    if (wasLiked) next.delete(track.id);
    else next.add(track.id);
    set({ likedIds: next, likesVersion: get().likesVersion + 1 }); // optimistic

    try {
      await setLiked(track.id, !wasLiked);
    } catch {
      const rollback = new Set(get().likedIds);
      if (wasLiked) rollback.add(track.id);
      else rollback.delete(track.id);
      set({ likedIds: rollback, likesVersion: get().likesVersion + 1 });
    }
  },

  reset: () => set({ likedIds: new Set(), likesVersion: 0 }),
}));
