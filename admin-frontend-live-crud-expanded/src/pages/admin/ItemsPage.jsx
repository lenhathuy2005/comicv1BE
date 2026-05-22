import { useEffect, useMemo, useState } from 'react';
import { apiRequest, getImageUrl } from '../../services/api';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';

const emptyForm = {
  item_type_id: '',
  code: '',
  name: '',
  description: '',
  icon_url: '',
  icon_image: null,
  icon_preview: '',
  item_usage_type: 'static',
  rarity: 'common',
  is_stackable: true,
  max_stack: 999,
  usable_instantly: false,
  equippable: false,
  exp_bonus: 0,
  power_bonus: 0,
  afk_bonus_percent: 0,
  vip_required_level: 0,
  sellable: true,
  is_active: true,
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function rarityLabel(value) {
  const map = {
    common: 'Thường',
    rare: 'Hiếm',
    epic: 'Sử thi',
    legendary: 'Huyền thoại',
    mythic: 'Thần thoại',
  };
  return map[value] || value || 'Thường';
}

function rarityChipClass(value) {
  const map = {
    common: 'chip-gray',
    rare: 'chip-blue',
    epic: 'chip-purple',
    legendary: 'chip-gold',
    mythic: 'chip-pink',
  };
  return map[value] || 'chip-gray';
}

function boolToApi(value) {
  return value ? 1 : 0;
}

export default function ItemsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [status, setStatus] = useState('all');
  const [itemTypes, setItemTypes] = useState([]);
  const [items, setItems] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const [typeRes, itemRes, shopRes, txRes] = await Promise.all([
        apiRequest('/api/shop/admin/item-types'),
        apiRequest('/api/shop/admin/items'),
        apiRequest('/api/shop/admin/shop-items'),
        apiRequest('/api/shop/admin/transactions'),
      ]);
      setItemTypes(toArray(typeRes?.data));
      setItems(toArray(itemRes?.data));
      setShopItems(toArray(shopRes?.data));
      setTransactions(toArray(txRes?.data));
    } catch (error) {
      setErrorText(error.message || 'Không tải được dữ liệu vật phẩm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rows = useMemo(() => {
    const saleMap = new Map(shopItems.map((row) => [Number(row.item_id), row]));
    const soldMap = transactions.reduce((map, tx) => {
      if (tx.source_type === 'item' && tx.item_id) {
        map.set(Number(tx.item_id), (map.get(Number(tx.item_id)) || 0) + Number(tx.quantity || 0));
      }
      return map;
    }, new Map());

    return items
      .map((item) => {
        const shopRow = saleMap.get(Number(item.id));
        return {
          ...item,
          shopRow,
          price: Number(shopRow?.price_gold || shopRow?.price_premium || 0),
          stock_quantity: shopRow?.stock_quantity ?? null,
          soldQuantity: soldMap.get(Number(item.id)) || 0,
        };
      })
      .filter((item) => {
        const q = keyword.trim().toLowerCase();
        const okKeyword = !q || JSON.stringify(item).toLowerCase().includes(q);
        const okCategory = category === 'all' || String(item.item_type_id) === category;
        const okRarity = rarity === 'all' || item.rarity === rarity;
        const okStatus = status === 'all' || String(Number(item.is_active) === 1 ? 'active' : 'inactive') === status;
        return okKeyword && okCategory && okRarity && okStatus;
      });
  }, [items, shopItems, transactions, keyword, category, rarity, status]);

  const stats = [
    { label: 'Tổng vật phẩm', value: items.length, icon: '◫', tone: 'mint' },
    { label: 'Đang bán', value: rows.filter((row) => row.shopRow && Number(row.shopRow.is_active) === 1).length, icon: '✓', tone: 'green' },
    { label: 'Hết hàng', value: rows.filter((row) => row.stock_quantity !== null && Number(row.stock_quantity) <= 0).length, icon: '✕', tone: 'red' },
    { label: 'Doanh thu 7 ngày', value: formatNumber(transactions.filter((tx) => tx.source_type === 'item').reduce((sum, tx) => sum + Number(tx.total_amount || 0), 0)), icon: '💲', tone: 'mint' },
  ];

  const openCreate = () => {
    setEditingRow(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    setForm({
      item_type_id: row.item_type_id || '',
      code: row.code || '',
      name: row.name || '',
      description: row.description || '',
      icon_url: row.icon_url || '',
      icon_image: null,
      icon_preview: row.icon_url ? getImageUrl(row.icon_url) : '',
      item_usage_type: Number(row.usable_instantly) === 1 ? 'active' : 'static',
      rarity: row.rarity || 'common',
      is_stackable: Boolean(row.is_stackable),
      max_stack: row.max_stack || 999,
      usable_instantly: Boolean(row.usable_instantly),
      equippable: Boolean(row.equippable),
      exp_bonus: row.exp_bonus || 0,
      power_bonus: row.power_bonus || 0,
      afk_bonus_percent: row.afk_bonus_percent || 0,
      vip_required_level: row.vip_required_level || 0,
      sellable: Boolean(row.sellable),
      is_active: Boolean(row.is_active),
    });
    setModalOpen(true);
  };

  const handleIconImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    setForm((prev) => ({
      ...prev,
      icon_image: file,
      icon_preview: file ? URL.createObjectURL(file) : prev.icon_preview,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('item_type_id', String(Number(form.item_type_id)));
      payload.append('code', form.code);
      payload.append('name', form.name);
      payload.append('description', form.description || '');
      payload.append('rarity', form.rarity);
      payload.append('is_stackable', String(boolToApi(form.is_stackable)));
      payload.append('max_stack', String(Number(form.max_stack)));
      payload.append('usable_instantly', form.item_usage_type === 'active' ? '1' : '0');
      payload.append('equippable', String(boolToApi(form.equippable)));
      payload.append('exp_bonus', String(Number(form.exp_bonus || 0)));
      payload.append('power_bonus', String(Number(form.power_bonus || 0)));
      payload.append('afk_bonus_percent', String(Number(form.afk_bonus_percent || 0)));
      payload.append('vip_required_level', String(Number(form.vip_required_level || 0)));
      payload.append('sellable', String(boolToApi(form.sellable)));
      payload.append('is_active', String(boolToApi(form.is_active)));

      if (form.icon_image) {
        payload.append('icon_image', form.icon_image);
      } else if (form.icon_url) {
        payload.append('icon_url', form.icon_url);
      }

      if (editingRow) {
        await apiRequest(`/api/shop/admin/items/${editingRow.id}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        await apiRequest('/api/shop/admin/items', {
          method: 'POST',
          body: payload,
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu vật phẩm thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Ẩn vật phẩm ${row.name}?`)) return;
    try {
      await apiRequest(`/api/shop/admin/items/${row.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Ẩn vật phẩm thất bại');
    }
  };

  const renderAttributeChips = (row) => {
    const chips = [];
    if (Number(row.exp_bonus) > 0) chips.push({ label: `EXP +${formatNumber(row.exp_bonus)}`, cls: 'chip-gold' });
    if (Number(row.power_bonus) > 0) chips.push({ label: `ATK +${formatNumber(row.power_bonus)}`, cls: 'chip-red' });
    if (Number(row.afk_bonus_percent) > 0) chips.push({ label: `AFK +${row.afk_bonus_percent}%`, cls: 'chip-purple' });
    if (!chips.length) chips.push({ label: row.equippable ? 'Trang bị' : 'Cơ bản', cls: 'chip-gray' });
    return chips.map((chip) => <span key={chip.label} className={`readdy-chip ${chip.cls}`}>{chip.label}</span>);
  };

  return (
    <div className="readdy-page">
      <PageTitleBar
        title="Quản lý Vật phẩm"
        description="Quản lý toàn bộ vật phẩm trong shop"
        action={<button className="teal-btn" onClick={openCreate}>+ Thêm vật phẩm</button>}
      />

      <StatCardsRow items={stats} />

      <div className="panel readdy-toolbar-card">
        <div className="readdy-toolbar toolbar-items-visual">
          <div className="field-stack">
            <label>Tìm kiếm</label>
            <div className="readdy-search-input">
              <span>⌕</span>
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm theo tên vật phẩm..." />
            </div>
          </div>
          <div className="field-stack">
            <label>Danh mục</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Tất cả</option>
              {itemTypes.map((type) => (
                <option key={type.id} value={String(type.id)}>{type.name}</option>
              ))}
            </select>
          </div>
          <div className="field-stack">
            <label>Độ hiếm</label>
            <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="common">Thường</option>
              <option value="rare">Hiếm</option>
              <option value="epic">Sử thi</option>
              <option value="legendary">Huyền thoại</option>
              <option value="mythic">Thần thoại</option>
            </select>
          </div>
          <div className="field-stack">
            <label>Trạng thái</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="active">Đang bán</option>
              <option value="inactive">Đã ẩn</option>
            </select>
          </div>
        </div>
        <div className="toolbar-footnote">Hiển thị 1-{rows.length} trong tổng số {items.length} vật phẩm</div>
      </div>

      {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
      {loading ? <div className="empty-card"><div className="empty-title">Đang tải dữ liệu vật phẩm...</div></div> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState title="Chưa có vật phẩm nào" description="Thêm item mới từ backend để hiển thị tại đây." action={<button className="teal-btn" onClick={openCreate}>Thêm vật phẩm</button>} />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="panel readdy-table-panel">
          <div className="table-wrap">
            <table className="readdy-table">
              <thead>
                <tr>
                  <th>Vật phẩm</th>
                  <th>Danh mục</th>
                  <th>Độ hiếm</th>
                  <th>Giá</th>
                  <th>Tồn kho</th>
                  <th>Thuộc tính</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="readdy-comic-row">
                        {row.icon_url ? <img className="table-thumb" src={row.icon_url} alt={row.name} /> : <div className="comic-thumb">✦</div>}
                        <div className="readdy-user-copy">
                          <strong>{row.name}</strong>
                          <span>{row.code}</span>
                        </div>
                      </div>
                    </td>
                    <td>{row.item_type_name}</td>
                    <td><span className={`readdy-chip ${rarityChipClass(row.rarity)}`}>{rarityLabel(row.rarity)}</span></td>
                    <td>🪙 {formatNumber(row.price)}</td>
                    <td>{row.stock_quantity === null ? '∞' : formatNumber(row.stock_quantity)}</td>
                    <td><div className="attr-chip-row">{renderAttributeChips(row)}</div></td>
                    <td><span className={`readdy-chip ${Number(row.is_active) === 1 ? 'chip-green' : 'chip-gray'}`}>{Number(row.is_active) === 1 ? 'Đang bán' : 'Đã ẩn'}</span></td>
                    <td>
                      <div className="readdy-actions-inline">
                        <button className="icon-btn teal" onClick={() => openEdit(row)}>✎</button>
                        <button className="icon-btn red" onClick={() => handleDelete(row)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <CrudModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRow ? 'Chỉnh sửa vật phẩm' : 'Thêm vật phẩm'}
        footer={
          <>
            <button className="secondary-btn" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="teal-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu...' : 'Lưu vật phẩm'}</button>
          </>
        }
      >
        <div className="form-grid-two">
          <label>
            Danh mục
            <select value={form.item_type_id} onChange={(e) => setForm((prev) => ({ ...prev, item_type_id: e.target.value }))}>
              <option value="">Chọn danh mục</option>
              {itemTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </label>
          <label>Mã vật phẩm<input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} /></label>
          <label>Tên vật phẩm<input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></label>
          <label>
            Ảnh vật phẩm
            <input type="file" accept="image/*" onChange={handleIconImageChange} />
            {form.icon_preview ? (
              <img
                src={form.icon_preview}
                alt="Preview vật phẩm"
                style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 14, marginTop: 8, border: '1px solid #d8dee9' }}
              />
            ) : (
              <small>Chọn ảnh trực tiếp, không cần dán URL.</small>
            )}
          </label>
          <label>
            Độ hiếm
            <select value={form.rarity} onChange={(e) => setForm((prev) => ({ ...prev, rarity: e.target.value }))}>
              <option value="common">Thường</option>
              <option value="rare">Hiếm</option>
              <option value="epic">Sử thi</option>
              <option value="legendary">Huyền thoại</option>
              <option value="mythic">Thần thoại</option>
            </select>
          </label>
          <label>Max stack<input type="number" value={form.max_stack} onChange={(e) => setForm((prev) => ({ ...prev, max_stack: e.target.value }))} /></label>
          <label>EXP bonus<input type="number" value={form.exp_bonus} onChange={(e) => setForm((prev) => ({ ...prev, exp_bonus: e.target.value }))} /></label>
          <label>Power bonus<input type="number" value={form.power_bonus} onChange={(e) => setForm((prev) => ({ ...prev, power_bonus: e.target.value }))} /></label>
          <label>AFK bonus %<input type="number" value={form.afk_bonus_percent} onChange={(e) => setForm((prev) => ({ ...prev, afk_bonus_percent: e.target.value }))} /></label>
          <label>VIP yêu cầu<input type="number" value={form.vip_required_level} onChange={(e) => setForm((prev) => ({ ...prev, vip_required_level: e.target.value }))} /></label>
          <label className="form-checkbox-inline"><input type="checkbox" checked={form.is_stackable} onChange={(e) => setForm((prev) => ({ ...prev, is_stackable: e.target.checked }))} /> Có thể cộng dồn</label>
          <label>
            Loại vật phẩm
            <select value={form.item_usage_type} onChange={(e) => setForm((prev) => ({ ...prev, item_usage_type: e.target.value }))}>
              <option value="active">Vật phẩm kích hoạt</option>
              <option value="static">Vật phẩm tĩnh</option>
            </select>
          </label>
          <label className="form-checkbox-inline"><input type="checkbox" checked={form.equippable} onChange={(e) => setForm((prev) => ({ ...prev, equippable: e.target.checked }))} /> Có thể trang bị</label>
          <label className="form-checkbox-inline"><input type="checkbox" checked={form.sellable} onChange={(e) => setForm((prev) => ({ ...prev, sellable: e.target.checked }))} /> Có thể bán</label>
          <label className="form-checkbox-inline"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} /> Kích hoạt</label>
          <label className="form-span-2">Mô tả<textarea rows="4" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
        </div>
      </CrudModal>
    </div>
  );
}
