import type { FC } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Swords, Calendar, Users, DollarSign, Mail, FileEdit } from 'lucide-react';
import {
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendTournamentRegistrationEmail,
  sendActivityRegistrationEmail,
  sendSpecialEventRegistrationEmail,
  sendInventoryNotificationEmail
} from '@/lib/utils/email';

/**
 * Admin dashboard page
 * Overview of key metrics and recent activity
 */
export const AdminDashboard: FC = () => {
  const navigate = useNavigate();
  const [testEmail, setTestEmail] = useState('');
  const [emailType, setEmailType] = useState<'basic' | 'welcome' | 'order' | 'tournament' | 'activity' | 'special_event' | 'inventory'>('basic');
  const [testName, setTestName] = useState('Test User');
  const [isSending, setIsSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setEmailStatus({ type: 'error', message: 'Please enter a valid email address' });
      return;
    }

    setIsSending(true);
    setEmailStatus(null);

    try {
      let result;

      switch (emailType) {
        case 'welcome':
          result = await sendWelcomeEmail(testEmail, testName);
          break;

        case 'order':
          result = await sendOrderConfirmationEmail(
            testEmail,
            testName,
            'ORDER-12345',
            20000, // Order total in cents ($200.00)
            [
              { name: 'Longsword Tournament', quantity: 1, price: 75.00 },
              { name: 'Rapier Tournament', quantity: 1, price: 75.00 },
              { name: 'Event T-Shirt', quantity: 2, price: 25.00 }
            ]
          );
          break;

        case 'tournament':
          result = await sendTournamentRegistrationEmail(
            testEmail,
            testName,
            'Test Longsword Tournament',
            'July 17, 2026',
            '9:00 AM',
            'Open longsword tournament with multiple skill divisions'
          );
          break;

        case 'activity':
          result = await sendActivityRegistrationEmail(
            testEmail,
            testName,
            'Test Cutting Workshop',
            'July 18, 2026',
            '2:00 PM',
            'Learn proper cutting techniques with expert instruction'
          );
          break;

        case 'special_event':
          result = await sendSpecialEventRegistrationEmail(
            testEmail,
            testName,
            'Test Opening Ceremony',
            'July 17, 2026',
            '8:00 AM',
            0 // Free event
          );
          break;

        case 'inventory':
          result = await sendInventoryNotificationEmail(
            testEmail,
            'tournament',
            'Test Longsword Tournament',
            45,
            50,
            90.0
          );
          break;

        case 'basic':
        default:
          result = await sendEmail({
            to: testEmail,
            from: 'info@cactuscuphema.com',
            subject: 'Test Email from Cactus Cup Admin',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Test Email</h1>
                <p>This is a test email from the Cactus Cup admin panel.</p>
                <p>If you received this, your email integration is working correctly!</p>
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  Sent from: info@cactuscuphema.com<br>
                  Time: ${new Date().toLocaleString()}
                </p>
              </div>
            `,
            text: `Test Email\n\nThis is a test email from the Cactus Cup admin panel.\n\nIf you received this, your email integration is working correctly!\n\nSent from: info@cactuscuphema.com\nTime: ${new Date().toLocaleString()}`,
          });
          break;
      }

      if (result.success) {
        setEmailStatus({ type: 'success', message: 'Test email sent successfully!' });
      } else {
        setEmailStatus({ type: 'error', message: result.error || 'Failed to send email' });
      }
    } catch (error) {
      setEmailStatus({ type: 'error', message: error instanceof Error ? error.message : 'Failed to send email' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-viking text-white">Dashboard</h1>
        <p className="text-orange-200 mt-2">
          Welcome to the Cactus Cup admin panel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Tournaments
            </CardTitle>
            <Swords className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">12</div>
            <p className="text-xs text-white/70 mt-1">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Activities
            </CardTitle>
            <Calendar className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">24</div>
            <p className="text-xs text-white/70 mt-1">
              Workshops & events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Registrations
            </CardTitle>
            <Users className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">156</div>
            <p className="text-xs text-white/70 mt-1">
              +23 this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">$12,450</div>
            <p className="text-xs text-white/70 mt-1">
              Registration fees
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
            <CardDescription>Latest participant sign-ups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="font-medium text-white">John Smith</p>
                  <p className="text-sm text-white/70">Longsword Tournament</p>
                </div>
                <span className="text-sm text-white/60">2 hours ago</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="font-medium text-white">Sarah Johnson</p>
                  <p className="text-sm text-white/70">Cutting Workshop</p>
                </div>
                <span className="text-sm text-white/60">5 hours ago</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Mike Davis</p>
                  <p className="text-sm text-white/70">Saber Tournament</p>
                </div>
                <span className="text-sm text-white/60">1 day ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common admin tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/tournaments/create')}
                className="w-full text-left px-4 py-3 rounded-lg border border-white/20 hover:bg-white/5 transition-colors"
              >
                <p className="font-medium text-white">Add New Tournament</p>
                <p className="text-sm text-white/70">Create a new tournament event</p>
              </button>
              <button
                onClick={() => navigate('/activities/create')}
                className="w-full text-left px-4 py-3 rounded-lg border border-white/20 hover:bg-white/5 transition-colors"
              >
                <p className="font-medium text-white">Add Activity</p>
                <p className="text-sm text-white/70">Schedule a workshop or class</p>
              </button>
              <button
                onClick={() => navigate('/email-templates')}
                className="w-full text-left px-4 py-3 rounded-lg border border-white/20 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileEdit className="h-4 w-4 text-turquoise-400" />
                  <div>
                    <p className="font-medium text-white">Edit Email Templates</p>
                    <p className="text-sm text-white/70">Customize email content and variables</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => navigate('/registrations')}
                className="w-full text-left px-4 py-3 rounded-lg border border-white/20 hover:bg-white/5 transition-colors"
              >
                <p className="font-medium text-white">View All Registrations</p>
                <p className="text-sm text-white/70">Manage participant registrations</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Email Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-orange-400" />
            Test Email Integration
          </CardTitle>
          <CardDescription>Send a test email to verify Resend integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Email Type Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Email Template</label>
              <select
                value={emailType}
                onChange={(e) => setEmailType(e.target.value as any)}
                className="w-full px-4 py-2 rounded-lg border border-white/20 bg-white/90 text-gray-900 focus:outline-none focus:border-orange-400 transition-colors"
                disabled={isSending}
              >
                <option value="basic">Basic Test Email</option>
                <option value="welcome">Welcome Email</option>
                <option value="order">Order Confirmation</option>
                <option value="tournament">Tournament Registration</option>
                <option value="activity">Activity Registration</option>
                <option value="special_event">Special Event Registration</option>
                <option value="inventory">Inventory Notification (Admin)</option>
              </select>
            </div>

            {/* Name field (for personalized emails) */}
            {emailType !== 'basic' && emailType !== 'inventory' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Recipient Name</label>
                <input
                  type="text"
                  placeholder="Enter recipient name"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 transition-colors"
                  disabled={isSending}
                />
              </div>
            )}

            {/* Email field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Email Address</label>
              <input
                type="email"
                placeholder="Enter email address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-400 transition-colors"
                disabled={isSending}
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleSendTestEmail}
              disabled={isSending}
              className="w-full px-6 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? 'Sending...' : 'Send Test Email'}
            </button>

            {emailStatus && (
              <div className={`p-3 rounded-lg ${emailStatus.type === 'success' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                <p className={`text-sm ${emailStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {emailStatus.message}
                </p>
              </div>
            )}
            <div className="text-sm text-white/60">
              <p>This will send a test email from: <span className="text-orange-400">info@cactuscuphema.com</span></p>
              <p className="mt-1">Make sure this domain is verified in your Resend dashboard.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
