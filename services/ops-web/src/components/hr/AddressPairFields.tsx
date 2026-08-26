'use client';

import { FormCheck, FormField, FormGrid, FormInput } from '@/components/form';
import type { HrStaffAddressDto } from '@/lib/hr-employee-file-api';

type Props = {
  permanent: HrStaffAddressDto;
  temporary: HrStaffAddressDto;
  canEdit: boolean;
  onPermanentChange: (next: HrStaffAddressDto) => void;
  onTemporaryChange: (next: HrStaffAddressDto) => void;
};

function AddressFields({
  title,
  value,
  disabled,
  onChange,
}: {
  title: string;
  value: HrStaffAddressDto;
  disabled?: boolean;
  onChange: (next: HrStaffAddressDto) => void;
}) {
  return (
    <div className="hr-address-block">
      <h4 className="form-section-title" style={{ fontSize: '0.9rem' }}>
        {title}
      </h4>
      <FormGrid cols={2}>
        <FormField label="Số nhà, đường">
          <FormInput
            value={value.line1 ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, line1: e.target.value })}
          />
        </FormField>
        <FormField label="Mã tỉnh/TP">
          <FormInput
            value={value.province_code ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, province_code: e.target.value })}
          />
        </FormField>
        <FormField label="Mã quận/huyện">
          <FormInput
            value={value.district_code ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, district_code: e.target.value })}
          />
        </FormField>
        <FormField label="Mã phường/xã">
          <FormInput
            value={value.ward_code ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, ward_code: e.target.value })}
          />
        </FormField>
      </FormGrid>
    </div>
  );
}

export function AddressPairFields({
  permanent,
  temporary,
  canEdit,
  onPermanentChange,
  onTemporaryChange,
}: Props) {
  const sameAsPermanent = Boolean(temporary.same_as_permanent);

  return (
    <div className="stack-gap">
      <AddressFields title="Thường trú" value={permanent} disabled={!canEdit} onChange={onPermanentChange} />
      <FormCheck label="Giống thường trú">
        <input
          type="checkbox"
          checked={sameAsPermanent}
          disabled={!canEdit}
          onChange={(e) => {
            const checked = e.target.checked;
            onTemporaryChange({
              ...temporary,
              same_as_permanent: checked,
              ...(checked
                ? {
                    line1: permanent.line1,
                    province_code: permanent.province_code,
                    district_code: permanent.district_code,
                    ward_code: permanent.ward_code,
                  }
                : {}),
            });
          }}
        />
      </FormCheck>
      <AddressFields
        title="Tạm trú"
        value={temporary}
        disabled={!canEdit || sameAsPermanent}
        onChange={onTemporaryChange}
      />
    </div>
  );
}

export function emptyAddress(kind: HrStaffAddressDto['kind']): HrStaffAddressDto {
  return {
    kind,
    line1: '',
    province_code: '',
    district_code: '',
    ward_code: '',
    same_as_permanent: false,
  };
}

export function pickAddress(addresses: HrStaffAddressDto[], kind: HrStaffAddressDto['kind']): HrStaffAddressDto {
  return addresses.find((a) => a.kind === kind) ?? emptyAddress(kind);
}
