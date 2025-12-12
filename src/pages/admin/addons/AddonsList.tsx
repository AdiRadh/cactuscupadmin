import type { FC } from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useTable } from '@refinedev/core';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui';
import { Plus, Edit, Trash2, Package, RefreshCw, Layers, Users } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';
import { AddonPurchasersModal } from './AddonPurchasersModal';
import { useAdmin } from '@/hooks';
import { formatPrice } from '@/lib/utils/formatting';
import type { Addon, DbAddon } from '@/types';
import { dbToAddon } from '@/types';
import { syncAddonPricing, bulkSyncAddonsToStripe } from '@/lib/utils/stripe';
import { supabaseAdmin, supabase } from '@/lib/api/supabase';

/**
 * Admin add-ons list page
 * Displays all add-ons with CRUD actions and Stripe product management
 */
export const AddonsList: FC = () => {
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<Addon | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [purchasersAddon, setPurchasersAddon] = useState<Addon | null>(null);
  const [isPurchasersModalOpen, setIsPurchasersModalOpen] = useState(false);
  const [soldCounts, setSoldCounts] = useState<Map<string, number>>(new Map());

  const client = supabaseAdmin ?? supabase;

  const { tableQuery } = useTable<DbAddon>({
    resource: 'addons',
    pagination: {
      pageSize: 20,
    },
  });

  const { deleteAddon } = useAdmin();

  // Convert database format (snake_case) to domain format (camelCase)
  const addons = useMemo(
    () => (tableQuery.data?.data || []).map(dbToAddon),
    [tableQuery.data?.data]
  );
  const isLoading = tableQuery.isLoading;

  // Fetch sold counts for all addons
  useEffect(() => {
    const fetchSoldCounts = async () => {
      if (addons.length === 0) return;

      try {
        // Get all order items grouped by addon_id with sum of quantities
        const { data, error } = await client
          .from('order_items')
          .select('addon_id, quantity')
          .not('addon_id', 'is', null);

        if (error) {
          console.error('Error fetching sold counts:', error);
          return;
        }

        // Calculate totals per addon
        const counts = new Map<string, number>();
        (data || []).forEach((item) => {
          if (item.addon_id) {
            const current = counts.get(item.addon_id) || 0;
            counts.set(item.addon_id, current + (item.quantity || 1));
          }
        });

        setSoldCounts(counts);
      } catch (err) {
        console.error('Error fetching sold counts:', err);
      }
    };

    fetchSoldCounts();
  }, [addons.length, client]);

  const handleSyncToStripe = async (addon: Addon) => {
    setSyncingIds((prev) => new Set(prev).add(addon.id));

    try {
      await syncAddonPricing(
        addon.id,
        addon.name,
        addon.description,
        addon.price,
        addon.stripeProductId, // Pass existing product ID for updates
        addon.category // Pass category for Stripe metadata
      );

      // Refresh the table data
      tableQuery.refetch();

      alert(`Successfully synced "${addon.name}" to Stripe!`);
    } catch (error) {
      console.error('Error syncing to Stripe:', error);
      alert(
        `Failed to sync to Stripe: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setSyncingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(addon.id);
        return newSet;
      });
    }
  };

  const handleBulkSync = async () => {
    if (addons.length === 0) {
      alert('No add-ons to sync.');
      return;
    }

    const confirmed = window.confirm(
      `This will sync all ${addons.length} add-ons to Stripe.\n\n• Existing products will be UPDATED (name, description)\n• New prices will be created (Stripe prices are immutable)\n• New products will be created for add-ons not yet synced\n\nContinue?`
    );

    if (!confirmed) return;

    setIsBulkSyncing(true);
    setBulkSyncProgress({ current: 0, total: addons.length });

    try {
      const results = await bulkSyncAddonsToStripe(
        (current, total, result) => {
          setBulkSyncProgress({ current, total });
          console.log(`Synced ${current}/${total}: ${result.name} - ${result.success ? 'Success' : result.error}`);
        }
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      // Refresh the list
      tableQuery.refetch();

      if (failCount === 0) {
        alert(`Successfully synced all ${successCount} add-ons to Stripe!`);
      } else {
        const failedNames = results.filter(r => !r.success).map(r => r.name).join(', ');
        alert(`Synced ${successCount} add-ons. ${failCount} failed:\n${failedNames}`);
      }
    } catch (error) {
      console.error('Error bulk syncing add-ons:', error);
      alert(`Bulk sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBulkSyncing(false);
      setBulkSyncProgress(null);
    }
  };

  const handleDelete = (addon: Addon) => {
    setDeleteItem(addon);
    setDeleteId(addon.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteAddon(deleteId);
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteItem(null);
      alert('Add-on deleted successfully!');
      tableQuery.refetch();
    } catch (error) {
      setIsDeleting(false);
      console.error('Delete error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete add-on: ${errorMessage}. Check the browser console for details.`);
    }
  };

  const handleViewPurchasers = (addon: Addon) => {
    setPurchasersAddon(addon);
    setIsPurchasersModalOpen(true);
  };

  const getCategoryBadge = (category: string) => {
    const categoryColors: Record<string, string> = {
      apparel: 'success',
      merchandise: 'secondary',
      equipment: 'default',
      food: 'warning',
      other: 'outline',
    };
    return <Badge variant={categoryColors[category] as any || 'outline'}>{category}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Add-Ons</h1>
          <p className="text-orange-200 mt-2">
            Manage merchandise, apparel, and other add-on products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleBulkSync}
            disabled={isBulkSyncing || addons.length === 0}
          >
            {isBulkSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {bulkSyncProgress ? `Syncing ${bulkSyncProgress.current}/${bulkSyncProgress.total}...` : 'Syncing...'}
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 mr-2" />
                Sync All to Stripe
              </>
            )}
          </Button>
          <Link to="/addons/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Add-ons Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Add-On Products</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-white">
              Loading add-ons...
            </div>
          ) : addons.length === 0 ? (
            <div className="text-center py-8 text-white">
              No add-ons found. Create your first product to get started.
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
                      Category
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Price
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Stock
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Sold
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Stripe
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {addons.map((addon) => (
                    <tr
                      key={addon.id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-white">
                          {addon.name}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        {getCategoryBadge(addon.category)}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {formatPrice(addon.price)}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {addon.hasInventory ? (
                          addon.stockQuantity ?? 'N/A'
                        ) : (
                          'Unlimited'
                        )}
                      </td>
                      <td className="py-3 px-4 text-white/90">
                        {soldCounts.get(addon.id) || 0}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {addon.stripeProductId ? (
                            <>
                              <Badge variant="success">Synced</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncToStripe(addon)}
                                disabled={syncingIds.has(addon.id)}
                                title="Re-sync pricing with Stripe"
                              >
                                <RefreshCw className={`h-4 w-4 ${syncingIds.has(addon.id) ? 'animate-spin' : ''}`} />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Badge variant="warning">Not Synced</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSyncToStripe(addon)}
                                disabled={syncingIds.has(addon.id)}
                                title="Create Stripe Product"
                              >
                                <Package className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {addon.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewPurchasers(addon)}
                            title="View purchasers"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Link to={`/addons/edit/${addon.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-red-500/20"
                            onClick={() => handleDelete(addon)}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteItem(null);
          }
        }}
        onConfirm={confirmDelete}
        itemName={deleteItem?.name || ''}
        itemType="Add-On"
        isLoading={isDeleting}
      />

      {/* Purchasers Modal */}
      <AddonPurchasersModal
        open={isPurchasersModalOpen}
        onOpenChange={setIsPurchasersModalOpen}
        addon={purchasersAddon}
      />
    </div>
  );
};
