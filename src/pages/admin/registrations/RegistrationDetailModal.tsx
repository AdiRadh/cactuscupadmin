import type { FC } from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Loader2, Swords, ShoppingBag, Calendar, DollarSign, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Trash2, Plus } from 'lucide-react';
import { supabaseAdmin, supabase } from '@/lib/api/supabase';
import {
  verifyOrdersWithStripe,
  syncOrderFromStripe,
  removeTournamentRegistration,
  removeOrderItem,
  removeEventRegistration,
  type StripeVerificationResult,
  type OrderVerificationItem,
} from '@/lib/utils/stripe';
import { AddTournamentEntryModal } from './AddTournamentEntryModal';

interface TournamentPurchase {
  id: string;
  tournament_id: string;
  tournament_name: string;
  weapon: string | null;
  division: string | null;
  amount_paid: number | null;
  payment_status: string | null;
  registered_at: string | null;
  stripe_payment_intent_id: string | null;
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
  order_id: string | null;
}

type RemoveItemType = 'tournament' | 'addon' | 'registration';

interface RemoveDialogState {
  open: boolean;
  type: RemoveItemType;
  itemId: string;
  itemName: string;
  additionalId?: string; // tournament_id for tournaments, addon_id for addons
  quantity?: number;
  orderId?: string;
  paymentIntentId?: string;
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
    email: string | null;
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<StripeVerificationResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [removeDialog, setRemoveDialog] = useState<RemoveDialogState>({
    open: false,
    type: 'tournament',
    itemId: '',
    itemName: '',
  });
  const [shouldRefund, setShouldRefund] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isAddTournamentModalOpen, setIsAddTournamentModalOpen] = useState(false);

  const client = supabaseAdmin ?? supabase;

  useEffect(() => {
    if (open && registration) {
      fetchPurchaseDetails();
      // Reset verification state when opening for a new registration
      setVerificationResult(null);
      setVerificationError(null);
    }
  }, [open, registration]);

  const handleVerifyStripe = async () => {
    if (!registration) return;

    setIsVerifying(true);
    setVerificationError(null);
    setVerificationResult(null);

    try {
      const result = await verifyOrdersWithStripe(registration.user_id);
      setVerificationResult(result);
    } catch (err) {
      console.error('Verification error:', err);
      setVerificationError(err instanceof Error ? err.message : 'Failed to verify with Stripe');
    } finally {
      setIsVerifying(false);
    }
  };

  const getVerificationStatusIcon = (status: OrderVerificationItem['status']) => {
    switch (status) {
      case 'match':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'mismatch':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'no_stripe_data':
        return <AlertTriangle className="h-4 w-4 text-orange-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getVerificationStatusBadge = (status: OrderVerificationItem['status']) => {
    switch (status) {
      case 'match':
        return <Badge variant="success">Match</Badge>;
      case 'mismatch':
        return <Badge variant="destructive">Mismatch</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'no_stripe_data':
        return <Badge variant="secondary">No Stripe Data</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSyncFromStripe = async (orderId: string) => {
    setSyncingOrderId(orderId);

    try {
      const result = await syncOrderFromStripe(orderId);
      if (result.success) {
        // Re-verify to show updated results
        await handleVerifyStripe();
        // Also refresh purchase details to update the UI
        await fetchPurchaseDetails();
      } else {
        setVerificationError(result.error || 'Failed to sync order');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setVerificationError(err instanceof Error ? err.message : 'Failed to sync from Stripe');
    } finally {
      setSyncingOrderId(null);
    }
  };

  const openRemoveDialog = (
    type: RemoveItemType,
    itemId: string,
    itemName: string,
    additionalId?: string,
    quantity?: number,
    orderId?: string,
    paymentIntentId?: string
  ) => {
    setRemoveDialog({
      open: true,
      type,
      itemId,
      itemName,
      additionalId,
      quantity,
      orderId,
      paymentIntentId,
    });
    setShouldRefund(false);
    setRemoveError(null);
  };

  const closeRemoveDialog = () => {
    setRemoveDialog({
      open: false,
      type: 'tournament',
      itemId: '',
      itemName: '',
    });
    setShouldRefund(false);
    setRemoveError(null);
  };

  const handleRemoveItem = async () => {
    setIsRemoving(true);
    setRemoveError(null);

    try {
      let result;

      switch (removeDialog.type) {
        case 'tournament':
          result = await removeTournamentRegistration(
            removeDialog.itemId,
            removeDialog.additionalId || '',
            shouldRefund,
            removeDialog.paymentIntentId
          );
          break;
        case 'addon':
          result = await removeOrderItem(
            removeDialog.itemId,
            removeDialog.additionalId || null,
            removeDialog.quantity || 1,
            shouldRefund,
            removeDialog.orderId
          );
          break;
        case 'registration':
          result = await removeEventRegistration(
            removeDialog.itemId,
            shouldRefund
          );
          break;
        default:
          throw new Error('Unknown item type');
      }

      if (!result.success) {
        setRemoveError(result.error || 'Failed to remove item');
        return;
      }

      if (result.refundResult && !result.refundResult.success) {
        setRemoveError(`Item removed but refund failed: ${result.refundResult.error}`);
      }

      // Refresh the data
      await fetchPurchaseDetails();
      closeRemoveDialog();
    } catch (err) {
      console.error('Remove error:', err);
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove item');
    } finally {
      setIsRemoving(false);
    }
  };

  const fetchPurchaseDetails = async () => {
    if (!registration) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch tournament registrations for this user
      const { data: tournamentData, error: tournamentError } = await client
        .from('tournament_registrations')
        .select('id, tournament_id, amount_paid, payment_status, registered_at, stripe_payment_intent_id')
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
            stripe_payment_intent_id: reg.stripe_payment_intent_id || null,
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
            order_id: item.order_id || null,
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
            {registration.email && (
              <span className="block text-slate-300">{registration.email}</span>
            )}
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
                  <div className="flex items-center gap-2">
                    {getPaymentBadge(registration.payment_status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => openRemoveDialog(
                        'registration',
                        registration.id,
                        'Event Registration'
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-slate-400" />
                  <h3 className="font-semibold text-white">Tournaments ({tournaments.length})</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddTournamentModalOpen(true)}
                  className="border-slate-600 text-white hover:bg-slate-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Tournament
                </Button>
              </div>
              {tournaments.length === 0 ? (
                <p className="text-slate-500 text-sm pl-7">No tournament registrations</p>
              ) : (
                <div className="space-y-2">
                  {tournaments.map((tournament) => (
                    <Card key={tournament.id} className="bg-slate-800 border-slate-700">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-white">{tournament.tournament_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {getWeaponBadge(tournament.weapon)}
                              {tournament.division && (
                                <span className="text-xs text-slate-400">{tournament.division}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right mr-3">
                            <p className="text-white font-medium">{formatCurrency(tournament.amount_paid)}</p>
                            {getPaymentBadge(tournament.payment_status)}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => openRemoveDialog(
                              'tournament',
                              tournament.id,
                              tournament.tournament_name,
                              tournament.tournament_id,
                              undefined,
                              undefined,
                              tournament.stripe_payment_intent_id || undefined
                            )}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                          <div className="flex-1">
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
                          <div className="text-right mr-3">
                            <p className="text-white font-medium">{formatCurrency(addon.total)}</p>
                            <span className="text-xs text-slate-400">
                              {formatCurrency(addon.unit_price)} each
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => openRemoveDialog(
                              'addon',
                              addon.id,
                              addon.item_name,
                              addon.addon_id || undefined,
                              addon.quantity,
                              addon.order_id || undefined
                            )}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

            {/* Stripe Verification Section */}
            <div className="pt-4 border-t border-slate-600">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                  <h3 className="font-semibold text-white">Stripe Verification</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyStripe}
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Verify with Stripe
                    </>
                  )}
                </Button>
              </div>

              {verificationError && (
                <Card className="bg-red-500/10 border-red-500/30">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">{verificationError}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {verificationResult && (
                <div className="space-y-3">
                  {/* Summary */}
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-sm">
                        <div>
                          <p className="text-slate-400">Total Orders</p>
                          <p className="font-semibold text-white">{verificationResult.totalOrders}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Matched</p>
                          <p className="font-semibold text-green-400">{verificationResult.matchedOrders}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Mismatched</p>
                          <p className="font-semibold text-red-400">{verificationResult.mismatchedOrders}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Pending</p>
                          <p className="font-semibold text-yellow-400">{verificationResult.pendingOrders}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">No Data</p>
                          <p className="font-semibold text-orange-400">{verificationResult.noStripeDataOrders}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Individual Order Results */}
                  {verificationResult.orders.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-400">Order Details:</p>
                      {verificationResult.orders.map((order) => (
                        <Card key={order.orderId} className="bg-slate-800 border-slate-700">
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getVerificationStatusIcon(order.status)}
                                <span className="font-medium text-white">
                                  Order #{order.orderNumber}
                                </span>
                              </div>
                              {getVerificationStatusBadge(order.status)}
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
                            {order.status === 'mismatch' && order.stripeItems && (
                              <div className="mt-3 pt-3 border-t border-slate-700">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <p className="text-slate-400 mb-1">DB Items ({order.dbItems.length}):</p>
                                    {order.dbItems.map((item, idx) => (
                                      <p key={idx} className="text-slate-300">
                                        {item.quantity}x {item.name} - {formatCurrency(item.total)}
                                      </p>
                                    ))}
                                  </div>
                                  <div>
                                    <p className="text-slate-400 mb-1">Stripe Items ({order.stripeItems.length}):</p>
                                    {order.stripeItems.map((item, idx) => (
                                      <p key={idx} className="text-slate-300">
                                        {item.quantity}x {item.name} - {formatCurrency(item.total)}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSyncFromStripe(order.orderId)}
                                    disabled={syncingOrderId === order.orderId}
                                    className="text-xs"
                                  >
                                    {syncingOrderId === order.orderId ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
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
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {verificationResult.orders.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">
                      No orders found for this user.
                    </p>
                  )}
                </div>
              )}

              {!verificationResult && !verificationError && !isVerifying && (
                <p className="text-sm text-slate-500 text-center py-4">
                  Click "Verify with Stripe" to compare order items with Stripe transactions.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {/* Add Tournament Entry Modal */}
      <AddTournamentEntryModal
        open={isAddTournamentModalOpen}
        onOpenChange={setIsAddTournamentModalOpen}
        onSuccess={fetchPurchaseDetails}
        preselectedUser={registration ? {
          id: registration.user_id,
          firstName: registration.first_name,
          lastName: registration.last_name,
        } : null}
      />

      {/* Remove Item Confirmation Dialog */}
      <AlertDialog open={removeDialog.open} onOpenChange={(open) => !open && closeRemoveDialog()}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove {removeDialog.type === 'registration' ? 'Registration' : removeDialog.type === 'tournament' ? 'Tournament' : 'Item'}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to remove <span className="font-medium text-white">{removeDialog.itemName}</span>?
              {removeDialog.type === 'addon' && ' Inventory will be restored.'}
              {removeDialog.type === 'tournament' && ' Tournament capacity will be restored.'}
              {removeDialog.type === 'registration' && ' This will remove the event registration entry.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center space-x-2 py-4">
            <Checkbox
              id="refund"
              checked={shouldRefund}
              onCheckedChange={(checked) => setShouldRefund(checked === true)}
            />
            <label
              htmlFor="refund"
              className="text-sm font-medium text-slate-300 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Refund this item via Stripe
            </label>
          </div>

          {removeError && (
            <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded border border-red-500/30">
              {removeError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-slate-800 text-white hover:bg-slate-700 border-slate-600"
              disabled={isRemoving}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRemoveItem();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isRemoving}
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
