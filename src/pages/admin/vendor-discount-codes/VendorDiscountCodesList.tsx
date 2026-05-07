import type { FC } from 'react';
import { useState } from 'react';
import { useTable, useDelete } from '@refinedev/core';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/admin/ConfirmDialog';

export interface VendorDiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const formatDiscount = (c: VendorDiscountCode) =>
  c.discount_type === 'percent' ? `${c.discount_value}%` : formatMoney(c.discount_value);

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export const VendorDiscountCodesList: FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState<VendorDiscountCode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { tableQuery } = useTable<VendorDiscountCode>({
    resource: 'vendor_discount_codes',
    pagination: { pageSize: 100 },
    sorters: { initial: [{ field: 'created_at', order: 'desc' }] },
  });

  const { mutate: deleteRecord } = useDelete();

  const codes = tableQuery.data?.data || [];
  const isLoading = tableQuery.isLoading;

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    await new Promise<void>((resolve) =>
      deleteRecord(
        { resource: 'vendor_discount_codes', id: deleteId },
        { onSettled: () => resolve() }
      )
    );
    setIsDeleting(false);
    setDeleteId(null);
    setDeleteCode(null);
    tableQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Vendor Discount Codes</h1>
          <p className="text-white/80 mt-2">
            Codes vendors can enter on the registration page to discount or waive the table fee.
          </p>
        </div>
        <Link to="/vendor-discount-codes/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Code
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-white">Loading codes...</CardContent>
        </Card>
      ) : codes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-white">
            No discount codes yet. Create one to share with vendors who get a discount or waiver.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {codes.map((c) => (
            <Card key={c.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg font-viking text-white font-mono uppercase">
                    {c.code}
                  </CardTitle>
                  <div className="flex gap-1">
                    {c.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
                {c.description && (
                  <p className="text-sm text-white/70">{c.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-white/80">
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span className="font-mono">{formatDiscount(c)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Uses</span>
                  <span className="font-mono">
                    {c.uses_count}{c.max_uses != null ? ` / ${c.max_uses}` : ' (unlimited)'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-white/60">
                  <span>Expires</span>
                  <span>{formatDate(c.expires_at)}</span>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                  <Link to={`/vendor-discount-codes/edit/${c.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeleteId(c.id);
                      setDeleteCode(c);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteCode(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        itemName={deleteCode?.code || ''}
        itemType="Discount Code"
        isLoading={isDeleting}
      />
    </div>
  );
};
