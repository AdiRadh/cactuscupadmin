import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { Eye, Download, AlertTriangle, RefreshCw, FileCheck, FileClock, FileX, ShieldCheck, CheckCircle2, XCircle, ChevronDown, ChevronUp, UserPlus, Link2, Users, Ticket } from 'lucide-react';
import { supabaseAdmin, hasAdminClient, supabase } from '@/lib/api/supabase';
import { RegistrationDetailModal } from './RegistrationDetailModal';
import { AddTournamentEntryModal } from './AddTournamentEntryModal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { bulkVerifyOrdersWithStripe, syncOrderFromStripe, findMissingRegistrations, verifyRegistrationSync, type BulkVerificationSummary, type MissingRegistrationsSummary, type SyncVerificationSummary } from '@/lib/utils/stripe';

interface WaiverStatus {
  status: 'signed' | 'pending' | 'sent' | 'viewed' | 'declined' | 'expired' | 'error' | 'none';
  signedAt: string | null;
  waiverSigningId: string | null;
  boldsignDocumentId: string | null;
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
  const [isBulkVerifying, setIsBulkVerifying] = useState(false);
  const [bulkVerificationResult, setBulkVerificationResult] = useState<BulkVerificationSummary | null>(null);
  const [bulkVerificationError, setBulkVerificationError] = useState<string | null>(null);
  const [showBulkResults, setShowBulkResults] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [isFindingMissing, setIsFindingMissing] = useState(false);
  const [missingRegistrationsResult, setMissingRegistrationsResult] = useState<MissingRegistrationsSummary | null>(null);
  const [missingRegistrationsError, setMissingRegistrationsError] = useState<string | null>(null);
  const [showMissingResults, setShowMissingResults] = useState(false);
  const [expandedMissingUsers, setExpandedMissingUsers] = useState<Set<string>>(new Set());
  const [isAddTournamentModalOpen, setIsAddTournamentModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'paid' | 'spectators'>('all');
  // Registration sync verification state
  const [isVerifyingSync, setIsVerifyingSync] = useState(false);
  const [syncVerificationResult, setSyncVerificationResult] = useState<SyncVerificationSummary | null>(null);
  const [syncVerificationError, setSyncVerificationError] = useState<string | null>(null);
  const [showSyncResults, setShowSyncResults] = useState(false);
  const [expandedSyncUsers, setExpandedSyncUsers] = useState<Set<string>>(new Set());
  // Waiver download state
  const [downloadingWaiverId, setDownloadingWaiverId] = useState<string | null>(null);

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
        .order('created_at', { ascending: false })
        .limit(10000);

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
        .in('id', userIds)
        .limit(10000);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        // Continue without profiles - still show registrations
      }

      // Fetch waiver signings for those users
      const { data: waiverData, error: waiverError } = await client
        .from('waiver_signings')
        .select('id, user_id, status, signed_at, event_year, boldsign_document_id')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(10000);

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

      // Fetch user emails from auth.users using admin API
      const emailsMap = new Map<string, string>();
      if (supabaseAdmin) {
        try {
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
            perPage: 10000,
          });
          if (authError) {
            console.error('Error fetching auth users:', authError);
          } else if (authData?.users) {
            authData.users.forEach(user => {
              if (user.email) {
                emailsMap.set(user.id, user.email);
              }
            });
          }
        } catch (err) {
          console.error('Error fetching user emails:', err);
        }
      }

      // Create a map of user_id+event_year -> waiver status (most recent signing per user/year)
      const waiverMap = new Map<string, WaiverStatus>();
      (waiverData || []).forEach(signing => {
        const key = `${signing.user_id}-${signing.event_year}`;
        // Only keep the first (most recent) signing for each user/year
        if (!waiverMap.has(key)) {
          waiverMap.set(key, {
            status: signing.status as WaiverStatus['status'],
            signedAt: signing.signed_at,
            waiverSigningId: signing.id,
            boldsignDocumentId: signing.boldsign_document_id,
          });
        }
      });

      // Combine registrations with profile and waiver data
      const combinedData = registrationsData.map((reg) => {
        const profile = profilesMap.get(reg.user_id);
        const waiverKey = `${reg.user_id}-${reg.event_year}`;
        const waiver = waiverMap.get(waiverKey) || { status: 'none' as const, signedAt: null, waiverSigningId: null, boldsignDocumentId: null };
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
          email: emailsMap.get(reg.user_id) ?? null,
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

  const handleDownloadWaiver = async (registration: RegistrationWithProfile) => {
    if (!registration.waiver.waiverSigningId || !registration.waiver.boldsignDocumentId) {
      console.error('No waiver signing ID or BoldSign document ID available');
      return;
    }

    setDownloadingWaiverId(registration.waiver.waiverSigningId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('download-signed-waiver', {
        body: { waiverSigningId: registration.waiver.waiverSigningId },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to download waiver');
      }

      // The response data should be the PDF blob
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const signerName = registration.first_name && registration.last_name
        ? `${registration.first_name}_${registration.last_name}`.replace(/[^a-zA-Z0-9]/g, '_')
        : 'unknown';
      link.download = `waiver_${signerName}_${registration.event_year}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading waiver:', err);
      setError(err instanceof Error ? err.message : 'Failed to download waiver');
    } finally {
      setDownloadingWaiverId(null);
    }
  };

  const handleBulkVerify = async () => {
    setIsBulkVerifying(true);
    setBulkVerificationError(null);
    setBulkVerificationResult(null);
    setShowBulkResults(true);

    try {
      const result = await bulkVerifyOrdersWithStripe();
      setBulkVerificationResult(result);
    } catch (err) {
      console.error('Bulk verification error:', err);
      setBulkVerificationError(err instanceof Error ? err.message : 'Failed to bulk verify');
    } finally {
      setIsBulkVerifying(false);
    }
  };

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSyncOrder = async (orderId: string) => {
    setSyncingOrderId(orderId);
    try {
      const result = await syncOrderFromStripe(orderId);
      if (result.success) {
        // Re-run bulk verification to update results
        await handleBulkVerify();
      } else {
        setBulkVerificationError(result.error || 'Failed to sync order');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setBulkVerificationError(err instanceof Error ? err.message : 'Failed to sync order');
    } finally {
      setSyncingOrderId(null);
    }
  };

  const handleFindMissingRegistrations = async () => {
    setIsFindingMissing(true);
    setMissingRegistrationsError(null);
    setMissingRegistrationsResult(null);
    setShowMissingResults(true);

    try {
      const result = await findMissingRegistrations();
      setMissingRegistrationsResult(result);
    } catch (err) {
      console.error('Find missing registrations error:', err);
      setMissingRegistrationsError(err instanceof Error ? err.message : 'Failed to find missing registrations');
    } finally {
      setIsFindingMissing(false);
    }
  };

  const toggleMissingUserExpanded = (userId: string) => {
    setExpandedMissingUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleVerifyRegistrationSync = async () => {
    setIsVerifyingSync(true);
    setSyncVerificationError(null);
    setSyncVerificationResult(null);
    setShowSyncResults(true);

    try {
      const result = await verifyRegistrationSync();
      setSyncVerificationResult(result);
    } catch (err) {
      console.error('Registration sync verification error:', err);
      setSyncVerificationError(err instanceof Error ? err.message : 'Failed to verify registration sync');
    } finally {
      setIsVerifyingSync(false);
    }
  };

  const toggleSyncUserExpanded = (userId: string) => {
    setExpandedSyncUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
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
          <Button onClick={() => setIsAddTournamentModalOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Manual Entry
          </Button>
          <Button variant="outline" onClick={handleVerifyRegistrationSync} disabled={isVerifyingSync}>
            {isVerifyingSync ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Verify Registration Sync
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleFindMissingRegistrations} disabled={isFindingMissing}>
            {isFindingMissing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Find Missing Registrations
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleBulkVerify} disabled={isBulkVerifying}>
            {isBulkVerifying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Bulk Verify Stripe
              </>
            )}
          </Button>
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

      {/* Registration Sync Verification Results */}
      {showSyncResults && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowSyncResults(!showSyncResults)}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-blue-400" />
                Registration Sync Verification Results
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setShowSyncResults(false); }}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isVerifyingSync ? (
              <div className="text-center py-8 text-white">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Verifying registration sync...
              </div>
            ) : syncVerificationError ? (
              <div className="text-red-400 py-4">
                <AlertTriangle className="h-5 w-5 inline mr-2" />
                {syncVerificationError}
              </div>
            ) : syncVerificationResult ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-center">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Users</p>
                    <p className="text-xl font-bold text-white">{syncVerificationResult.totalUsersChecked}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Order Items</p>
                    <p className="text-xl font-bold text-white">{syncVerificationResult.totalOrderItems}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Registrations</p>
                    <p className="text-xl font-bold text-white">{syncVerificationResult.totalRegistrations}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Add-on Purchases</p>
                    <p className="text-xl font-bold text-white">{syncVerificationResult.totalAddonPurchases}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Users with Issues</p>
                    <p className={`text-xl font-bold ${syncVerificationResult.totalUsersWithIssues > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {syncVerificationResult.totalUsersWithIssues}
                    </p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Total Issues</p>
                    <p className={`text-xl font-bold ${(syncVerificationResult.totalMissingRegistrations + syncVerificationResult.totalOrphanedRegistrations + syncVerificationResult.totalMissingAddonLinks) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {syncVerificationResult.totalMissingRegistrations + syncVerificationResult.totalOrphanedRegistrations + syncVerificationResult.totalMissingAddonLinks}
                    </p>
                  </div>
                </div>

                {/* Registration Breakdown */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-700/50 rounded p-2">
                    <p className="text-slate-400">Tournaments</p>
                    <p className="font-semibold text-white">{syncVerificationResult.totalTournamentRegistrations}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2">
                    <p className="text-slate-400">Activities</p>
                    <p className="font-semibold text-white">{syncVerificationResult.totalActivityRegistrations}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2">
                    <p className="text-slate-400">Events</p>
                    <p className="font-semibold text-white">{syncVerificationResult.totalEventRegistrations}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2">
                    <p className="text-slate-400">Special Events</p>
                    <p className="font-semibold text-white">{syncVerificationResult.totalSpecialEventRegistrations}</p>
                  </div>
                </div>

                {/* Issue Breakdown (only show if there are issues) */}
                {(syncVerificationResult.totalMissingRegistrations > 0 || syncVerificationResult.totalOrphanedRegistrations > 0 || syncVerificationResult.totalMissingAddonLinks > 0) && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                      <p className="text-red-400">Missing Registrations</p>
                      <p className="font-semibold text-red-300">{syncVerificationResult.totalMissingRegistrations}</p>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                      <p className="text-yellow-400">Orphaned Registrations</p>
                      <p className="font-semibold text-yellow-300">{syncVerificationResult.totalOrphanedRegistrations}</p>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2">
                      <p className="text-orange-400">Missing Addon Links</p>
                      <p className="font-semibold text-orange-300">{syncVerificationResult.totalMissingAddonLinks}</p>
                    </div>
                  </div>
                )}

                {/* All Users List */}
                {syncVerificationResult.users.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400 font-medium">
                      All Users ({syncVerificationResult.users.length}):
                    </p>
                    {syncVerificationResult.users.map((user) => (
                      <Card key={user.userId} className={`border-slate-700 ${user.hasIssues ? 'bg-slate-800 border-red-500/30' : 'bg-slate-800/50'}`}>
                        <CardContent className="py-3">
                          {/* User Header */}
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleSyncUserExpanded(user.userId)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedSyncUsers.has(user.userId) ? (
                                <ChevronUp className="h-5 w-5 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-slate-400" />
                              )}
                              <div>
                                <p className="text-base font-semibold text-white">{user.userName || 'Unknown User'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Badge variant="outline" className="text-slate-300">
                                {user.orderItemsCount} items
                              </Badge>
                              <Badge variant="outline" className="text-slate-300">
                                {user.totalRegistrationsCount} regs
                              </Badge>
                              {user.addonPurchasesCount > 0 && (
                                <Badge variant="outline" className="text-slate-300">
                                  {user.addonPurchasesCount} addons
                                </Badge>
                              )}
                              {user.hasIssues ? (
                                <Badge variant="destructive">
                                  {user.issues.length} issues
                                </Badge>
                              ) : (
                                <Badge variant="success" className="bg-green-500/20 text-green-400 border-green-500/30">
                                  synced
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Issues Summary - Only show if has issues */}
                          {user.hasIssues && (
                            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                              <p className="text-sm font-medium text-red-400 mb-2">
                                Sync Issues:
                              </p>
                              <div className="space-y-1">
                                {user.issues.slice(0, 5).map((issue, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className={`${
                                      issue.issueType === 'missing_registration' ? 'text-red-300' :
                                      issue.issueType === 'orphaned_registration' ? 'text-yellow-300' :
                                      'text-orange-300'
                                    }`}>
                                      {issue.issueType === 'missing_registration' && '❌ '}
                                      {issue.issueType === 'orphaned_registration' && '⚠️ '}
                                      {issue.issueType === 'missing_addon_link' && '🔗 '}
                                      [{issue.itemType}] {issue.itemName}
                                    </span>
                                    {issue.total > 0 && (
                                      <span className="text-slate-400">{formatCurrency(issue.total)}</span>
                                    )}
                                  </div>
                                ))}
                                {user.issues.length > 5 && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    +{user.issues.length - 5} more issues...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Expanded Details */}
                          {expandedSyncUsers.has(user.userId) && (
                            <div className="mt-4 space-y-4 border-t border-slate-700 pt-3">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="bg-slate-700/50 rounded p-2">
                                  <span className="text-slate-400">Tournaments: </span>
                                  <span className="text-white font-semibold">{user.tournamentRegistrationsCount}</span>
                                </div>
                                <div className="bg-slate-700/50 rounded p-2">
                                  <span className="text-slate-400">Activities: </span>
                                  <span className="text-white font-semibold">{user.activityRegistrationsCount}</span>
                                </div>
                                <div className="bg-slate-700/50 rounded p-2">
                                  <span className="text-slate-400">Events: </span>
                                  <span className="text-white font-semibold">{user.eventRegistrationsCount}</span>
                                </div>
                                <div className="bg-slate-700/50 rounded p-2">
                                  <span className="text-slate-400">Special Events: </span>
                                  <span className="text-white font-semibold">{user.specialEventRegistrationsCount}</span>
                                </div>
                              </div>

                              <div className="text-sm">
                                <span className="text-slate-400">User ID: </span>
                                <span className="text-white font-mono text-xs">{user.userId}</span>
                              </div>

                              {/* All Issues */}
                              {user.hasIssues && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-2">All Issues ({user.issues.length}):</p>
                                  {user.issues.map((issue, idx) => (
                                    <div key={idx} className={`rounded p-3 mb-2 ${
                                      issue.issueType === 'missing_registration' ? 'bg-red-900/30 border border-red-500/30' :
                                      issue.issueType === 'orphaned_registration' ? 'bg-yellow-900/30 border border-yellow-500/30' :
                                      'bg-orange-900/30 border border-orange-500/30'
                                    }`}>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-white">{issue.itemName}</span>
                                        <Badge variant={
                                          issue.issueType === 'missing_registration' ? 'destructive' :
                                          issue.issueType === 'orphaned_registration' ? 'warning' :
                                          'secondary'
                                        }>
                                          {issue.issueType.replace(/_/g, ' ')}
                                        </Badge>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-300 mb-2">
                                        <div>Type: {issue.itemType}</div>
                                        {issue.total > 0 && <div>Amount: {formatCurrency(issue.total)}</div>}
                                        {issue.orderNumber && <div>Order: #{issue.orderNumber}</div>}
                                        {issue.registrationId && <div>Reg ID: {issue.registrationId.slice(0, 8)}...</div>}
                                      </div>
                                      <p className="text-xs text-slate-400">{issue.details}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400">
                    No users found with paid orders or registrations.
                  </div>
                )}

                {/* Success message when no issues */}
                {syncVerificationResult.totalUsersWithIssues === 0 && syncVerificationResult.users.length > 0 && (
                  <div className="text-center py-4 text-green-400 bg-green-500/10 rounded-lg border border-green-500/30">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                    All registrations and order items are properly synced!
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Missing Registrations Results */}
      {showMissingResults && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowMissingResults(!showMissingResults)}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                Missing Registrations
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setShowMissingResults(false); }}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isFindingMissing ? (
              <div className="text-center py-8 text-white">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Searching for missing registrations...
              </div>
            ) : missingRegistrationsError ? (
              <div className="text-red-400 py-4">
                <AlertTriangle className="h-5 w-5 inline mr-2" />
                {missingRegistrationsError}
              </div>
            ) : missingRegistrationsResult ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Users Affected</p>
                    <p className="text-xl font-bold text-orange-400">{missingRegistrationsResult.totalUsersAffected}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Missing Registrations</p>
                    <p className="text-xl font-bold text-red-400">{missingRegistrationsResult.totalMissingRegistrations}</p>
                  </div>
                </div>

                {/* Users with Missing Registrations */}
                {missingRegistrationsResult.users.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400 font-medium">
                      Users with Missing Registrations ({missingRegistrationsResult.users.length}):
                    </p>
                    {missingRegistrationsResult.users.map((user) => (
                      <Card key={user.userId} className="bg-slate-800 border-slate-700">
                        <CardContent className="py-4">
                          {/* User Header */}
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleMissingUserExpanded(user.userId)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedMissingUsers.has(user.userId) ? (
                                <ChevronUp className="h-5 w-5 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-slate-400" />
                              )}
                              <div>
                                <p className="text-lg font-semibold text-white">{user.userName || 'Unknown User'}</p>
                                {user.userEmail && (
                                  <p className="text-sm text-slate-400">{user.userEmail}</p>
                                )}
                              </div>
                            </div>
                            <Badge variant="destructive">
                              {user.missingRegistrations.length} Missing
                            </Badge>
                          </div>

                          {/* Missing Items Summary - Always Visible */}
                          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-sm font-medium text-red-400 mb-2">
                              Paid items without registrations:
                            </p>
                            <div className="space-y-1">
                              {user.missingRegistrations.map((item, idx) => (
                                <div key={item.orderItemId || `stripe-${idx}`} className="flex justify-between text-sm">
                                  <span className="text-red-300">
                                    {item.source === 'stripe_only' && '🔴 '}
                                    {item.quantity}x {item.itemName}
                                    {item.source === 'stripe_only' && (
                                      <span className="text-xs text-orange-400 ml-2">(Stripe only - not in DB)</span>
                                    )}
                                  </span>
                                  <span className="text-red-300 font-medium">
                                    {formatCurrency(item.total)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {expandedMissingUsers.has(user.userId) && (
                            <div className="mt-4 space-y-4 border-t border-slate-700 pt-3">
                              {/* Order Details */}
                              <div>
                                <p className="text-xs text-slate-500 mb-2">Item Details:</p>
                                {user.missingRegistrations.map((item, idx) => (
                                  <div key={item.orderItemId || `stripe-${idx}`} className={`rounded p-3 mb-2 ${item.source === 'stripe_only' ? 'bg-orange-900/30 border border-orange-500/30' : 'bg-slate-900'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      {item.orderNumber ? (
                                        <span className="font-medium text-white">Order #{item.orderNumber}</span>
                                      ) : (
                                        <span className="font-medium text-orange-400">⚠️ Stripe Transaction Only</span>
                                      )}
                                      <Badge variant={item.source === 'stripe_only' ? 'destructive' : 'secondary'}>
                                        {item.source === 'stripe_only' ? 'NOT IN SUPABASE' : item.itemType}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                                      <div>Item: {item.itemName}</div>
                                      <div>Qty: {item.quantity}</div>
                                      <div>Unit: {formatCurrency(item.unitPrice)}</div>
                                      <div>Total: {formatCurrency(item.total)}</div>
                                    </div>
                                    {item.stripeSessionId && (
                                      <div className="text-xs text-slate-500 mt-2">
                                        Session: {item.stripeSessionId}
                                      </div>
                                    )}
                                    <div className="text-xs text-slate-500 mt-1">
                                      Created: {new Date(item.createdAt).toLocaleString()}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Stripe Transactions */}
                              {user.stripeTransactions.length > 0 && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-2">Stripe Transactions:</p>
                                  {user.stripeTransactions.map((tx) => (
                                    <div key={tx.id} className="bg-slate-900 rounded p-3 mb-2">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-white text-xs">{tx.id}</span>
                                        <span className="text-green-400 font-medium">
                                          {formatCurrency(tx.amount)}
                                        </span>
                                      </div>
                                      {tx.lineItems.length > 0 && (
                                        <div className="space-y-1">
                                          {tx.lineItems.map((lineItem, idx) => (
                                            <div key={idx} className="flex justify-between text-xs text-slate-400">
                                              <span>{lineItem.quantity}x {lineItem.name}</span>
                                              <span>{formatCurrency(lineItem.amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-green-400">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                    All paid orders have their registrations properly linked!
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Bulk Verification Results */}
      {showBulkResults && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowBulkResults(!showBulkResults)}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Stripe Verification Results
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setShowBulkResults(false); }}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isBulkVerifying ? (
              <div className="text-center py-8 text-white">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Verifying all orders with Stripe...
              </div>
            ) : bulkVerificationError ? (
              <div className="text-red-400 py-4">
                <AlertTriangle className="h-5 w-5 inline mr-2" />
                {bulkVerificationError}
              </div>
            ) : bulkVerificationResult ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 text-center">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Users</p>
                    <p className="text-xl font-bold text-white">{bulkVerificationResult.totalUsers}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Orders</p>
                    <p className="text-xl font-bold text-white">{bulkVerificationResult.totalOrders}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Matched</p>
                    <p className="text-xl font-bold text-green-400">{bulkVerificationResult.matchedOrders}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Mismatched</p>
                    <p className="text-xl font-bold text-red-400">{bulkVerificationResult.mismatchedOrders}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Pending</p>
                    <p className="text-xl font-bold text-yellow-400">{bulkVerificationResult.pendingOrders}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">No Stripe</p>
                    <p className="text-xl font-bold text-orange-400">{bulkVerificationResult.noStripeDataOrders}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Errors</p>
                    <p className="text-xl font-bold text-red-400">{bulkVerificationResult.errorOrders}</p>
                  </div>
                </div>

                {/* Users with Issues */}
                {bulkVerificationResult.userResults.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400 font-medium">Users with Discrepancies ({bulkVerificationResult.userResults.length}):</p>
                    {bulkVerificationResult.userResults.map((userResult) => {
                      // Calculate items in Stripe but not in DB for this user
                      const allStripeItems = userResult.result.orders
                        .filter(o => o.stripeItems && o.stripeItems.length > 0)
                        .flatMap(o => o.stripeItems || []);
                      const allDbItems = userResult.result.orders.flatMap(o => o.dbItems);
                      const dbItemNames = new Set(allDbItems.map(i => i.name.toLowerCase()));
                      const missingFromDb = allStripeItems.filter(
                        item => !dbItemNames.has(item.name.toLowerCase())
                      );

                      return (
                        <Card key={userResult.userId} className="bg-slate-800 border-slate-700">
                          <CardContent className="py-4">
                            {/* User Header - More Prominent */}
                            <div
                              className="flex items-center justify-between cursor-pointer"
                              onClick={() => toggleUserExpanded(userResult.userId)}
                            >
                              <div className="flex items-center gap-3">
                                {expandedUsers.has(userResult.userId) ? (
                                  <ChevronUp className="h-5 w-5 text-slate-400" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-slate-400" />
                                )}
                                <div>
                                  <p className="text-lg font-semibold text-white">{userResult.userName || 'Unknown User'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {userResult.result.mismatchedOrders > 0 && (
                                  <Badge variant="destructive">{userResult.result.mismatchedOrders} Mismatch</Badge>
                                )}
                                {userResult.result.errorOrders > 0 && (
                                  <Badge variant="destructive">{userResult.result.errorOrders} Error</Badge>
                                )}
                                {userResult.result.noStripeDataOrders > 0 && (
                                  <Badge variant="secondary">{userResult.result.noStripeDataOrders} No Data</Badge>
                                )}
                              </div>
                            </div>

                            {/* Products Missing from System - Always Visible Summary */}
                            {missingFromDb.length > 0 && (
                              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <p className="text-sm font-medium text-red-400 mb-2">
                                  ⚠️ Products in Stripe NOT in System ({missingFromDb.length}):
                                </p>
                                <div className="space-y-1">
                                  {missingFromDb.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                      <span className="text-red-300">
                                        {item.quantity}x {item.name}
                                      </span>
                                      <span className="text-red-300 font-medium">
                                        {formatCurrency(item.total)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Expanded Order Details */}
                            {expandedUsers.has(userResult.userId) && (
                              <div className="mt-4 space-y-2 border-t border-slate-700 pt-3">
                                <p className="text-xs text-slate-500 mb-2">Order Details:</p>
                                {userResult.result.orders.map((order) => (
                                  <div key={order.orderId} className="bg-slate-900 rounded p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        {order.status === 'match' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                                        {order.status === 'mismatch' && <XCircle className="h-4 w-4 text-red-400" />}
                                        {order.status === 'error' && <AlertTriangle className="h-4 w-4 text-red-400" />}
                                        {order.status === 'no_stripe_data' && <AlertTriangle className="h-4 w-4 text-orange-400" />}
                                        {order.status === 'pending' && <FileCheck className="h-4 w-4 text-yellow-400" />}
                                        <span className="font-medium text-white">Order #{order.orderNumber}</span>
                                      </div>
                                      <Badge
                                        variant={
                                          order.status === 'match' ? 'success' :
                                          order.status === 'mismatch' ? 'destructive' :
                                          order.status === 'pending' ? 'warning' :
                                          'secondary'
                                        }
                                      >
                                        {order.status === 'no_stripe_data' ? 'No Stripe Data' : order.status}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="text-slate-400">DB Total: </span>
                                        <span className="text-white">{formatCurrency(order.dbTotal)}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400">Stripe Total: </span>
                                        <span className="text-white">
                                          {order.stripeTotal !== null ? formatCurrency(order.stripeTotal) : 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                    {order.errorMessage && (
                                      <p className="text-xs text-red-400 mt-2">{order.errorMessage}</p>
                                    )}
                                    {order.stripeItems && order.stripeItems.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-slate-700">
                                        <p className="text-xs text-slate-400 mb-2">Stripe Purchases:</p>
                                        <div className="space-y-1">
                                          {order.stripeItems.map((item, idx) => {
                                            const isInDb = order.dbItems.some(
                                              dbItem => dbItem.name.toLowerCase() === item.name.toLowerCase()
                                            );
                                            return (
                                              <div key={idx} className={`flex justify-between text-xs p-1 rounded ${!isInDb ? 'bg-red-500/20' : ''}`}>
                                                <span className={isInDb ? 'text-slate-300' : 'text-red-300'}>
                                                  {!isInDb && '❌ '}{item.quantity}x {item.name}
                                                </span>
                                                <span className={isInDb ? 'text-slate-300' : 'text-red-300'}>
                                                  {formatCurrency(item.total)}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {order.status === 'mismatch' && (
                                          <div className="mt-3 flex justify-end">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSyncOrder(order.orderId);
                                              }}
                                              disabled={syncingOrderId === order.orderId}
                                              className="text-xs"
                                            >
                                              {syncingOrderId === order.orderId ? (
                                                <>
                                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                  Syncing...
                                                </>
                                              ) : (
                                                <>
                                                  <RefreshCw className="h-3 w-3 mr-1" />
                                                  Sync from Stripe
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-green-400">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                    All orders are verified and match Stripe records!
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Registrations Table with Tabs */}
      {(() => {
        // Filter registrations based on active tab
        const paidRegistrations = registrations.filter(r => r.registration_fee > 0);
        const spectatorRegistrations = registrations.filter(r => r.registration_fee === 0);

        const getFilteredRegistrations = () => {
          switch (activeTab) {
            case 'paid':
              return paidRegistrations;
            case 'spectators':
              return spectatorRegistrations;
            default:
              return registrations;
          }
        };

        const filteredRegistrations = getFilteredRegistrations();

        const renderTable = (regs: RegistrationWithProfile[]) => (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-3 px-4 font-semibold text-white">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-white">
                    Email
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
                {regs.map((registration) => (
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
                    <td className="py-3 px-4 text-white/70 text-sm">
                      {registration.email || <span className="text-white/30">—</span>}
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
                      <div className="flex items-center gap-2">
                        {getWaiverBadge(registration.waiver)}
                        {registration.waiver.status === 'signed' && registration.waiver.boldsignDocumentId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Download signed waiver"
                            disabled={downloadingWaiverId === registration.waiver.waiverSigningId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadWaiver(registration);
                            }}
                          >
                            {downloadingWaiverId === registration.waiver.waiverSigningId ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
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
        );

        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Registrations</CardTitle>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                  <TabsList>
                    <TabsTrigger value="all" className="gap-2">
                      <Users className="h-4 w-4" />
                      All ({registrations.length})
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="gap-2">
                      <Ticket className="h-4 w-4" />
                      Event Registrations ({paidRegistrations.length})
                    </TabsTrigger>
                    <TabsTrigger value="spectators" className="gap-2">
                      <Eye className="h-4 w-4" />
                      Spectators ({spectatorRegistrations.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-white">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading registrations...
                </div>
              ) : filteredRegistrations.length === 0 ? (
                <div className="text-center py-8 text-white">
                  {error
                    ? 'Failed to load registrations.'
                    : adminConfigured
                    ? activeTab === 'all'
                      ? 'No registrations found.'
                      : activeTab === 'paid'
                      ? 'No paid event registrations found.'
                      : 'No spectator registrations found.'
                    : 'No registrations visible. Configure the service role key to bypass RLS.'}
                </div>
              ) : (
                renderTable(filteredRegistrations)
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Registration Detail Modal */}
      <RegistrationDetailModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        registration={selectedRegistration}
      />

      {/* Add Tournament Entry Modal */}
      <AddTournamentEntryModal
        open={isAddTournamentModalOpen}
        onOpenChange={setIsAddTournamentModalOpen}
        onSuccess={fetchRegistrations}
      />
    </div>
  );
};
