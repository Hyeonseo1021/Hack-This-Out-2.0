
import React, { useEffect, useState } from 'react';
import type { ShopItem } from '../../types/ShopItem';
import { getShopItems, createItem } from '../../api/axiosShop';

type FormState = {
  name: string;
  price: number;
  description: string;
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

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getShopItems();      // GET /shop/items
      setItems(list ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.msg ?? '목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (Number.isNaN(form.price) || form.price < 0) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        price: Number(form.price),
        description: form.description.trim() || undefined,
        isListed: form.isListed,   
      };
      const created = await createItem(payload); // POST /shop
      setItems(prev => [created, ...prev]);      // 바로 리스트에 반영
      setForm(initialForm);
    } catch (e: any) {
      setError(e?.response?.data?.msg ?? '생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Item Management (List + Create)</h2>

      {error && <div style={{ color: '#ff6b6b', marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ opacity: .7, marginBottom: 12 }}>불러오는 중…</div>}
      {saving && <div style={{ opacity: .7, marginBottom: 12 }}>저장 중…</div>}

      {/* 생성 폼 */}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 640, marginBottom: 24 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: .8 }}>Name</span>
          <input
            placeholder="EXP Booster x5"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
        </label>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, opacity: .8 }}>Price (HTO)</span>
            <input
              type="number"
              min={0}
              placeholder="e.g. 50"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
              required
            />
          </label>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: .8 }}>Description (optional)</span>
          <textarea
            rows={3}
            placeholder="간단 설명"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
                type="checkbox"
                checked={form.isListed}
                onChange={(e) => setForm(f => ({ ...f, isListed: e.target.checked }))}
            />
            생성 후 상점에 표시 (Listed)
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={saving}>추가하기</button>
          <button type="button" onClick={() => setForm(initialForm)} disabled={saving}>리셋</button>
        </div>
      </form>

      {/* 목록 */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>Image</th>
              <th style={th}>Name</th>
              <th style={th}>Price</th>
              <th style={th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={(it as any)._id}>
                <td style={td}>
                  {'imageUrl' in it && (it as any).imageUrl ? (
                    <img
                      src={(it as any).imageUrl}
                      alt={it.name}
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
                    />
                  ) : (
                    <div style={{ width: 56, height: 56, border: '1px dashed #444', borderRadius: 8 }} />
                  )}
                </td>
                <td style={td}>{it.name}</td>
                <td style={td}>{it.price} HTO</td>
                <td style={{ ...td, maxWidth: 360, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {'description' in it ? (it as any).description : ''}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td style={{ ...td, padding: 16, opacity: 0.7 }} colSpan={4}>
                  아이템이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const th: React.CSSProperties = { textAlign: 'left', borderBottom: '1px solid #444', padding: 8 };
const td: React.CSSProperties = { borderBottom: '1px solid #333', padding: 8, verticalAlign: 'middle' };

export default ItemManagementPage;