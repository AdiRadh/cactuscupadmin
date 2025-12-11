import type { FC, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, useUserRole, isPathAllowedForOrganizer } from '@/hooks';
import { Card, CardContent } from '@/components/ui';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

/**
 * Protected route wrapper for admin pages
 * Redirects to login if not authenticated
 * Shows unauthorized message if authenticated but not an admin or organizer
 * Organizers can only access specific sections (Tournaments, Sponsors & Vendors, Activities)
 */
export const ProtectedAdminRoute: FC<ProtectedAdminRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isOrganizer, isLoading: roleLoading } = useUserRole();
  const location = useLocation();

  // Show loading state while checking auth and role status
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-turquoise-800 via-turquoise-700 to-turquoise-800 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent mb-4"></div>
            <p className="text-white">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ returnTo: window.location.pathname }} replace />;
  }

  // Check access based on role - map current path to check organizer access
  const hasAdminAccess = isAdmin;
  // For the standalone admin app, check if the path (without /admin prefix) is allowed
  const adminPathEquivalent = `/admin${location.pathname === '/' ? '' : location.pathname}`;
  const hasOrganizerAccess = isOrganizer && isPathAllowedForOrganizer(adminPathEquivalent);

  // Show unauthorized message if no valid role or organizer accessing restricted area
  if (!hasAdminAccess && !hasOrganizerAccess) {
    const isOrganizerAccessingRestrictedArea = isOrganizer && !isPathAllowedForOrganizer(adminPathEquivalent);

    return (
      <div className="min-h-screen bg-gradient-to-b from-turquoise-800 via-turquoise-700 to-turquoise-800 flex items-center justify-center px-4">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-viking font-bold text-white mb-2">
                Access Denied
              </h2>
              <p className="text-white/90 mb-6">
                {isOrganizerAccessingRestrictedArea
                  ? 'You do not have permission to access this section. Organizers can only access Tournaments, Sponsors & Vendors, and Activities.'
                  : 'You do not have permission to access this area. Admin or organizer privileges are required.'}
              </p>
              <div className="flex flex-col gap-2">
                {isOrganizerAccessingRestrictedArea && (
                  <a
                    href="/tournaments"
                    className="inline-block px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                  >
                    Go to Tournaments
                  </a>
                )}
                <a
                  href="/login"
                  className="inline-block px-6 py-2 bg-turquoise-600 text-white rounded-lg hover:bg-turquoise-700 transition-colors font-medium"
                >
                  Sign In as Different User
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is authenticated and has appropriate role/access, render children
  return <>{children}</>;
};
