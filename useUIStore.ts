import { create } from 'zustand';
import type { Track } from '../types';

interface UIState {
  /** The full-screen Unwrapped story hides the floating player. */
  hidePlayer: boolean;
  setHidePlayer: (hide: boolean) => void;

  /** Track whose "…" menu is open (null = closed). */
  menuTrack: Track | null;
  openMenu: (track: Track) => void;
  closeMenu: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  hidePlayer: false,
  setHidePlayer: (hide) => set({ hidePlayer: hide }),

  menuTrack: null,
  openMenu: (track) => set({ menuTrack: track }),
  closeMenu: () => set({ menuTrack: null }),
}));
