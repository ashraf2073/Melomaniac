import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  /** True until the first stored session has been read from disk. */
  initializing: boolean;
  /** Starts listening to auth changes. Returns the unsubscribe function. */
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  initializing: true,

  init: () => {
    void supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, initializing: false });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, initializing: false });
    });
    return () => data.subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? error.message : null;
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return { error: error.message, needsConfirmation: false };
    // With "Confirm email" enabled in Supabase, no session comes back until the link is clicked.
    return { error: null, needsConfirmation: data.session === null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
