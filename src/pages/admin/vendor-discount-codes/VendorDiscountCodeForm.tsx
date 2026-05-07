import type { FC } from 'react';
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card, CardContent } from '@/components/ui/Card';

export interface VendorDiscountCodeFormValues {
  code: string;
  description: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;          // percent (1-100) or cents
  max_uses: number | null;
  expires_at: string | null;       // ISO string or null
  active: boolean;
}

interface Props {
  initial?: Partial<VendorDiscountCodeFormValues>;
  onSubmit: (values: VendorDiscountCodeFormValues) => Promise<void>;
  submitText: string;
  backLink: string;
  title: string;
  subtitle: string;
}

const datetimeLocalFromIso = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Format as YYYY-MM-DDTHH:MM in local time for the datetime-local input.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const isoFromDatetimeLocal = (s: string): string | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const VendorDiscountCodeForm: FC<Props> = ({ initial, onSubmit, submitText, backLink, title, subtitle }) => {
  const navigate = useNavigate();
  const [code, setCode] = useState(initial?.code ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(initial?.discount_type ?? 'percent');

  // For percent we display the integer percent. For fixed we display dollars (decimal),
  // converting to cents on submit. discount_value is always stored as cents-or-percent-int.
  const [percentValue, setPercentValue] = useState<string>(
    initial?.discount_type === 'percent' && initial?.discount_value != null ? String(initial.discount_value) : ''
  );
  const [fixedDollars, setFixedDollars] = useState<string>(
    initial?.discount_type === 'fixed' && initial?.discount_value != null
      ? (initial.discount_value / 100).toFixed(2)
      : ''
  );

  const [maxUses, setMaxUses] = useState<string>(
    initial?.max_uses != null ? String(initial.max_uses) : ''
  );
  const [expiresAt, setExpiresAt] = useState<string>(datetimeLocalFromIso(initial?.expires_at ?? null));
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If initial data arrives later (edit page), sync once.
  useEffect(() => {
    if (initial?.code !== undefined) setCode(initial.code);
    if (initial?.description !== undefined) setDescription(initial.description);
    if (initial?.discount_type) setDiscountType(initial.discount_type);
    if (initial?.discount_value != null) {
      if (initial.discount_type === 'percent') {
        setPercentValue(String(initial.discount_value));
      } else if (initial.discount_type === 'fixed') {
        setFixedDollars((initial.discount_value / 100).toFixed(2));
      }
    }
    if (initial?.max_uses !== undefined) setMaxUses(initial.max_uses != null ? String(initial.max_uses) : '');
    if (initial?.expires_at !== undefined) setExpiresAt(datetimeLocalFromIso(initial.expires_at));
    if (initial?.active !== undefined) setActive(initial.active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.code, initial?.discount_type, initial?.discount_value, initial?.max_uses, initial?.expires_at, initial?.active]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Code is required');
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmedCode)) {
      setError('Code can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    let discountValue: number;
    if (discountType === 'percent') {
      const n = parseInt(percentValue, 10);
      if (!Number.isFinite(n) || n < 1 || n > 100) {
        setError('Percent must be between 1 and 100');
        return;
      }
      discountValue = n;
    } else {
      const dollars = parseFloat(fixedDollars);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setError('Fixed amount must be greater than 0');
        return;
      }
      discountValue = Math.round(dollars * 100);
    }

    let parsedMaxUses: number | null = null;
    if (maxUses.trim()) {
      const n = parseInt(maxUses, 10);
      if (!Number.isFinite(n) || n < 1) {
        setError('Max uses must be a positive integer (or leave blank for unlimited)');
        return;
      }
      parsedMaxUses = n;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        code: trimmedCode.toUpperCase(),
        description: description.trim(),
        discount_type: discountType,
        discount_value: discountValue,
        max_uses: parsedMaxUses,
        expires_at: isoFromDatetimeLocal(expiresAt),
        active,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={backLink}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-viking text-white">{title}</h1>
          <p className="text-white/80 mt-2">{subtitle}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-100 text-red-800 text-sm p-3 rounded-md border border-red-300">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VENDOR50"
                className="font-mono uppercase"
                required
              />
              <p className="text-xs text-gray-600">
                Letters, numbers, hyphens, and underscores. Stored case-insensitively.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Internal note about who this code is for"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount-type">Discount type *</Label>
                <NativeSelect
                  id="discount-type"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                  options={[
                    { value: 'percent', label: 'Percent off (e.g. 100% = waiver)' },
                    { value: 'fixed', label: 'Fixed amount off (USD)' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount-value">
                  {discountType === 'percent' ? 'Percent (1-100) *' : 'Dollars off *'}
                </Label>
                {discountType === 'percent' ? (
                  <Input
                    id="discount-value"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={percentValue}
                    onChange={(e) => setPercentValue(e.target.value)}
                    required
                  />
                ) : (
                  <Input
                    id="discount-value"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={fixedDollars}
                    onChange={(e) => setFixedDollars(e.target.value)}
                    required
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max-uses">Max uses (blank = unlimited)</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min={1}
                  step={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires-at">Expires (optional)</Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={active}
                onCheckedChange={(checked) => setActive(checked === true)}
              />
              <Label htmlFor="active" className="cursor-pointer">Active</Label>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : submitText}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate(backLink)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
