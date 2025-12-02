// ItemManagementPage.tsx
import React, { useEffect, useState } from 'react';
import type { ShopItem } from '../../types/ShopItem';
import { getShopItems, createItem, deleteItem } from '../../api/axiosShop';
import { uploadItemImage } from '../../api/axiosUpload';
import Sidebar from '../../components/admin/AdminSidebar';
import ErrorMessage from '../../components/admin/ErrorMessage';
import '../../assets/scss/admin/DataTable.scss';

type FormState = {
  name: {
    ko: string;
    en: string;
  };
  price: number;
  description: {
    ko: string;
    en: string;
  };
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
  name: {
    ko: '',
    en: '',
  },
  price: 0,
  description: {
    ko: '',
    en: '',
  },
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
    weight: 0,
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

  // 🎰 현재 룰렛 확률 합계 계산
  const calculateRouletteTotal = () => {
    let total = 0;
    items.forEach(item => {
      const roulette = (item as any).roulette;
      if (roulette?.enabled) {
        total += roulette.weight || 0;
      }
    });
    // 현재 입력 중인 아이템이 룰렛에 포함되면 추가
    if (form.roulette.enabled) {
      total += form.roulette.weight || 0;
    }
    return total;
  };

  // 테이블 컬럼 정의(헤더 렌더용)
  const columns = [
    { header: 'Image', accessor: 'image' },
    { header: 'Name (KO/EN)', accessor: 'name' },
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
    if (!form.name.ko.trim() || !form.name.en.trim()) return alert('한글/영어 이름을 모두 입력하세요.');
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
        name: {
          ko: form.name.ko.trim(),
          en: form.name.en.trim(),
        },
        price: Number(form.price),
        description: {
          ko: form.description.ko.trim() || '설명 없음',
          en: form.description.en.trim() || 'No description',
        },
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
          weight: Number(form.roulette.weight) || 0,
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
  const handleDelete = async (itemId: string, itemName: any) => {
    const displayName = typeof itemName === 'object' ? itemName.ko || itemName.en : itemName;
    if (!confirm(`"${displayName}" 아이템을 정말 삭제하시겠습니까?`)) return;

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
          {/* Name Fields - Korean and English */}
          <div style={{ border: '1px solid #333', padding: 12, borderRadius: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Name (이름) *
            </label>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, opacity: .8 }}>한글</label>
                <input
                  placeholder="힌트 1회권"
                  value={form.name.ko}
                  onChange={e => setForm(f => ({ ...f, name: { ...f.name, ko: e.target.value } }))}
                  required
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, opacity: .8 }}>English</label>
                <input
                  placeholder="Single Hint"
                  value={form.name.en}
                  onChange={e => setForm(f => ({ ...f, name: { ...f.name, en: e.target.value } }))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Description Fields - Korean and English */}
          <div style={{ border: '1px solid #333', padding: 12, borderRadius: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Description (설명)
            </label>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, opacity: .8 }}>한글</label>
                <textarea
                  rows={2}
                  placeholder="문제 해결을 위한 힌트를 제공합니다"
                  value={form.description.ko}
                  onChange={e => setForm(f => ({ ...f, description: { ...f.description, ko: e.target.value } }))}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ fontSize: 12, opacity: .8 }}>English</label>
                <textarea
                  rows={2}
                  placeholder="Provides a hint to help solve the problem"
                  value={form.description.en}
                  onChange={e => setForm(f => ({ ...f, description: { ...f.description, en: e.target.value } }))}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
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
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <label style={{ fontSize: 12, opacity: .8 }}>Hint Count</label>
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
                <label style={{ fontSize: 12, opacity: .8 }}>Extension Seconds (시간 연장)</label>
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
                <label style={{ fontSize: 12, opacity: .8 }}>Score Boost (%)</label>
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
                <label style={{ fontSize: 12, opacity: .8 }}>Invincible Seconds</label>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Roulette (룰렛 설정)
              </label>
              {(() => {
                const total = calculateRouletteTotal();
                const isValid = Math.abs(total - 1) < 0.001;
                const textColor = total === 0 ? '#888' : isValid ? '#00ff88' : '#ff8800';
                return (
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: textColor,
                    padding: '4px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 4,
                    border: `1px solid ${textColor}`,
                  }}>
                    현재 확률 합계: {total.toFixed(3)} {isValid ? '✓' : total > 0 ? '⚠️' : ''}
                  </div>
                );
              })()}
            </div>
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
                <label style={{ fontSize: 12, opacity: .8 }}>
                  Weight (확률 가중치, 소수점 - 합계 = 1)
                </label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.001}
                  placeholder="0.1 (10%)"
                  value={form.roulette.weight}
                  onChange={e => setForm(f => ({
                    ...f,
                    roulette: { ...f.roulette, weight: Number(e.target.value) }
                  }))}
                  disabled={!form.roulette.enabled}
                />
                <small style={{ fontSize: 10, opacity: 0.6 }}>
                  예: 0.1 = 10%, 0.25 = 25%, 0.5 = 50%
                </small>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving}>추가하기</button>
            <button type="button" onClick={() => setForm(initialForm)} disabled={saving}>리셋</button>
          </div>
        </form>

        {/* 목록 테이블 */}
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

                // Display name - handle both old (string) and new (object) format
                const itemName = typeof item.name === 'object'
                  ? `${(item.name as any).ko} / ${(item.name as any).en}`
                  : item.name;

                return (
                  <tr key={id}>
                    <td>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={itemName}
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
                    <td style={{ fontSize: '0.9rem' }}>{itemName}</td>
                    <td>
                      <code style={{ fontSize: '0.85rem' }}>{item.type}</code>
                    </td>
                    <td>{item.price} HTO</td>
                    <td>
                      {effect?.hintCount > 0 && <div>💡 Hint: {effect.hintCount}</div>}
                      {effect?.freezeSeconds > 0 && <div>⏰ Extension: {effect.freezeSeconds}s</div>}
                      {effect?.scoreBoost > 0 && <div>🚀 Boost: +{effect.scoreBoost}%</div>}
                      {effect?.invincibleSeconds > 0 && <div>🛡️ Shield: {effect.invincibleSeconds}s</div>}
                      {(!effect?.hintCount && !effect?.freezeSeconds && !effect?.scoreBoost && !effect?.invincibleSeconds) && <span style={{ opacity: 0.5 }}>-</span>}
                    </td>
                    <td>
                      {roulette?.enabled ? (
                        <div>
                          <span style={{ color: '#00f5ff' }}>✓ Enabled</span>
                          <div style={{ opacity: 0.7, fontSize: '0.85rem' }}>
                            Weight: {roulette.weight}
                          </div>
                          <div style={{
                            color: '#00ff88',
                            fontWeight: 600,
                            fontSize: '0.8rem'
                          }}>
                            ({(roulette.weight * 100).toFixed(1)}%)
                          </div>
                        </div>
                      ) : (
                        <span style={{ opacity: 0.5 }}>-</span>
                      )}
                    </td>
                    <td>{item.isListed ? '✓ Yes' : 'No'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleDelete(id, item.name)}
                          className="delete-button"
                        >
                          삭제
                        </button>
                      </div>
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
