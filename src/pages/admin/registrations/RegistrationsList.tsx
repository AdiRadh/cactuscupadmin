import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { Eye, Download, AlertTriangle, RefreshCw, FileCheck, FileClock, FileX } from 'lucide-react';
import { supabaseAdmin, hasAdminClient, supabase } from '@/lib/api/supabase';
import { RegistrationDetailModal } from './RegistrationDetailModal';

interface WaiverStatus {
  status: 'signed' | 'pending' | 'sent' | 'viewed' | 'declined' | 'expired' | 'error' | 'none';
  signedAt: string | null;
}

interface RegistrationWithProfile {
  id: string;
  user_id: string;
  event_year: number;
  registration_fee: number;
  payment_status: string;
  registered_at: string;
  created_at: string;
  // From profiles join
  first_name: string | null;
  last_name: string | null;
  club: string | null;
  // From auth.users (if available)
  email: string | null;
  // Waiver status
  waiver: WaiverStatus;
}

/**
 * Admin registrations list page
 * Displays all event registrations with user profile data
 * Uses service role key to bypass RLS and see all registrations
 */
export const RegistrationsList: FC = () => {
  const [registrations, setRegistrations] = useState<RegistrationWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationWithProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const adminConfigured = hasAdminClient();
  const client = supabaseAdmin ?? supabase;

  const fetchRegistrations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First, fetch all registrations
      const { data: registrationsData, error: regError } = await client
        .from('event_registrations')
        .select('id, user_id, event_year, registration_fee, payment_status, registered_at, created_at')
        .order('created_at', { ascending: false });

      if (regError) {
        console.error('Error fetching registrations:', regError);
        setError(regError.message);
        return;
      }

      if (!registrationsData || registrationsData.length === 0) {
        setRegistrations([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(registrationsData.map(r => r.user_id))];

      // Fetch profiles for those users
      const { data: profilesData, error: profilesError } = await client
        .from('profiles')
        .select('id, first_name, last_name, club')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        // Continue without profiles - still show registrations
      }

      // Fetch waiver signings for those users
      const { data: waiverData, error: waiverError } = await client
        .from('waiver_signings')
        .select('user_id, status, signed_at, event_year')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      if (waiverError) {
        console.error('Error fetching waiver signings:', waiverError);
        // Continue without waiver data
      }

      // Create a map of user_id -> profile
      const profilesMap = new Map<string, { first_name: string; last_name: string; club: string }>();
      (profilesData || []).forEach(profile => {
        profilesMap.set(profile.id, {
          first_name: profile.first_name,
          last_name: profile.last_name,
          club: profile.club,
        });
      });

      // Create a map of user_id+event_year -> waiver status (most recent signing per user/year)
      const waiverMap = new Map<string, WaiverStatus>();
      (waiverData || []).forEach(signing => {
        const key = `${signing.user_id}-${signing.event_year}`;
        // Only keep the first (most recent) signing for each user/year
        if (!waiverMap.has(key)) {
          waiverMap.set(key, {
            status: signing.status as WaiverStatus['status'],
            signedAt: signing.signed_at,
          });
        }
      });

      // Combine registrations with profile and waiver data
      const combinedData = registrationsData.map((reg) => {
        const profile = profilesMap.get(reg.user_id);
        const waiverKey = `${reg.user_id}-${reg.event_year}`;
        const waiver = waiverMap.get(waiverKey) || { status: 'none' as const, signedAt: null };
        return {
          id: reg.id,
          user_id: reg.user_id,
          event_year: reg.event_year,
          registration_fee: reg.registration_fee,
          payment_status: reg.payment_status,
          registered_at: reg.registered_at,
          created_at: reg.created_at,
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          club: profile?.club ?? null,
          email: null, // Can't easily get email from auth.users in client
          waiver,
        };
      });

      setRegistrations(combinedData);
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Paid</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'refunded':
      case 'partially_refunded':
        return <Badge variant="secondary">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWaiverBadge = (waiver: WaiverStatus) => {
    switch (waiver.status) {
      case 'signed':
        return (
          <Badge variant="success" className="gap-1">
            <FileCheck className="h-3 w-3" />
            Signed
          </Badge>
        );
      case 'pending':
      case 'sent':
      case 'viewed':
        return (
          <Badge variant="warning" className="gap-1">
            <FileClock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="destructive" className="gap-1">
            <FileX className="h-3 w-3" />
            Declined
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="secondary" className="gap-1">
            <FileClock className="h-3 w-3" />
            Expired
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <FileX className="h-3 w-3" />
            Error
          </Badge>
        );
      case 'none':
      default:
        return (
          <Badge className="gap-1 bg-black text-white border-white/20">
            <FileX className="h-3 w-3" />
            None
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleViewRegistration = (registration: RegistrationWithProfile) => {
    setSelectedRegistration(registration);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Registrations</h1>
          <p className="text-white/80 mt-2">
            View and manage event registrations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRegistrations} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Warning if admin client not configured */}
      {!adminConfigured && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-500">Service Role Key Not Configured</p>
                <p className="text-sm text-yellow-500/80 mt-1">
                  Add <code className="bg-black/20 px-1 rounded">VITE_SUPABASE_SERVICE_ROLE_KEY</code> to your .env file to bypass RLS and view all registrations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-500">Error Loading Registrations</p>
                <p className="text-sm text-red-500/80 mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registrations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Registrations ({registrations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-white">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading registrations...
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8 text-white">
              {error
                ? 'Failed to load registrations.'
                : adminConfigured
                ? 'No registrations found.'
                : 'No registrations visible. Configure the service role key to bypass RLS.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Club
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Year
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Fee
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Payment
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Waiver
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Registered
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((registration) => (
                    <tr
                      key={registration.id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => handleViewRegistration(registration)}
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-white">
                          {registration.first_name && registration.last_name
                            ? `${registration.first_name} ${registration.last_name}`
                            : <span className="text-white/50">Unknown User</span>}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {registration.club || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {registration.event_year}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {formatCurrency(registration.registration_fee)}
                      </td>
                      <td className="py-3 px-4">
                        {getPaymentBadge(registration.payment_status)}
                      </td>
                      <td className="py-3 px-4">
                        {getWaiverBadge(registration.waiver)}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {formatDate(registration.registered_at || registration.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewRegistration(registration);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration Detail Modal */}
      <RegistrationDetailModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        registration={selectedRegistration}
      />
    </div>
  );
};
