import { useState, useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';
import { useAuth } from './useAuth';

interface IsAdminState {
  isAdmin: boolean;
  isLoading: boolean;
}

/**
 * Hook to check if the current user has admin role
 * Checks the user_roles table for an active admin role
 */
export function useIsAdmin(): IsAdminState {
  const { user } = useAuth();
  const [state, setState] = useState<IsAdminState>({
    isAdmin: false,
    isLoading: true,
  });

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setState({ isAdmin: false, isLoading: false });
        return;
      }

      try {
        console.log('[useIsAdmin] Starting admin check for user:', user.id);

        // First, get the admin role ID
        const { data: adminRole, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'admin')
          .single();

        if (roleError) {
          console.error('[useIsAdmin] Error fetching admin role:', {
            message: roleError.message,
            details: roleError.details,
            hint: roleError.hint,
            code: roleError.code
          });
          setState({ isAdmin: false, isLoading: false });
          return;
        }

        if (!adminRole) {
          console.error('[useIsAdmin] Admin role not found in database');
          setState({ isAdmin: false, isLoading: false });
          return;
        }

        console.log('[useIsAdmin] Admin role found:', adminRole.id);

        // Check if user has the admin role
        const { data: userRole, error: userRoleError } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .eq('role_id', adminRole.id)
          .eq('is_active', true)
          .maybeSingle();

        if (userRoleError) {
          console.error('[useIsAdmin] Error fetching user roles:', {
            message: userRoleError.message,
            details: userRoleError.details,
            hint: userRoleError.hint,
            code: userRoleError.code
          });
          setState({ isAdmin: false, isLoading: false });
          return;
        }

        const isAdmin = userRole !== null;
        console.log('[useIsAdmin] Admin check result:', {
          userId: user.id,
          isAdmin,
          adminRoleId: adminRole.id,
          hasUserRole: !!userRole
        });
        setState({ isAdmin, isLoading: false });
      } catch (err) {
        console.error('[useIsAdmin] Unexpected error checking admin status:', err);
        setState({ isAdmin: false, isLoading: false });
      }
    };

    checkAdminStatus();
  }, [user]);

  return state;
}
