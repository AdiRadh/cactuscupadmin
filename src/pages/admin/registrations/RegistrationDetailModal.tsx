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
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, Swords, ShoppingBag, Calendar, DollarSign } from 'lucide-react';
import { supabaseAdmin, supabase } from '@/lib/api/supabase';

interface TournamentPurchase {
  id: string;
  tournament_id: string;
  tournament_name: string;
  weapon: string | null;
  division: string | null;
  amount_paid: number | null;
  payment_status: string | null;
  registered_at: string | null;
}

interface AddonPurchase {
  id: string;
  addon_id: string | null;
  item_name: string;
  item_type: string;
  quantity: number;
  unit_price: number | null;
  total: number | null;
  variant_name: string | null;
  order_number: string | null;
  order_status: string | null;
}

interface RegistrationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: {
    id: string;
    user_id: string;
    event_year: number;
    registration_fee: number;
    payment_status: string;
    registered_at: string | null;
    first_name: string | null;
    last_name: string | null;
    club: string | null;
  } | null;
}

export const RegistrationDetailModal: FC<RegistrationDetailModalProps> = ({
  open,
  onOpenChange,
  registration,
}) => {
  const [tournaments, setTournaments] = useState<TournamentPurchase[]>([]);
  const [addons, setAddons] = useState<AddonPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = supabaseAdmin ?? supabase;

  useEffect(() => {
    if (open && registration) {
      fetchPurchaseDetails();
    }
  }, [open, registration]);

  const fetchPurchaseDetails = async () => {
    if (!registration) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch tournament registrations for this user
      const { data: tournamentData, error: tournamentError } = await client
        .from('tournament_registrations')
        .select('id, tournament_id, amount_paid, payment_status, registered_at')
        .eq('user_id', registration.user_id);

      if (tournamentError) {
        console.error('Error fetching tournament registrations:', tournamentError);
      }

      // If we have tournament registrations, fetch tournament details
      let tournamentsWithDetails: TournamentPurchase[] = [];
      if (tournamentData && tournamentData.length > 0) {
        const tournamentIds = tournamentData.map(t => t.tournament_id);
        const { data: tournamentInfo, error: infoError } = await client
          .from('tournaments')
          .select('id, name, weapon, division')
          .in('id', tournamentIds);

        if (infoError) {
          console.error('Error fetching tournament info:', infoError);
        }

        const tournamentMap = new Map(
          (tournamentInfo || []).map(t => [t.id, t])
        );

        tournamentsWithDetails = tournamentData.map(reg => {
          const info = tournamentMap.get(reg.tournament_id);
          return {
            id: reg.id,
            tournament_id: reg.tournament_id,
            tournament_name: info?.name || 'Unknown Tournament',
            weapon: info?.weapon || null,
            division: info?.division || null,
            amount_paid: reg.amount_paid,
            payment_status: reg.payment_status,
            registered_at: reg.registered_at,
          };
        });
      }
      setTournaments(tournamentsWithDetails);

      // Fetch order items (addons and other purchases) for this user
      // First get all orders for this user
      const { data: ordersData, error: ordersError } = await client
        .from('orders')
        .select('id, order_number, order_status')
        .eq('user_id', registration.user_id);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      }

      let addonPurchases: AddonPurchase[] = [];
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        const orderMap = new Map(ordersData.map(o => [o.id, o]));

        // Get order items that are addons or merchandise
        const { data: itemsData, error: itemsError } = await client
          .from('order_items')
          .select('id, order_id, addon_id, item_name, item_type, quantity, unit_price, total, variant_name')
          .in('order_id', orderIds)
          .in('item_type', ['addon', 'merchandise']);

        if (itemsError) {
          console.error('Error fetching order items:', itemsError);
        }

        addonPurchases = (itemsData || []).map(item => {
          const order = orderMap.get(item.order_id);
          return {
            id: item.id,
            addon_id: item.addon_id,
            item_name: item.item_name,
            item_type: item.item_type,
            quantity: item.quantity || 1,
            unit_price: item.unit_price,
            total: item.total,
            variant_name: item.variant_name,
            order_number: order?.order_number || null,
            order_status: order?.order_status || null,
          };
        });
      }
      setAddons(addonPurchases);

    } catch (err) {
      console.error('Error fetching purchase details:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const getWeaponBadge = (weapon: string | null) => {
    if (!weapon) return null;
    const colors: Record<string, string> = {
      longsword: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      saber: 'bg-red-500/20 text-red-300 border-red-500/30',
      rapier: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'sword-buckler': 'bg-green-500/20 text-green-300 border-green-500/30',
      cutting: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs border ${colors[weapon] || 'bg-gray-500/20 text-gray-300'}`}>
        {weapon}
      </span>
    );
  };

  if (!registration) return null;

  const userName = registration.first_name && registration.last_name
    ? `${registration.first_name} ${registration.last_name}`
    : 'Unknown User';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">{userName}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {registration.club || 'No club'} &bull; {registration.event_year} Registration
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="ml-2 text-white">Loading purchase details...</span>
          </div>
        ) : error ? (
          <div className="text-red-400 py-4">Error: {error}</div>
        ) : (
          <div className="space-y-6">
            {/* Event Registration Summary */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <span className="font-medium text-white">Event Registration</span>
                  </div>
                  {getPaymentBadge(registration.payment_status)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Registration Fee:</span>
                    <span className="ml-2 text-white">{formatCurrency(registration.registration_fee)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Registered:</span>
                    <span className="ml-2 text-white">{formatDate(registration.registered_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tournaments Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Swords className="h-5 w-5 text-slate-400" />
                <h3 className="font-semibold text-white">Tournaments ({tournaments.length})</h3>
              </div>
              {tournaments.length === 0 ? (
                <p className="text-slate-500 text-sm pl-7">No tournament registrations</p>
              ) : (
                <div className="space-y-2">
                  {tournaments.map((tournament) => (
                    <Card key={tournament.id} className="bg-slate-800 border-slate-700">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{tournament.tournament_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {getWeaponBadge(tournament.weapon)}
                              {tournament.division && (
                                <span className="text-xs text-slate-400">{tournament.division}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-medium">{formatCurrency(tournament.amount_paid)}</p>
                            {getPaymentBadge(tournament.payment_status)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Add-ons Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="h-5 w-5 text-slate-400" />
                <h3 className="font-semibold text-white">Add-ons & Merchandise ({addons.length})</h3>
              </div>
              {addons.length === 0 ? (
                <p className="text-slate-500 text-sm pl-7">No add-on purchases</p>
              ) : (
                <div className="space-y-2">
                  {addons.map((addon) => (
                    <Card key={addon.id} className="bg-slate-800 border-slate-700">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{addon.item_name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              {addon.variant_name && (
                                <span className="bg-slate-700 px-2 py-0.5 rounded">{addon.variant_name}</span>
                              )}
                              <span>Qty: {addon.quantity}</span>
                              {addon.order_number && (
                                <span>Order: {addon.order_number}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-medium">{formatCurrency(addon.total)}</p>
                            <span className="text-xs text-slate-400">
                              {formatCurrency(addon.unit_price)} each
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Total Summary */}
            <Card className="bg-slate-700 border-slate-600">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    <span className="font-semibold text-white">Total Spent</span>
                  </div>
                  <span className="text-xl font-bold text-green-400">
                    {formatCurrency(
                      registration.registration_fee +
                      tournaments.reduce((sum, t) => sum + (t.amount_paid || 0), 0) +
                      addons.reduce((sum, a) => sum + (a.total || 0), 0)
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
