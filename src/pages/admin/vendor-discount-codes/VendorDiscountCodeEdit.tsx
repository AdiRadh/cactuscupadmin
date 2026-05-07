import type { FC } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useOne, useUpdate } from '@refinedev/core';
import { Card, CardContent } from '@/components/ui/Card';
import { VendorDiscountCodeForm, type VendorDiscountCodeFormValues } from './VendorDiscountCodeForm';
import type { VendorDiscountCode } from './VendorDiscountCodesList';

export const VendorDiscountCodeEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { query, result } = useOne<VendorDiscountCode>({
    resource: 'vendor_discount_codes',
    id: id ?? '',
  });

  const { mutateAsync: updateRecord } = useUpdate();

  const handleSubmit = async (values: VendorDiscountCodeFormValues) => {
    if (!id) return;
    await updateRecord({
      resource: 'vendor_discount_codes',
      id,
      values,
    });
    navigate('/vendor-discount-codes');
  };

  if (query.isLoading || !result) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-white">Loading...</CardContent>
      </Card>
    );
  }

  const initial: Partial<VendorDiscountCodeFormValues> = {
    code: result.code,
    description: result.description ?? '',
    discount_type: result.discount_type,
    discount_value: result.discount_value,
    max_uses: result.max_uses,
    expires_at: result.expires_at,
    active: result.active,
  };

  return (
    <VendorDiscountCodeForm
      initial={initial}
      onSubmit={handleSubmit}
      submitText="Save changes"
      backLink="/vendor-discount-codes"
      title={`Edit ${result.code}`}
      subtitle={`Used ${result.uses_count} time${result.uses_count === 1 ? '' : 's'} so far.`}
    />
  );
};
