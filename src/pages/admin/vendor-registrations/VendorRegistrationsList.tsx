import type { FC } from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useTable, useUpdate } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { NativeSelect } from '@/components/ui/NativeSelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';

interface VendorRegistration {
  id: string;
  contact_name: string;
  contact_email: string;
  organization_name: string;
  tax_acknowledged: boolean;
  staff_name: string | null;
  staff_email: string | null;
  base_fee_cents: number;
  discount_code_id: string | null;
  discount_amount_cents: number;
  total_paid_cents: number;
  payment_status: 'pending' | 'paid' | 'waived' | 'failed' | 'refunded';
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface VendorDiscountCode {
  id: string;
  code: string;
}

const STATUS_VARIANTS: Record<VendorRegistration['payment_status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  waived: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const STATUS_OPTIONS: VendorRegistration['payment_status'][] = [
  'pending',
  'paid',
  'waived',
  'failed',
  'refunded',
];

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export const VendorRegistrationsList: FC = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | VendorRegistration['payment_status']>('all');
  const [selected, setSelected] = useState<VendorRegistration | null>(null);

  const { tableQuery } = useTable<VendorRegistration>({
    resource: 'vendor_registrations',
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: 'created_at', order: 'desc' }] },
    filters:
      statusFilter === 'all'
        ? { initial: [] }
        : { initial: [{ field: 'payment_status', operator: 'eq', value: statusFilter }] },
  });

  const { tableQuery: codesQuery } = useTable<VendorDiscountCode>({
    resource: 'vendor_discount_codes',
    pagination: { pageSize: 100 },
  });

  const codeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of codesQuery.data?.data || []) map.set(c.id, c.code);
    return map;
  }, [codesQuery.data?.data]);

  const rows = tableQuery.data?.data || [];
  const isLoading = tableQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-viking text-white">Vendor Registrations</h1>
          <p className="text-white/80 mt-2">Self-serve vendor signups via the rotatable registration URL.</p>
        </div>
        <div className="w-48">
          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            options={[
              { value: 'all', label: 'All statuses' },
              ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-white">Loading vendor registrations...</CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-white">
            No vendor registrations yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelected(row)}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg font-viking text-white truncate">
                    {row.organization_name}
                  </CardTitle>
                  <Badge className={STATUS_VARIANTS[row.payment_status]}>{row.payment_status}</Badge>
                </div>
                <p className="text-sm text-white/70 truncate">{row.contact_name}</p>
                <p className="text-xs text-white/50 truncate">{row.contact_email}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-white/80">
                <div className="flex justify-between">
                  <span>Total paid</span>
                  <span className="font-mono">{formatMoney(row.total_paid_cents)}</span>
                </div>
                {row.discount_code_id && codeMap.get(row.discount_code_id) && (
                  <div className="flex justify-between text-xs text-white/60">
                    <span>Code</span>
                    <span className="font-mono">{codeMap.get(row.discount_code_id)}</span>
                  </div>
                )}
                {row.staff_name && (
                  <div className="text-xs text-white/60">
                    Staff: {row.staff_name}
                  </div>
                )}
                <div className="text-xs text-white/40 pt-2 border-t border-white/10">
                  Submitted {formatDate(row.created_at)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VendorRegistrationDetailModal
        registration={selected}
        codeName={selected?.discount_code_id ? codeMap.get(selected.discount_code_id) ?? null : null}
        onOpenChange={(open) => !open && setSelected(null)}
        onSaved={() => {
          tableQuery.refetch();
        }}
      />
    </div>
  );
};

interface ModalProps {
  registration: VendorRegistration | null;
  codeName: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const VendorRegistrationDetailModal: FC<ModalProps> = ({ registration, codeName, onOpenChange, onSaved }) => {
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<VendorRegistration['payment_status']>('pending');
  const [saving, setSaving] = useState(false);
  const { mutate: updateRecord } = useUpdate();

  // Reset form when a new row is selected.
  useEffect(() => {
    setNotes(registration?.notes ?? '');
    setStatus(registration?.payment_status ?? 'pending');
  }, [registration]);

  if (!registration) return null;

  const handleSave = async () => {
    setSaving(true);
    await new Promise<void>((resolve) =>
      updateRecord(
        {
          resource: 'vendor_registrations',
          id: registration.id,
          values: { notes: notes || null, payment_status: status },
        },
        { onSettled: () => resolve() }
      )
    );
    setSaving(false);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={!!registration} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{registration.organization_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <DetailRow label="Contact">
            {registration.contact_name} · {registration.contact_email}
          </DetailRow>
          {registration.staff_name || registration.staff_email ? (
            <DetailRow label="Staff helper">
              {[registration.staff_name, registration.staff_email].filter(Boolean).join(' · ') || '—'}
            </DetailRow>
          ) : (
            <DetailRow label="Staff helper">None</DetailRow>
          )}
          <DetailRow label="Tax acknowledged">{registration.tax_acknowledged ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Base fee">{formatMoney(registration.base_fee_cents)}</DetailRow>
          <DetailRow label="Discount">
            {registration.discount_amount_cents > 0
              ? `${formatMoney(registration.discount_amount_cents)}${codeName ? ` (${codeName})` : ''}`
              : 'None'}
          </DetailRow>
          <DetailRow label="Total paid">{formatMoney(registration.total_paid_cents)}</DetailRow>
          {registration.stripe_session_id && (
            <DetailRow label="Stripe session">
              <span className="font-mono text-xs">{registration.stripe_session_id}</span>
            </DetailRow>
          )}
          {registration.stripe_payment_intent_id && (
            <DetailRow label="Payment intent">
              <span className="font-mono text-xs">{registration.stripe_payment_intent_id}</span>
            </DetailRow>
          )}
          <DetailRow label="Submitted">{formatDate(registration.created_at)}</DetailRow>

          <div className="pt-2 border-t border-gray-200 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700">Status (admin override)</label>
              <NativeSelect
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Admin notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes (not shown to vendor)"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DetailRow: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-3 gap-2">
    <div className="text-xs font-semibold text-gray-600">{label}</div>
    <div className="col-span-2 text-gray-900 break-words">{children}</div>
  </div>
);

