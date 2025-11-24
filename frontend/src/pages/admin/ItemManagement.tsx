// ItemManagementPage.tsx
import React, { useEffect, useState } from 'react';
import type { ShopItem } from '../../types/ShopItem';
import { getShopItems, createItem, deleteItem } from '../../api/axiosShop';
import { uploadItemImage } from '../../api/axiosUpload';
import Sidebar from '../../components/admin/AdminSidebar';
import ErrorMessage from '../../components/admin/ErrorMessage';
import { purple } from '@mui/material/colors';

type FormState = {
  name: string;
  price: number;
  description?: string;
  isListed: boolean;
  type: string;
  effect: {
    hintCount: number;
    freezeSeconds: number;
    scoreBoost: number;
    invincibleSeconds: number;
  };
  roulette: {
    enabled: boolean;
    weight: number;
  };
};

const ITEM_TYPES = [
  { value: 'hint', label: '힌트권' },
  { value: 'hint_bundle', label: '힌트 묶음' },
  { value: 'time_freeze', label: '시간 연장' },
  { value: 'random_buff', label: '랜덤 버프' },
  { value: 'score_boost', label: '점수 부스트' },
  { value: 'invincible', label: '무적권' },
];

const initialForm: FormState = {
  name: '',
  price: 0,
  description: '',
  isListed: true,
  type: 'hint',
  effect: {
    hintCount: 0,
    freezeSeconds: 0,
    scoreBoost: 0,
    invincibleSeconds: 0,
  },
  roulette: {
    enabled: false,
    weight: 1,
  },
};

const ItemManagementPage: React.FC = () => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // 테이블 컬럼 정의(헤더 렌더용)
  const columns = [
    { header: 'Image', accessor: 'image' },
    { header: 'Name', accessor: 'name' },
    { header: 'Type', accessor: 'type' },
    { header: 'Price', accessor: 'price' },
    { header: 'Effect', accessor: 'effect' },
    { header: 'Roulette', accessor: 'roulette' },
    { header: 'Listed', accessor: 'isListed' },
    { header: 'Actions', accessor: 'actions' },
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

  /** 이미지 파일 선택 처리 */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // 미리보기 생성
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /** 생성 */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return alert('이름을 입력하세요.');
    if (Number.isNaN(form.price) || form.price < 0) return alert('가격을 0 이상으로 입력하세요.');
    if (!form.type.trim()) return alert('타입을 선택하세요.');

    setSaving(true);
    setError(null);
    try {
      let uploadedImageUrl = '';

      // 이미지가 선택되었으면 먼저 업로드
      if (imageFile) {
        const uploadResult = await uploadItemImage(imageFile);
        uploadedImageUrl = uploadResult.imageUrl;
      }

      const payload = {
        name: form.name.trim(),
        price: Number(form.price),
        description: (form.description || '').trim() || '설명 없음',
        isListed: form.isListed,
        imageUrl: uploadedImageUrl,
        type: form.type.trim(),
        effect: {
          hintCount: Number(form.effect.hintCount) || 0,
          freezeSeconds: Number(form.effect.freezeSeconds) || 0,
          scoreBoost: Number(form.effect.scoreBoost) || 0,
          invincibleSeconds: Number(form.effect.invincibleSeconds) || 0,
        },
        roulette: {
          enabled: form.roulette.enabled,
          weight: Number(form.roulette.weight) || 1,
        },
      };
      const created = await createItem(payload); // POST /shop
      setItems(prev => [created, ...prev]);
      setForm(initialForm);
      setImageFile(null);
      setImagePreview('');
      alert('아이템을 생성했습니다.');
    } catch (e: any) {
      const msg = e?.response?.data?.msg ?? '생성에 실패했습니다.';
      setError(msg);
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  /** 삭제 */
  const handleDelete = async (itemId: string, itemName: string) => {
    if (!confirm(`"${itemName}" 아이템을 정말 삭제하시겠습니까?`)) return;

    try {
      await deleteItem(itemId);
      setItems(prev => prev.filter(item => (item as any)._id !== itemId));
      alert('아이템이 삭제되었습니다.');
    } catch (e: any) {
      const msg = e?.response?.data?.msg ?? '삭제에 실패했습니다.';
      alert(msg);
    }
  };

  return (
    <div className="admin-dashboard">
      <Sidebar />

      <div className="admin-content">
        <h1>Items Management</h1>
        {error && <ErrorMessage message={error} />}

        {/* 생성 폼 */}
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 900, marginBottom: 24 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, opacity: .8 }}>Name *</label>
              <input
                placeholder="힌트 1회권"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, opacity: .8 }}>Type *</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                required
                style={{
                  padding: '8px',
                  background: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: 4,
                  color: '#fff',
                }}
              >
                {ITEM_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontSize: 12, opacity: .8 }}>Price (HTO) *</label>
              <input
                type="number"
                min={0}
                placeholder="50"
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
                  accentColor: '#00f5ff',
                  appearance: 'auto',
                }}
              />
              상점에 표시 (Listed)
            </label>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 12, opacity: .8 }}>Description</label>
            <textarea
              rows={2}
              placeholder="아이템 설명"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Image Upload */}
          <div style={{ border: '1px solid #333', padding: 12, borderRadius: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Item Image (아이템 이미지)
            </label>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: imagePreview ? '1fr auto' : '1fr' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{
                    padding: '8px',
                    border: '1px solid #444',
                    borderRadius: 4,
                    background: '#1a1a1a',
                    color: '#fff',
                  }}
                />
                <small style={{ opacity: 0.6, fontSize: 11 }}>
                  PNG, JPG, GIF, WebP (최대 5MB)
                </small>
              </div>
              {imagePreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '2px solid #00f5ff',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview('');
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      background: '#ff4444',
                      border: 'none',
                      borderRadius: 4,
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    제거
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Effect Settings */}
          <div style={{ border: '1px solid #333', padding: 12, borderRadius: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Effect (효과) - 사용할 효과의 값만 입력
            </label>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, opacity: .8 }}>💡 Hint Count</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.effect.hintCount}
                  onChange={e => setForm(f => ({
                    ...f,
                    effect: { ...f.effect, hintCount: Number(e.target.value) }
                  }))}
                />
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, opacity: .8 }}>⏰ Extension Seconds (시간 연장)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.effect.freezeSeconds}
                  onChange={e => setForm(f => ({
                    ...f,
                    effect: { ...f.effect, freezeSeconds: Number(e.target.value) }
                  }))}
                />
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, opacity: .8 }}>🚀 Score Boost (%)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.effect.scoreBoost}
                  onChange={e => setForm(f => ({
                    ...f,
                    effect: { ...f.effect, scoreBoost: Number(e.target.value) }
                  }))}
                />
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, opacity: .8 }}>🛡️ Invincible Seconds</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.effect.invincibleSeconds}
                  onChange={e => setForm(f => ({
                    ...f,
                    effect: { ...f.effect, invincibleSeconds: Number(e.target.value) }
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Roulette Settings */}
          <div style={{ border: '1px solid #333', padding: 12, borderRadius: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Roulette (룰렛 설정)
            </label>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 2fr' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.roulette.enabled}
                  onChange={(e) => setForm(f => ({
                    ...f,
                    roulette: { ...f.roulette, enabled: e.target.checked }
                  }))}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: '#00f5ff',
                  }}
                />
                룰렛에 포함
              </label>

              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, opacity: .8 }}>Weight (확률 가중치)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="1"
                  value={form.roulette.weight}
                  onChange={e => setForm(f => ({
                    ...f,
                    roulette: { ...f.roulette, weight: Number(e.target.value) }
                  }))}
                  disabled={!form.roulette.enabled}
                />
              </div>
            </div>
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
                const effect = (item as any).effect;
                const roulette = (item as any).roulette;
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
                const baseUrl = apiUrl.replace('/api', '');
                const imageUrl = item.imageUrl ? `${baseUrl}${item.imageUrl}` : '';

                return (
                  <tr key={id}>
                    <td>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.name}
                          style={{
                            width: 60,
                            height: 60,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid #444',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 60,
                            height: 60,
                            border: '1px dashed #444',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.3,
                            fontSize: 9,
                          }}
                        >
                          No Image
                        </div>
                      )}
                    </td>
                    <td>{item.name}</td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        background: '#222',
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily: 'monospace'
                      }}>
                        {item.type}
                      </span>
                    </td>
                    <td>{item.price} HTO</td>
                    <td style={{ fontSize: 11 }}>
                      {effect?.hintCount > 0 && <div>💡 Hint: {effect.hintCount}</div>}
                      {effect?.freezeSeconds > 0 && <div>⏰ Extension: {effect.freezeSeconds}s</div>}
                      {effect?.scoreBoost > 0 && <div>🚀 Boost: +{effect.scoreBoost}%</div>}
                      {effect?.invincibleSeconds > 0 && <div>🛡️ Shield: {effect.invincibleSeconds}s</div>}
                      {(!effect?.hintCount && !effect?.freezeSeconds && !effect?.scoreBoost && !effect?.invincibleSeconds) && <span style={{ opacity: 0.5 }}>-</span>}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {roulette?.enabled ? (
                        <div>
                          <span style={{ color: '#00f5ff' }}>✓ Enabled</span>
                          <div style={{ opacity: 0.7 }}>Weight: {roulette.weight}</div>
                        </div>
                      ) : (
                        <span style={{ opacity: 0.5 }}>-</span>
                      )}
                    </td>
                    <td>{item.isListed ? '✓ Yes' : 'No'}</td>
                    <td>
                      <button
                        onClick={() => handleDelete(id, item.name)}
                        style={{
                          padding: '6px 12px',
                          background: '#ff4444',
                          border: 'none',
                          borderRadius: 4,
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        삭제
                      </button>
                    </td>
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
