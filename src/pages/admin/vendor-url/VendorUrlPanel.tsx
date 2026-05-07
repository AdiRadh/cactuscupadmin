import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useList, useUpdate, useCreate } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Copy, RefreshCw, Check } from 'lucide-react';

interface DbSiteSetting {
  id: string;
  setting_key: string;
  setting_value: string;
}

const SLUG_KEY = 'vendor_registration_url_slug';
const FEE_KEY = 'vendor_table_fee_cents';

const generateSlug = (): string => {
  // 16 random bytes (32 hex chars), matching the DB seed expression.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const VendorUrlPanel: FC = () => {
  const { query, result } = useList<DbSiteSetting>({
    resource: 'site_settings',
    pagination: { pageSize: 200 },
  });

  const isLoading = query.isLoading;
  const refetch = query.refetch;

  const settings = useMemo(() => {
    const map = new Map<string, DbSiteSetting>();
    for (const row of result?.data || []) map.set(row.setting_key, row);
    return map;
  }, [result?.data]);

  const slugRow = settings.get(SLUG_KEY);
  const feeRow = settings.get(FEE_KEY);

  const slug = slugRow?.setting_value ?? '';
  const feeCents = feeRow ? parseInt(feeRow.setting_value, 10) : 5000;

  const { mutate: updateSetting } = useUpdate();
  const { mutate: createSetting } = useCreate();

  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  const [feeInput, setFeeInput] = useState<string>(((feeCents) / 100).toFixed(2));
  const [savingFee, setSavingFee] = useState(false);

  const fullUrl =
    typeof window !== 'undefined' && slug
      ? `${getPublicSiteOrigin()}/vendor-registration/${slug}`
      : slug
        ? `/vendor-registration/${slug}`
        : '';

  const handleCopy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleRotate = async () => {
    setShowRotateConfirm(false);
    setRotating(true);
    const newSlug = generateSlug();
    if (slugRow) {
      await new Promise<void>((resolve) =>
        updateSetting(
          { resource: 'site_settings', id: slugRow.id, values: { setting_value: newSlug } },
          { onSettled: () => resolve() }
        )
      );
    } else {
      await new Promise<void>((resolve) =>
        createSetting(
          {
            resource: 'site_settings',
            values: { setting_key: SLUG_KEY, setting_value: newSlug, setting_type: 'text' },
          },
          { onSettled: () => resolve() }
        )
      );
    }
    setRotating(false);
    refetch();
  };

  const handleSaveFee = async () => {
    const dollars = parseFloat(feeInput);
    if (!Number.isFinite(dollars) || dollars < 0) {
      alert('Fee must be a positive number');
      return;
    }
    const cents = Math.round(dollars * 100);
    setSavingFee(true);
    if (feeRow) {
      await new Promise<void>((resolve) =>
        updateSetting(
          { resource: 'site_settings', id: feeRow.id, values: { setting_value: String(cents) } },
          { onSettled: () => resolve() }
        )
      );
    } else {
      await new Promise<void>((resolve) =>
        createSetting(
          {
            resource: 'site_settings',
            values: { setting_key: FEE_KEY, setting_value: String(cents), setting_type: 'number' },
          },
          { onSettled: () => resolve() }
        )
      );
    }
    setSavingFee(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-viking text-white">Vendor URL & Fee</h1>
        <p className="text-white/80 mt-2">
          The vendor registration page is hidden behind an unguessable URL. Share the link below with vendors you've approved.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registration URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <>
              <div className="flex gap-2">
                <Input value={fullUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" onClick={handleCopy} disabled={!fullUrl}>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t">
                <p className="text-sm text-gray-600">
                  Rotating the slug invalidates every previously shared link.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowRotateConfirm(true)}
                  disabled={rotating}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${rotating ? 'animate-spin' : ''}`} />
                  {rotating ? 'Rotating...' : 'Rotate slug'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendor table fee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="vendor-fee" className="text-xs font-semibold text-gray-700">
                Default fee (USD)
              </label>
              <Input
                id="vendor-fee"
                type="number"
                min={0}
                step={0.01}
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveFee} disabled={savingFee}>
              {savingFee ? 'Saving...' : 'Save fee'}
            </Button>
          </div>
          <p className="text-xs text-gray-600">
            Currently {(feeCents / 100).toFixed(2)} USD. Each vendor registration snapshots this value at submission time.
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showRotateConfirm}
        onOpenChange={setShowRotateConfirm}
        onConfirm={handleRotate}
        title="Rotate vendor URL?"
        description="This will generate a new slug. The current URL will stop working immediately and any vendor with the old link will see a 404. You'll need to share the new URL with anyone you want to onboard."
        confirmText="Rotate slug"
        variant="warning"
      />
    </div>
  );
};

/**
 * Best-guess origin for the public site. The admin runs on a separate origin
 * so window.location.origin would point at the admin app — that's wrong.
 * If VITE_PUBLIC_SITE_URL is set we use it; otherwise we strip a leading
 * "admin." subdomain from the current host as a heuristic.
 */
function getPublicSiteOrigin(): string {
  const envUrl = (import.meta as any).env?.VITE_PUBLIC_SITE_URL;
  if (envUrl) return String(envUrl).replace(/\/+$/, '');
  if (typeof window === 'undefined') return '';
  const { protocol, host } = window.location;
  const stripped = host.replace(/^admin\./, '');
  return `${protocol}//${stripped}`;
}
