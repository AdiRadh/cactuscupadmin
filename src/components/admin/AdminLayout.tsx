import type { FC, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Swords,
  Calendar,
  Users,
  Hotel,
  LogOut,
  Menu,
  GraduationCap,
  UserCog,
  BookOpen,
  Settings,
  Package,
  Sparkles,
  Award,
  Mail,
  Ticket,
  HandHeart,
  FileSignature,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { useState } from 'react';
import { useUserRole, useAuth } from '@/hooks';

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

// Paths that organizers are allowed to access (without /admin prefix for this standalone app)
const ORGANIZER_ALLOWED_PATHS_STANDALONE = [
  '/tournaments',
  '/sponsors',
  '/activities',
];

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Tournaments', icon: Swords, path: '/tournaments' },
  { label: 'Activities', icon: Calendar, path: '/activities' },
  { label: 'Registrations', icon: Users, path: '/registrations' },
  { label: 'Add-Ons', icon: Package, path: '/addons' },
  { label: 'Hotel Partners', icon: Hotel, path: '/hotel-partners' },
  { label: 'Sponsors & Vendors', icon: Award, path: '/sponsors' },
  { label: 'Guest Instructors', icon: GraduationCap, path: '/guest-instructors' },
  { label: 'Organizers', icon: UserCog, path: '/organizers' },
  { label: 'About Sections', icon: BookOpen, path: '/about-sections' },
  { label: 'Volunteer', icon: HandHeart, path: '/volunteer' },
  { label: 'Special Event', icon: Sparkles, path: '/special-events' },
  { label: 'Site Settings', icon: Settings, path: '/site-settings' },
  { label: 'Event Registration', icon: Ticket, path: '/event-registration-settings' },
  { label: 'Waiver Settings', icon: FileSignature, path: '/waiver-settings' },
  { label: 'Email Templates', icon: Mail, path: '/email-templates' },
];

/**
 * Admin layout component
 * Provides navigation sidebar and content area for admin pages
 * Navigation items are filtered based on user role (admin sees all, organizer sees limited)
 */
export const AdminLayout: FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { isAdmin, isOrganizer } = useUserRole();
  const { signOut } = useAuth();

  // Filter nav items based on role
  const filteredNavItems = isAdmin
    ? navItems
    : isOrganizer
    ? navItems.filter(item => ORGANIZER_ALLOWED_PATHS_STANDALONE.includes(item.path))
    : [];

  const isActivePath = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-turquoise-700 via-turquoise-600 to-turquoise-700">
      {/* Top Header */}
      <header className="bg-turquoise-800 border-b border-turquoise-600 shadow-lg">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden text-white hover:bg-turquoise-700"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <h1 className="text-2xl font-viking text-white">
                Cactus Cup Admin
              </h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-turquoise-700"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-turquoise-800 border-r border-turquoise-600 transition-transform duration-200 ease-in-out',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            'top-[73px]' // Account for header height
          )}
        >
          <nav className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-73px)]">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.path);

              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start text-white',
                      isActive && 'bg-orange-500 text-white hover:bg-orange-600',
                      !isActive && 'hover:bg-turquoise-700'
                    )}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};
