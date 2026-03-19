import type { FC } from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui';
import { Loader2, ShoppingBag, AlertTriangle } from 'lucide-react';
import {
  getAvailableAddons,
  addManualAddonPurchase,
  type AvailableAddon,
} from '@/lib/utils/manualRegistration';

interface AddAddonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export const AddAddonModal: FC<AddAddonModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  preselectedUser,
}) => {
  const [addons, setAddons] = useState<AvailableAddon[]>([]);
  const [isLoadingAddons, setIsLoadingAddons] = useState(false);
  const [selectedAddonId, setSelectedAddonId] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [adminNotes, setAdminNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inventoryWarning, setInventoryWarning] = useState<string | null>(null);
  const [forceOutOfStock, setForceOutOfStock] = useState(false);

  const selectedAddon = addons.find((a) => a.id === selectedAddonId);

  // Compute unit price: base price + variant modifier
  const unitPrice = (() => {
    if (!selectedAddon) return 0;
    let price = selectedAddon.price;
    if (selectedAddon.hasVariants && selectedVariant && selectedAddon.variants) {
      const variant = selectedAddon.variants.find((v) => v.name === selectedVariant);
      if (variant) {
        price += variant.priceModifier;
      }
    }
    return price;
  })();

  useEffect(() => {
    if (open) {
      setSelectedAddonId('');
      setSelectedVariant('');
      setQuantity(1);
      setAdminNotes('');
      setError(null);
      setSuccessMessage(null);
      setInventoryWarning(null);
      setForceOutOfStock(false);
      loadAddons();
    }
  }, [open]);

  // Reset variant when addon changes
  useEffect(() => {
    setSelectedVariant('');
    setInventoryWarning(null);
    setForceOutOfStock(false);
  }, [selectedAddonId]);

  // Check inventory when addon/variant/quantity changes
  useEffect(() => {
    if (!selectedAddon) {
      setInventoryWarning(null);
      return;
    }

    if (!selectedAddon.hasInventory) {
      setInventoryWarning(null);
      return;
    }

    if (selectedAddon.hasVariants && selectedVariant && selectedAddon.variants) {
      const variant = selectedAddon.variants.find((v) => v.name === selectedVariant);
      if (variant && variant.stock !== null && variant.stock < quantity) {
        setInventoryWarning(
          `"${selectedVariant}" only has ${variant.stock} in stock. You're requesting ${quantity}.`
        );
        setForceOutOfStock(false); // require re-confirmation for any new warning
        return;
      }
    } else if (selectedAddon.stockQuantity !== null && selectedAddon.stockQuantity < quantity) {
      setInventoryWarning(
        `Only ${selectedAddon.stockQuantity} in stock. You're requesting ${quantity}.`
      );
      setForceOutOfStock(false); // require re-confirmation for any new warning
      return;
    }

    setInventoryWarning(null);
    setForceOutOfStock(false);
  }, [selectedAddon, selectedVariant, quantity]);

  const loadAddons = async () => {
    setIsLoadingAddons(true);
    try {
      const data = await getAvailableAddons(true);
      setAddons(data);
      if (data.length === 0) {
        setError('No add-ons available.');
      }
    } catch (err) {
      console.error('Error loading addons:', err);
      setError('Failed to load add-ons. Please close and reopen the modal.');
    } finally {
      setIsLoadingAddons(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleSubmit = async () => {
    if (!preselectedUser) {
      setError('No user selected');
      return;
    }
    if (!selectedAddonId || !selectedAddon) {
      setError('Please select an add-on');
      return;
    }
    if (selectedAddon.hasVariants && !selectedVariant) {
      setError('Please select a variant');
      return;
    }
    if (quantity < 1) {
      setError('Quantity must be at least 1');
      return;
    }

    // If there's an inventory warning and user hasn't confirmed override yet
    if (inventoryWarning && !forceOutOfStock) {
      setForceOutOfStock(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await addManualAddonPurchase({
        userId: preselectedUser.id,
        addonId: selectedAddonId,
        quantity,
        variantName: selectedVariant || null,
        unitPrice,
        adminNotes: adminNotes || undefined,
        forceOutOfStock,
      });

      if (result.success) {
        const message = result.inventoryWarning
          ? `Add-on added successfully! (Note: ${result.inventoryWarning})`
          : 'Add-on added successfully!';
        setSuccessMessage(message);
        setTimeout(() => {
          onSuccess?.();
          onOpenChange(false);
        }, 1500);
      } else if (result.inventoryWarning && !forceOutOfStock) {
        // Backend blocked due to stock — show warning, let user click again to override
        setInventoryWarning(result.inventoryWarning);
        setForceOutOfStock(false);
      } else {
        setError(result.error || 'Failed to add add-on');
      }
    } catch (err) {
      console.error('Error adding addon:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxQty = selectedAddon?.maxPerOrder ?? 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Add Add-on
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Manually add an add-on purchase for{' '}
            <span className="text-white font-medium">
              {preselectedUser
                ? `${preselectedUser.firstName || ''} ${preselectedUser.lastName || ''}`.trim() ||
                  'this user'
                : 'this user'}
            </span>{' '}
            (bypasses payment)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add-on Selection */}
          <div className="space-y-2">
            <Label className="text-white">Add-on *</Label>
            {isLoadingAddons ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading add-ons...
              </div>
            ) : (
              <select
                value={selectedAddonId}
                onChange={(e) => setSelectedAddonId(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select an add-on...</option>
                {addons.map((addon) => (
                  <option key={addon.id} value={addon.id}>
                    {!addon.isActive ? '[INACTIVE] ' : ''}{addon.name} - {formatCurrency(addon.price)}
                    {addon.hasInventory && !addon.hasVariants && addon.stockQuantity !== null
                      ? ` (${addon.stockQuantity} in stock)`
                      : ''}
                  </option>
                ))}
              </select>
            )}

            {selectedAddon && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="outline">{selectedAddon.category}</Badge>
                {!selectedAddon.isActive && (
                  <Badge variant="outline" className="border-amber-500 text-amber-400">
                    Inactive
                  </Badge>
                )}
                {selectedAddon.hasInventory && (
                  <span className="text-xs text-slate-400">
                    Stock: {selectedAddon.stockQuantity ?? 'N/A'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Variant Selection */}
          {selectedAddon?.hasVariants && selectedAddon.variants && selectedAddon.variants.length > 0 && (
            <div className="space-y-2">
              <Label className="text-white">Variant *</Label>
              <select
                value={selectedVariant}
                onChange={(e) => setSelectedVariant(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select a variant...</option>
                {selectedAddon.variants.map((variant) => (
                  <option key={variant.sku} value={variant.name}>
                    {variant.name}
                    {variant.priceModifier !== 0
                      ? ` (${variant.priceModifier > 0 ? '+' : ''}${formatCurrency(variant.priceModifier)})`
                      : ''}
                    {variant.stock !== null ? ` - ${variant.stock} in stock` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-white">Quantity</Label>
            <Input
              type="number"
              min={1}
              max={maxQty}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="bg-slate-800 border-slate-600 text-white w-24"
            />
            {selectedAddon?.maxPerOrder && (
              <p className="text-xs text-slate-400">Max {selectedAddon.maxPerOrder} per order</p>
            )}
          </div>

          {/* Price Summary */}
          {selectedAddon && (
            <div className="bg-slate-800 border border-slate-700 rounded-md p-3 space-y-1 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Unit price:</span>
                <span>{formatCurrency(unitPrice)}</span>
              </div>
              <div className="flex justify-between text-white font-medium">
                <span>Total ({quantity}x):</span>
                <span>{formatCurrency(unitPrice * quantity)}</span>
              </div>
            </div>
          )}

          {/* Inventory Warning */}
          {inventoryWarning && (
            <div className="flex items-start gap-2 text-amber-400 text-sm bg-amber-500/10 p-3 rounded border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p>{inventoryWarning}</p>
                {forceOutOfStock ? (
                  <p className="text-xs mt-1 text-amber-300">
                    Click &quot;Add Add-on&quot; again to confirm override.
                  </p>
                ) : (
                  <p className="text-xs mt-1 text-amber-300">
                    Click &quot;Add Add-on&quot; to override and add anyway.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div className="space-y-2">
            <Label className="text-white">Admin Notes</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Reason for manual add-on, comp, etc."
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 min-h-[60px]"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded border border-red-500/30">
              {error}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="text-green-400 text-sm bg-green-500/10 p-3 rounded border border-green-500/30">
              {successMessage}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border-slate-600 text-white hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedAddonId}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : forceOutOfStock && inventoryWarning ? (
              'Confirm Override & Add'
            ) : (
              'Add Add-on'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
