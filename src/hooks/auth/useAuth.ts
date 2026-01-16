import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/api/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

// Session timeout in milliseconds (30 minutes of inactivity)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
}

export interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

/**
 * Authentication hook providing auth state and methods
 * Automatically syncs with Supabase auth state changes
 *
 * @example
 * ```tsx
 * const { user, loading, signIn, signOut } = useAuth();
 *
 * if (loading) return <Spinner />;
 * if (!user) return <LoginForm onSubmit={signIn} />;
 * return <div>Welcome {user.email}</div>;
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session timeout handler - logs out user after inactivity
  const resetSessionTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only set timeout if user is logged in
    if (state.user) {
      const timeoutAt = new Date(Date.now() + SESSION_TIMEOUT_MS);
      console.log('[SESSION] Activity detected, resetting timeout. Will expire at:', timeoutAt.toISOString());

      // Log current token expiration for debugging
      if (state.session?.expires_at) {
        const tokenExpiry = new Date(state.session.expires_at * 1000);
        const now = new Date();
        const minutesUntilExpiry = Math.round((tokenExpiry.getTime() - now.getTime()) / 60000);
        console.log('[SESSION] JWT token status:', {
          expiresAt: tokenExpiry.toISOString(),
          minutesUntilExpiry,
          isExpired: minutesUntilExpiry <= 0,
        });
      }

      timeoutRef.current = setTimeout(async () => {
        console.warn('[SESSION] Session timeout triggered - logging out due to 30 minutes of inactivity');
        console.warn('[SESSION] User being logged out:', state.user?.email);
        await supabase.auth.signOut();
        setState({
          user: null,
          session: null,
          loading: false,
          error: null,
        });
      }, SESSION_TIMEOUT_MS);
    }
  }, [state.user, state.session]);

  // Set up activity listeners for session timeout
  useEffect(() => {
    if (!state.user) return;

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    const handleActivity = (): void => {
      resetSessionTimeout();
    };

    // Add listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timeout
    resetSessionTimeout();

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state.user, resetSessionTimeout]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    async function initializeAuth(): Promise<void> {
      try {
        console.log('[AUTH] Initializing auth state...');
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('[AUTH] Error getting session:', error);
          throw error;
        }

        if (mounted) {
          if (session) {
            const tokenExpiry = session.expires_at ? new Date(session.expires_at * 1000) : null;
            console.log('[AUTH] Session restored:', {
              userId: session.user?.id,
              email: session.user?.email,
              tokenExpiresAt: tokenExpiry?.toISOString(),
            });
          } else {
            console.log('[AUTH] No existing session found');
          }
          setState({
            user: session?.user ?? null,
            session,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('[AUTH] Initialization error:', error);
        if (mounted) {
          setState({
            user: null,
            session: null,
            loading: false,
            error: error as AuthError,
          });
        }
      }
    }

    void initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH] Auth state changed:', {
        event,
        userId: session?.user?.id,
        email: session?.user?.email,
        hasSession: !!session,
      });
      if (mounted) {
        setState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setState({
        user: data.user,
        session: data.session,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error as AuthError,
      }));
      throw error;
    }
  }, []);

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: Record<string, unknown>
    ): Promise<void> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const signUpOptions = metadata ? { data: metadata } : {};
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          ...(Object.keys(signUpOptions).length > 0 ? { options: signUpOptions } : {}),
        });

        if (error) {
          throw error;
        }

        // Profile is automatically created by the database trigger
        // using metadata passed in the signup options

        setState({
          user: data.user,
          session: data.session,
          loading: false,
          error: null,
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error as AuthError,
        }));
        throw error;
      }
    },
    []
  );

  /**
   * Sign out current user
   */
  const signOut = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setState({
        user: null,
        session: null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error as AuthError,
      }));
      throw error;
    }
  }, []);

  /**
   * Send password reset email
   */
  const resetPassword = useCallback(async (email: string): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setState((prev) => ({ ...prev, loading: false, error: null }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error as AuthError,
      }));
      throw error;
    }
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
