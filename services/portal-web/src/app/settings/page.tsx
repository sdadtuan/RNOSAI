'use client';

import Link from 'next/link';
import { BrandingSettingsForm } from '@/components/settings/BrandingSettingsForm';
import { ChangePasswordForm } from '@/components/settings/ChangePasswordForm';
import { ClientStaffSettings } from '@/components/settings/ClientStaffSettings';
import {
  CapacitorNativePushCard,
  PushNotificationCard,
} from '@/components/settings/PushSettingsCards';
import { SettingsPortalShell } from '@/components/settings/SettingsPortalShell';

export default function SettingsPage() {
  return (
    <SettingsPortalShell>
      {({ token, user, refreshBranding }) => (
        <>
          {user.role !== 'staff' ? (
            <section className="settings-card">
              <h2>Sản phẩm theo Page</h2>
              <p className="muted">Quản lý catalog sản phẩm gắn từng Fanpage — màu, ảnh, size, giá.</p>
              <Link href="/products" className="btn btn-secondary btn-sm">
                Mở Sản Phẩm
              </Link>
            </section>
          ) : null}
          <CapacitorNativePushCard token={token} />
          <PushNotificationCard token={token} />
          <BrandingSettingsForm
            token={token}
            canEdit={user.role === 'approver'}
            onUpdated={() => void refreshBranding()}
          />
          <ChangePasswordForm token={token} email={user.email} />
          <ClientStaffSettings token={token} canManage={user.role === 'approver' || user.role === 'admin'} />
        </>
      )}
    </SettingsPortalShell>
  );
}
