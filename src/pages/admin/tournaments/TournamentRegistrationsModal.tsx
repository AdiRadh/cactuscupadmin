import type { FC } from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Badge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, Users, CheckCircle2, XCircle, Mail, Building2, Award, Download } from 'lucide-react';
import { supabaseAdmin, supabase } from '@/lib/api/supabase';
import type { Tournament } from '@/types';

interface TournamentRegistration {
  registration_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  payment_status: string | null;
  registered_at: string | null;
  waiver_accepted: boolean;
  experience_level: string | null;
  club: string | null;
  order_id: string | null;
  details_completed: boolean | null;
}

interface TournamentRegistrationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament | null;
}

export const TournamentRegistrationsModal: FC<TournamentRegistrationsModalProps> = ({
  open,
  onOpenChange,
  tournament,
}) => {
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = supabaseAdmin ?? supabase;

  useEffect(() => {
    if (open && tournament) {
      fetchRegistrations();
    }
  }, [open, tournament]);

  const fetchRegistrations = async () => {
    if (!tournament) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch tournament registrations for this tournament
      const { data: regData, error: regError } = await client
        .from('tournament_registrations')
        .select('id, user_id, payment_status, registered_at, waiver_accepted, experience_level, club, order_id, details_completed')
        .eq('tournament_id', tournament.id);

      if (regError) {
        throw regError;
      }

      if (!regData || regData.length === 0) {
        setRegistrations([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(regData.map(r => r.user_id).filter(Boolean))];

      // Fetch profiles for those users
      let profilesMap = new Map<string, { first_name: string | null; last_name: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await client
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        } else if (profiles) {
          profilesMap = new Map(profiles.map(p => [p.id, p]));
        }
      }

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

      // Map registrations with user info
      const mappedRegistrations: TournamentRegistration[] = regData.map(reg => {
        const profile = profilesMap.get(reg.user_id);
        const userName = profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : profile?.first_name || profile?.last_name || 'Unknown User';

        return {
          registration_id: reg.id,
          user_id: reg.user_id,
          user_name: userName,
          user_email: emailsMap.get(reg.user_id) || 'No email',
          payment_status: reg.payment_status,
          registered_at: reg.registered_at,
          waiver_accepted: reg.waiver_accepted ?? false,
          experience_level: reg.experience_level,
          club: reg.club,
          order_id: reg.order_id,
          details_completed: reg.details_completed,
        };
      });

      setRegistrations(mappedRegistrations);
    } catch (err) {
      console.error('Error fetching tournament registrations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch registrations');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Paid</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'refunded':
        return <Badge variant="secondary">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const getExperienceBadge = (level: string | null) => {
    if (!level) return null;
    const colors: Record<string, string> = {
      beginner: 'bg-green-500/20 text-green-300 border-green-500/30',
      intermediate: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      advanced: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      expert: 'bg-red-500/20 text-red-300 border-red-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${colors[level.toLowerCase()] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
        {level}
      </span>
    );
  };

  const handleExportCSV = () => {
    if (!tournament || registrations.length === 0) return;

    const headers = ['Name', 'Email', 'Club', 'Experience Level', 'Payment Status', 'Waiver Signed', 'Registered At'];
    const rows = registrations.map(reg => [
      reg.user_name,
      reg.user_email,
      reg.club || '',
      reg.experience_level || '',
      reg.payment_status || '',
      reg.waiver_accepted ? 'Yes' : 'No',
      reg.registered_at ? new Date(reg.registered_at).toISOString() : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tournament.name.replace(/[^a-z0-9]/gi, '_')}_registrations.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!tournament) return null;

  const paidCount = registrations.filter(r => r.payment_status === 'completed').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            {tournament.name} - Registrations
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {tournament.weapon && <span className="capitalize">{tournament.weapon}</span>}
            {tournament.division && <span> - {tournament.division}</span>}
            <span className="ml-2">
              ({tournament.currentParticipants} / {tournament.maxParticipants} participants)
            </span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="ml-2 text-white">Loading registrations...</span>
          </div>
        ) : error ? (
          <div className="text-red-400 py-4">Error: {error}</div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold text-white">{registrations.length}</p>
                  <p className="text-sm text-slate-400">Total Registered</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{paidCount}</p>
                  <p className="text-sm text-slate-400">Paid</p>
                </CardContent>
              </Card>
            </div>

            {/* Export Button */}
            {registrations.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="border-slate-600 text-white hover:bg-slate-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            )}

            {/* Registrations List */}
            {registrations.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No registrations for this tournament yet.
              </div>
            ) : (
              <div className="space-y-2">
                {registrations.map((reg) => (
                  <Card key={reg.registration_id} className="bg-slate-800 border-slate-700">
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-white">{reg.user_name}</p>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                            <Mail className="h-3 w-3" />
                            <span>{reg.user_email}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {reg.club && (
                              <div className="flex items-center gap-1 text-xs text-slate-400">
                                <Building2 className="h-3 w-3" />
                                <span>{reg.club}</span>
                              </div>
                            )}
                            {reg.experience_level && (
                              <div className="flex items-center gap-1">
                                <Award className="h-3 w-3 text-slate-400" />
                                {getExperienceBadge(reg.experience_level)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div>{getPaymentBadge(reg.payment_status)}</div>
                          <div className="flex items-center gap-1 justify-end" title={reg.waiver_accepted ? 'Waiver signed' : 'Waiver not signed'}>
                            {reg.waiver_accepted ? (
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400" />
                            )}
                            <span className="text-xs text-slate-400">Waiver</span>
                          </div>
                          <p className="text-xs text-slate-500">{formatDate(reg.registered_at)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
