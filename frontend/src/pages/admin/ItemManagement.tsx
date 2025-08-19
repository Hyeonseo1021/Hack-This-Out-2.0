// ItemManagementPage.tsx
import React, { useEffect, useState } from 'react';
import type { ShopItem } from '../../types/ShopItem';
import { getShopItems, createItem } from '../../api/axiosShop'; // <- toggle/delete 제거
import Sidebar from '../../components/admin/AdminSidebar';
import ErrorMessage from '../../components/admin/ErrorMessage';
import { purple } from '@mui/material/colors';

type FormState = {
  name: string;
  price: number;
  description?: string;
  isListed: boolean;
};

const initialForm: FormState = {
  name: '',
  price: 0,
  description: '',
  isListed: true,
};

const ItemManagementPage: React.FC = () => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 테이블 컬럼 정의(헤더 렌더용) - Actions 제거
  const columns = [
    { header: 'Image', accessor: 'image' },
    { header: 'Name', accessor: 'name' },
    { header: 'Price', accessor: 'price' },
    { header: 'Listed', accessor: 'isListed' },
  ];

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getShopItems(); // GET /shop/items
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.response?.data?.msg ?? '목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  /** 생성 */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('이름을 입력하세요.');
    if (Number.isNaN(form.price) || form.price < 0) return alert('가격을 0 이상으로 입력하세요.');

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        price: Number(form.price),
        description: (form.description || '').trim() || undefined,
        isListed: form.isListed,
      };
      const created = await createItem(payload); // POST /shop
      setItems(prev => [created, ...prev]);
      setForm(initialForm);
      alert('아이템을 생성했습니다.');
    } catch (e: any) {
      const msg = e?.response?.data?.msg ?? '생성에 실패했습니다.';
      setError(msg);
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <Sidebar />

      <div className="admin-content">
        <h1>Items Management</h1>
        {error && <ErrorMessage message={error} />}

        {/* 생성 폼 */}
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 680, marginBottom: 24 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 12, opacity: .8 }}>Name</label>
            <input
              placeholder="EXP Booster x5"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, opacity: .8 }}>Price (HTO)</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 50"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                required
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22}}>
              <input
                type="checkbox"
                checked={form.isListed}
                onChange={(e) => setForm(f => ({ ...f, isListed: e.target.checked }))}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: '#00f5ff',   // 체크 색 (지원하는 브라우저)
                  appearance: 'auto',       
                }}
              />
              생성 후 상점에 표시 (Listed)
            </label>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 12, opacity: .8 }}>Description (optional)</label>
            <textarea
              rows={3}
              placeholder="간단 설명"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving}>추가하기</button>
            <button type="button" onClick={() => setForm(initialForm)} disabled={saving}>리셋</button>
          </div>
        </form>

        {/* 목록 테이블 - Actions 컬럼/버튼 제거 */}
        {loading ? (
          <div>불러오는 중…</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.accessor}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const id = (item as any)._id as string;
                return (
                  <tr key={id}>
                    <td>
                      {'imageUrl' in item && (item as any).imageUrl ? (
                        <img
                          src={(item as any).imageUrl}
                          alt={item.name}
                          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }}
                        />
                      ) : (
                        <div style={{ width: 48, height: 48, border: '1px dashed #444', borderRadius: 8 }} />
                      )}
                    </td>
                    <td>{item.name}</td>
                    <td>{item.price} HTO</td>
                    <td>{item.isListed ? 'Yes' : 'No'}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: 'center', opacity: 0.7 }}>
                    아이템이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ItemManagementPage;
