import type { AuthProvider } from '@refinedev/core';
import { supabase } from '@/lib/api/supabase';

/**
 * Refine auth provider configured for Supabase
 * Handles authentication, authorization, and user management
 */
export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error,
      };
    }

    if (data?.user) {
      return {
        success: true,
        redirectTo: '/admin',
      };
    }

    return {
      success: false,
      error: {
        name: 'LoginError',
        message: 'Invalid credentials',
      },
    };
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error,
      };
    }

    return {
      success: true,
      redirectTo: '/login',
    };
  },

  check: async () => {
    const { data } = await supabase.auth.getSession();
    const { session } = data;

    if (!session) {
      return {
        authenticated: false,
        redirectTo: '/login',
        logout: true,
      };
    }

    return {
      authenticated: true,
    };
  },

  getPermissions: async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    if (user) {
      return user.role;
    }

    return null;
  },

  getIdentity: async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    if (user) {
      return {
        id: user.id,
        name: user.user_metadata?.full_name || user.email,
        email: user.email,
        avatar: user.user_metadata?.avatar_url,
      };
    }

    return null;
  },

  onError: async (error) => {
    if (error?.statusCode === 401) {
      return {
        logout: true,
        redirectTo: '/login',
        error,
      };
    }

    return { error };
  },
};
