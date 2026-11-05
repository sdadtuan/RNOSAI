'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createQtCatalogGroup,
  createQtCatalogService,
  deleteQtCatalogGroup,
  deleteQtCatalogService,
  getQtQuoteCatalogDoc,
  updateQtCatalogGroup,
  updateQtCatalogService,
  type QtCatalogGroup,
  type QtCatalogItem,
  type QtIndustryPackage,
} from '@/lib/crm/qt-api';
import { asCatalogGroups, QtCatalogOs } from '@/components/crm/qt/QtCatalogOs';

export function AdminServicesPortfolioPanel({
  token,
  canManage = false,
}: {
  token: string | null;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<QtCatalogItem[]>([]);
  const [groups, setGroups] = useState<QtCatalogGroup[]>([]);
  const [packages, setPackages] = useState<QtIndustryPackage[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) {
      setItems([]);
      setGroups([]);
      setPackages([]);
      setError('Chưa đăng nhập — không tải được Portfolio 21 DV');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const doc = await getQtQuoteCatalogDoc(token);
      const families = Array.isArray(doc.services)
        ? doc.services
        : Array.isArray(doc.families)
          ? doc.families
          : [];
      setItems(families);
      setGroups(asCatalogGroups(doc.groups, families));
      setPackages(Array.isArray(doc.packages) ? doc.packages : []);
    } catch (caught) {
      setItems([]);
      setGroups([]);
      setPackages([]);
      setError(caught instanceof Error ? caught.message : 'Tải portfolio thất bại');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const navGroups = useMemo(() => asCatalogGroups(groups, items), [groups, items]);

  return (
    <>
      {error ? (
        <section className="qt-card qt-card--error" style={{ marginBottom: 12 }}>
          <p>{error}</p>
          <button type="button" className="qt-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : null}
      <QtCatalogOs
        variant="admin"
        items={items}
        groups={navGroups}
        packages={packages}
        selectedGroup={selectedGroup}
        onSelectGroup={(group) => setSelectedGroup((current) => (current === group ? null : group))}
        onOpenService={(item) => router.push(`/admin/services/families/${item.dv_code}`)}
        canManage={canManage}
        loading={loading}
        onCreateGroup={async (body) => {
          if (!token) return;
          try {
            await createQtCatalogGroup(token, body);
            await load();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Không tạo được nhóm');
            throw caught;
          }
        }}
        onUpdateGroup={async (key, body) => {
          if (!token) return;
          try {
            await updateQtCatalogGroup(token, key, body);
            await load();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Không sửa được nhóm');
            throw caught;
          }
        }}
        onDeleteGroup={async (key) => {
          if (!token) return;
          try {
            await deleteQtCatalogGroup(token, key);
            await load();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Không xóa được nhóm');
          }
        }}
        onCreateService={async (body) => {
          if (!token) return;
          try {
            await createQtCatalogService(token, body);
            await load();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Không tạo được dịch vụ');
            throw caught;
          }
        }}
        onUpdateService={async (dv, body) => {
          if (!token) return;
          try {
            await updateQtCatalogService(token, dv, body);
            await load();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Không sửa được dịch vụ');
            throw caught;
          }
        }}
        onDeleteService={async (dv) => {
          if (!token) return;
          try {
            await deleteQtCatalogService(token, dv);
            await load();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Không xóa được dịch vụ');
          }
        }}
      />
    </>
  );
}
