import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { describeError } from '../utils/errors';

interface AuthState {
  session: Session | null;
  /** True until the first stored session has been read from disk. */
  initializing: boolean;
  /**
   * True when the signed-in account is listed in the server's `admins` table.
   * This only controls what the app shows: the database refuses admin actions
   * from everyone else no matter what the app does.
   */
  isAdmin: boolean;
  /** Starts listening to auth changes. Returns the unsubscribe function. */
  init: () => () => void;
  /** Asks the server again whether this account is an admin (after it was just granted, say). */
  refreshAdmin: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

/** False when the check fails for any reason, including the admin SQL not having been run yet. */
async function askServerIfAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    return !error && data === true;
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  initializing: true,
  isAdmin: false,

  init: () => {
    let lastUserId: string | null = null;

    const sync = (session: Session | null) => {
      set({ session, initializing: false });
      const userId = session?.user.id ?? null;
      if (userId === lastUserId) return; // a token refresh, not a different account
      lastUserId = userId;
      if (!userId) {
        set({ isAdmin: false });
        return;
      }
      // Supabase can deadlock if it is called from inside its own auth callback, so defer.
      setTimeout(() => void get().refreshAdmin(), 0);
    };

    void supabase.auth.getSession().then(({ data }) => sync(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => sync(session));
    return () => data.subscription.unsubscribe();
  },

  refreshAdmin: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    const isAdmin = await askServerIfAdmin();
    if (get().session?.user.id === userId && get().isAdmin !== isAdmin) set({ isAdmin });
  },

  signIn: async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? describeError(error) : null;
    } catch (e) {
      return describeError(e);
    }
  },

  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) return { error: describeError(error), needsConfirmation: false };
      // With "Confirm email" enabled in Supabase, no session comes back until the link is clicked.
      return { error: null, needsConfirmation: data.session === null };
    } catch (e) {
      return { error: describeError(e), needsConfirmation: false };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
