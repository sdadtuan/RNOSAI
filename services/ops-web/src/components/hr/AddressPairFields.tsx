'use client';

import { useEffect, useMemo, useState } from 'react';
import { FormCheck, FormCombobox, FormField, FormGrid, FormInput } from '@/components/form';
import type { HrStaffAddressDto } from '@/lib/hr-employee-file-api';
import { useVnGeo } from '@/lib/hr/use-vn-geo';
import type { VnWardOption } from '@/lib/vn-geo-api';

type Props = {
  permanent: HrStaffAddressDto;
  temporary: HrStaffAddressDto;
  canEdit: boolean;
  token: string;
  onPermanentChange: (next: HrStaffAddressDto) => void;
  onTemporaryChange: (next: HrStaffAddressDto) => void;
};

function AddressFields({
  title,
  value,
  disabled,
  token,
  onChange,
}: {
  title: string;
  value: HrStaffAddressDto;
  disabled?: boolean;
  token: string;
  onChange: (next: HrStaffAddressDto) => void;
}) {
  const { provinces, loadingProvinces, loadWards } = useVnGeo(token);
  const [wards, setWards] = useState<VnWardOption[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);

  const provinceCode = value.province_code?.trim() ?? '';
  const wardCode = value.ward_code?.trim() ?? '';

  useEffect(() => {
    if (!provinceCode) {
      setWards([]);
      return;
    }
    let cancelled = false;
    setLoadingWards(true);
    void loadWards(provinceCode)
      .then((rows) => {
        if (!cancelled) setWards(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingWards(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provinceCode, loadWards]);

  const provinceOptions = useMemo(() => {
    const opts = provinces.map((p) => ({ value: p.code, label: p.name }));
    if (provinceCode && !opts.some((o) => o.value === provinceCode)) {
      opts.unshift({ value: provinceCode, label: provinceCode });
    }
    return opts;
  }, [provinces, provinceCode]);

  const wardOptions = useMemo(() => {
    const opts = wards.map((w) => ({ value: w.code, label: w.name }));
    if (wardCode && !opts.some((o) => o.value === wardCode)) {
      opts.unshift({ value: wardCode, label: wardCode });
    }
    return opts;
  }, [wards, wardCode]);

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
        <FormField label="Tỉnh/Thành phố">
          <FormCombobox
            value={provinceCode}
            disabled={disabled}
            loading={loadingProvinces}
            options={provinceOptions}
            placeholder="Gõ tên tỉnh/TP hoặc mã…"
            onChange={(nextProvince) => {
              onChange({
                ...value,
                province_code: nextProvince,
                ward_code: nextProvince === provinceCode ? wardCode : '',
                district_code: '',
              });
            }}
          />
        </FormField>
        <FormField label="Phường/Xã">
          <FormCombobox
            value={wardCode}
            disabled={disabled}
            loading={Boolean(provinceCode) && loadingWards}
            options={wardOptions}
            placeholder={
              provinceCode ? 'Gõ tên phường/xã hoặc mã…' : 'Gõ phường/xã (chọn Tỉnh/TP để gợi ý)'
            }
            onChange={(nextWard) => onChange({ ...value, ward_code: nextWard, district_code: '' })}
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
  token,
  onPermanentChange,
  onTemporaryChange,
}: Props) {
  const sameAsPermanent = Boolean(temporary.same_as_permanent);

  return (
    <div className="stack-gap">
      <AddressFields
        title="Thường trú"
        value={permanent}
        disabled={!canEdit}
        token={token}
        onChange={onPermanentChange}
      />
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
                    ward_code: permanent.ward_code,
                    district_code: '',
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
        token={token}
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
