import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreate } from '@refinedev/core';
import { VendorDiscountCodeForm, type VendorDiscountCodeFormValues } from './VendorDiscountCodeForm';

export const VendorDiscountCodeCreate: FC = () => {
  const navigate = useNavigate();
  const { mutateAsync: createRecord } = useCreate();

  const handleSubmit = async (values: VendorDiscountCodeFormValues) => {
    await createRecord({
      resource: 'vendor_discount_codes',
      values,
    });
    navigate('/vendor-discount-codes');
  };

  return (
    <VendorDiscountCodeForm
      onSubmit={handleSubmit}
      submitText="Create code"
      backLink="/vendor-discount-codes"
      title="New Vendor Discount Code"
      subtitle="Codes can discount or fully waive the vendor table fee."
    />
  );
};
