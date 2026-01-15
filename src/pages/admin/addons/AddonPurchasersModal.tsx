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
import { Loader2, User, Package, ShoppingBag, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabaseAdmin, supabase } from '@/lib/api/supabase';
import { formatPrice } from '@/lib/utils/formatting';
import type { Addon } from '@/types';

interface Purchaser {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  club: string | null;
  quantity: number;
  unitPrice: number | null;
  total: number | null;
  variantName: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  purchasedAt: string | null;
}

interface AddonPurchasersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addon: Addon | null;
}

export const AddonPurchasersModal: FC<AddonPurchasersModalProps> = ({
  open,
  onOpenChange,
  addon,
}) => {
  const [purchasers, setPurchasers] = useState<Purchaser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = supabaseAdmin ?? supabase;

  useEffect(() => {
    if (open && addon) {
      fetchPurchasers();
    }
  }, [open, addon]);

  const fetchPurchasers = async () => {
    if (!addon) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get all order items for this addon from completed orders only
      const { data: orderItems, error: itemsError } = await client
        .from('order_items')
        .select('id, order_id, quantity, unit_price, total, variant_name, created_at, order:orders!inner(payment_status)')
        .eq('addon_id', addon.id)
        .eq('order.payment_status', 'completed');

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        setError(itemsError.message);
        return;
      }

      if (!orderItems || orderItems.length === 0) {
        setPurchasers([]);
        return;
      }

      // Get the orders for these items to get user IDs
      const orderIds = [...new Set(orderItems.map(item => item.order_id))];
      const { data: orders, error: ordersError } = await client
        .from('orders')
        .select('id, user_id, order_number, order_status, created_at')
        .in('id', orderIds);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        setError(ordersError.message);
        return;
      }

      // Create order map
      const orderMap = new Map(orders?.map(o => [o.id, o]) || []);

      // Get unique user IDs
      const userIds = [...new Set(orders?.map(o => o.user_id).filter(Boolean) || [])];

      // Fetch profiles for those users
      let profilesMap = new Map<string, { first_name: string | null; last_name: string | null; club: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await client
          .from('profiles')
          .select('id, first_name, last_name, club')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        } else {
          profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        }
      }

      // Combine data
      const purchasersList: Purchaser[] = orderItems.map(item => {
        const order = orderMap.get(item.order_id);
        const profile = order?.user_id ? profilesMap.get(order.user_id) : null;
        return {
          id: item.id,
          userId: order?.user_id || '',
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          club: profile?.club || null,
          quantity: item.quantity || 1,
          unitPrice: item.unit_price,
          total: item.total,
          variantName: item.variant_name,
          orderNumber: order?.order_number || null,
          orderStatus: order?.order_status || null,
          purchasedAt: order?.created_at || item.created_at,
        };
      });

      // Sort by purchase date (newest first)
      purchasersList.sort((a, b) => {
        if (!a.purchasedAt) return 1;
        if (!b.purchasedAt) return -1;
        return new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime();
      });

      setPurchasers(purchasersList);
    } catch (err) {
      console.error('Error fetching purchasers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
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
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const handleExportCSV = () => {
    if (!addon || purchasers.length === 0) return;

    const headers = ['Name', 'Club', 'Variant', 'Quantity', 'Unit Price', 'Total', 'Order Number', 'Order Status', 'Purchase Date'];
    const rows = purchasers.map(p => [
      p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : 'Unknown',
      p.club || '',
      p.variantName || '',
      String(p.quantity),
      p.unitPrice ? (p.unitPrice / 100).toFixed(2) : '',
      p.total ? (p.total / 100).toFixed(2) : '',
      p.orderNumber || '',
      p.orderStatus || '',
      p.purchasedAt ? new Date(p.purchasedAt).toISOString() : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${addon.name.replace(/[^a-z0-9]/gi, '_')}_purchasers.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Calculate totals
  const totalQuantity = purchasers.reduce((sum, p) => sum + p.quantity, 0);
  const totalRevenue = purchasers.reduce((sum, p) => sum + (p.total || 0), 0);

  if (!addon) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            {addon.name} - Purchasers
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {formatPrice(addon.price)} &bull; {addon.category}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="ml-2 text-white">Loading purchasers...</span>
          </div>
        ) : error ? (
          <div className="text-red-400 py-4">Error: {error}</div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Package className="h-4 w-4" />
                  Total Units Sold
                </div>
                <p className="text-2xl font-bold text-white mt-1">{totalQuantity}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <User className="h-4 w-4" />
                  Total Revenue
                </div>
                <p className="text-2xl font-bold text-green-400 mt-1">{formatPrice(totalRevenue)}</p>
              </div>
            </div>

            {/* Export Button */}
            {purchasers.length > 0 && (
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

            {/* Purchasers List */}
            {purchasers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No one has purchased this add-on yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 font-semibold text-slate-400 text-sm">Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-400 text-sm">Club</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-400 text-sm">Variant</th>
                      <th className="text-center py-2 px-3 font-semibold text-slate-400 text-sm">Qty</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-400 text-sm">Total</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-400 text-sm">Order</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-400 text-sm">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchasers.map((purchaser) => (
                      <tr
                        key={purchaser.id}
                        className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2 px-3">
                          <p className="font-medium text-white">
                            {purchaser.firstName && purchaser.lastName
                              ? `${purchaser.firstName} ${purchaser.lastName}`
                              : <span className="text-slate-500">Unknown</span>}
                          </p>
                        </td>
                        <td className="py-2 px-3 text-slate-300 text-sm">
                          {purchaser.club || '-'}
                        </td>
                        <td className="py-2 px-3">
                          {purchaser.variantName ? (
                            <span className="bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-300">
                              {purchaser.variantName}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-white">
                          {purchaser.quantity}
                        </td>
                        <td className="py-2 px-3 text-right text-white">
                          {formatPrice(purchaser.total || 0)}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-col gap-1">
                            {purchaser.orderNumber && (
                              <span className="text-xs text-slate-400">{purchaser.orderNumber}</span>
                            )}
                            {getStatusBadge(purchaser.orderStatus)}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-sm">
                          {formatDate(purchaser.purchasedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
