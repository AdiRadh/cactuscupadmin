import { useState, useEffect } from 'react';
import { supabase } from '@/lib/api/supabase';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'organizer' | 'participant' | null;

interface UserRoleState {
  role: UserRole;
  isAdmin: boolean;
  isOrganizer: boolean;
  isLoading: boolean;
}

/**
 * Hook to check the current user's role
 * Returns the highest privilege role the user has (admin > organizer > participant)
 */
export function useUserRole(): UserRoleState {
  const { user } = useAuth();
  const [state, setState] = useState<UserRoleState>({
    role: null,
    isAdmin: false,
    isOrganizer: false,
    isLoading: true,
  });

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setState({ role: null, isAdmin: false, isOrganizer: false, isLoading: false });
        return;
      }

      try {
        // Get all roles with their names
        const { data: roles, error: rolesError } = await supabase
          .from('roles')
          .select('id, name')
          .in('name', ['admin', 'organizer']);

        if (rolesError) {
          console.error('[useUserRole] Error fetching roles:', rolesError);
          setState({ role: null, isAdmin: false, isOrganizer: false, isLoading: false });
          return;
        }

        if (!roles || roles.length === 0) {
          console.error('[useUserRole] No roles found in database');
          setState({ role: null, isAdmin: false, isOrganizer: false, isLoading: false });
          return;
        }

        // Check which roles the user has
        const { data: userRoles, error: userRolesError } = await supabase
          .from('user_roles')
          .select('role_id')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (userRolesError) {
          console.error('[useUserRole] Error fetching user roles:', userRolesError);
          setState({ role: null, isAdmin: false, isOrganizer: false, isLoading: false });
          return;
        }

        const userRoleIds = userRoles?.map(ur => ur.role_id) || [];
        const adminRole = roles.find(r => r.name === 'admin');
        const organizerRole = roles.find(r => r.name === 'organizer');

        const isAdmin = adminRole ? userRoleIds.includes(adminRole.id) : false;
        const isOrganizer = organizerRole ? userRoleIds.includes(organizerRole.id) : false;

        // Determine highest privilege role
        let role: UserRole = null;
        if (isAdmin) {
          role = 'admin';
        } else if (isOrganizer) {
          role = 'organizer';
        }

        console.log('[useUserRole] Role check result:', {
          userId: user.id,
          role,
          isAdmin,
          isOrganizer,
        });

        setState({ role, isAdmin, isOrganizer, isLoading: false });
      } catch (err) {
        console.error('[useUserRole] Unexpected error checking user role:', err);
        setState({ role: null, isAdmin: false, isOrganizer: false, isLoading: false });
      }
    };

    checkUserRole();
  }, [user]);

  return state;
}

/**
 * Navigation items that organizers are allowed to access
 */
export const ORGANIZER_ALLOWED_PATHS = [
  '/admin/tournaments',
  '/admin/sponsors',
  '/admin/activities',
];

/**
 * Check if a path is allowed for organizers
 */
export function isPathAllowedForOrganizer(path: string): boolean {
  return ORGANIZER_ALLOWED_PATHS.some(allowedPath =>
    path === allowedPath || path.startsWith(`${allowedPath}/`)
  );
}
