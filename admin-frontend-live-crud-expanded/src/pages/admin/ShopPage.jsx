import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';

const emptyForm = {
  item_id: '',
  price_gold: 0,
  price_premium: 0,
  stock_quantity: '',
  daily_purchase_limit: '',
  vip_required_level: 0,
  start_at: '',
  end_at: '',
  is_active: true,
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function toDatetimeLocal(value) {
  if (!value) return '';
  return String(value).replace(' ', 'T').slice(0, 16);
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatCurrency(value) {
  return formatNumber(value);
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

export default function ShopPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [items, setItems] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const [itemsRes, shopRes, txRes, typeRes] = await Promise.all([
        apiRequest('/api/shop/admin/items'),
        apiRequest('/api/shop/admin/shop-items'),
        apiRequest('/api/shop/admin/transactions'),
        apiRequest('/api/shop/admin/item-types'),
      ]);
      setItems(toArray(itemsRes?.data));
      setShopItems(toArray(shopRes?.data));
      setTransactions(toArray(txRes?.data));
      setItemTypes(toArray(typeRes?.data));
    } catch (error) {
      setErrorText(error.message || 'Không tải được dữ liệu shop');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rows = useMemo(() => {
    const txItems = transactions.filter((tx) => tx.source_type === 'item' && tx.transaction_status === 'success');
    return shopItems
      .map((shopRow) => {
        const item = items.find((entry) => Number(entry.id) === Number(shopRow.item_id));
        const soldRows = txItems.filter((tx) => Number(tx.item_id) === Number(shopRow.item_id));
        const soldQuantity = soldRows.reduce((sum, tx) => sum + Number(tx.quantity || 0), 0);
        const revenue = soldRows.reduce((sum, tx) => sum + Number(tx.total_amount || 0), 0);
        return {
          ...shopRow,
          item_name: item?.name || shopRow.item_name || `Item #${shopRow.item_id}`,
          item_type_name: item?.item_type_name || '-',
          item_type_id: item?.item_type_id || null,
          icon_url: item?.icon_url || null,
          rarity: item?.rarity || 'common',
          description: item?.description || '',
          soldQuantity,
          revenue,
        };
      })
      .filter((item) => {
        const q = keyword.trim().toLowerCase();
        const okKeyword = !q || JSON.stringify(item).toLowerCase().includes(q);
        const okCategory = category === 'all' || String(item.item_type_id) === category;
        const okRarity = rarity === 'all' || item.rarity === rarity;
        return okKeyword && okCategory && okRarity;
      });
  }, [shopItems, items, transactions, keyword, category, rarity]);

  const stats = useMemo(() => {
    const revenue7d = transactions
      .filter((tx) => tx.source_type === 'item')
      .filter((tx) => Date.now() - new Date(tx.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000)
      .reduce((sum, tx) => sum + Number(tx.total_amount || 0), 0);

    return [
      { label: 'Tổng vật phẩm', value: shopItems.length, icon: '🎁', tone: 'pink' },
      { label: 'Đang bán', value: shopItems.filter((item) => Number(item.is_active) === 1).length, icon: '🏪', tone: 'green' },
      { label: 'Hết hàng', value: rows.filter((item) => item.stock_quantity !== null && Number(item.stock_quantity) <= 0).length, icon: '⛔', tone: 'red' },
      { label: 'Doanh thu (7 ngày)', value: formatCurrency(revenue7d), icon: '🪙', tone: 'gold' },
    ];
  }, [shopItems, rows, transactions]);

  const openCreate = () => {
    setEditingRow(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    setForm({
      item_id: row.item_id || '',
      price_gold: row.price_gold || 0,
      price_premium: row.price_premium || 0,
      stock_quantity: row.stock_quantity ?? '',
      daily_purchase_limit: row.daily_purchase_limit ?? '',
      vip_required_level: row.vip_required_level || 0,
      start_at: toDatetimeLocal(row.start_at),
      end_at: toDatetimeLocal(row.end_at),
      is_active: Boolean(row.is_active),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        item_id: Number(form.item_id),
        price_gold: Number(form.price_gold || 0),
        price_premium: Number(form.price_premium || 0),
        stock_quantity: form.stock_quantity === '' ? null : Number(form.stock_quantity),
        daily_purchase_limit: form.daily_purchase_limit === '' ? null : Number(form.daily_purchase_limit),
        vip_required_level: Number(form.vip_required_level || 0),
        start_at: form.start_at ? form.start_at.replace('T', ' ') + ':00' : null,
        end_at: form.end_at ? form.end_at.replace('T', ' ') + ':00' : null,
        is_active: form.is_active ? 1 : 0,
      };
      if (editingRow) {
        await apiRequest(`/api/shop/admin/shop-items/${editingRow.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/shop/admin/shop-items', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu shop item thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Gỡ ${row.item_name} khỏi shop?`)) return;
    try {
      await apiRequest(`/api/shop/admin/shop-items/${row.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa shop item thất bại');
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar
        title="Quản lý Shop & Vật phẩm"
        description="Quản lý cửa hàng và vật phẩm đang bán trong game"
        action={<button className="teal-btn" onClick={openCreate}>+ Thêm vật phẩm mới</button>}
      />

      <StatCardsRow items={stats} />

      <div className="panel readdy-toolbar-card">
        <div className="readdy-toolbar toolbar-shop-visual">
          <div className="readdy-search-input is-wide">
            <span>⌕</span>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm kiếm vật phẩm..." />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Tất cả danh mục</option>
            {itemTypes.map((type) => (
              <option key={type.id} value={String(type.id)}>{type.name}</option>
            ))}
          </select>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="all">Tất cả độ hiếm</option>
            <option value="common">Thường</option>
            <option value="rare">Hiếm</option>
            <option value="epic">Sử thi</option>
            <option value="legendary">Huyền thoại</option>
            <option value="mythic">Thần thoại</option>
          </select>
        </div>
      </div>

      {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
      {loading ? <div className="empty-card"><div className="empty-title">Đang tải dữ liệu shop...</div></div> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState title="Chưa có vật phẩm nào trong shop" description="Tạo shop item đầu tiên để hiển thị ở trang này." action={<button className="teal-btn" onClick={openCreate}>Thêm vật phẩm</button>} />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="readdy-products-grid">
          {rows.map((row) => (
            <div key={row.id} className="readdy-product-card">
              <div className="readdy-product-thumb-wrap">
                <span className={`readdy-chip ${rarityChipClass(row.rarity)} readdy-product-rarity`}>{rarityLabel(row.rarity)}</span>
                {row.icon_url ? (
                  <img className="readdy-product-thumb" src={row.icon_url} alt={row.item_name} />
                ) : (
                  <div className="readdy-product-thumb placeholder">✦</div>
                )}
              </div>

              <div className="readdy-product-body">
                <h3>{row.item_name}</h3>
                <div className="readdy-product-sub">{row.item_type_name}</div>

                <div className="readdy-product-meta-grid">
                  <div>
                    <span>Giá bán</span>
                    <strong>{formatCurrency(row.price_gold || row.price_premium || 0)}</strong>
                  </div>
                  <div>
                    <span>Tồn kho</span>
                    <strong>{row.stock_quantity === null ? '∞' : formatNumber(row.stock_quantity)}</strong>
                  </div>
                </div>

                <div className="readdy-product-footline">
                  <span>Đã bán: {formatNumber(row.soldQuantity)}</span>
                  <span className={`readdy-chip ${Number(row.is_active) === 1 ? 'chip-green' : 'chip-gray'}`}>
                    {Number(row.is_active) === 1 ? 'Đang bán' : 'Đã ẩn'}
                  </span>
                </div>

                <div className="readdy-product-actions">
                  <button className="teal-btn wide" onClick={() => openEdit(row)}>✎ Sửa</button>
                  <button className="icon-danger-btn" onClick={() => handleDelete(row)}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <CrudModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRow ? 'Chỉnh sửa vật phẩm trong shop' : 'Thêm vật phẩm vào shop'}
        footer={
          <>
            <button className="secondary-btn" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="teal-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu...' : 'Lưu shop item'}</button>
          </>
        }
      >
        <div className="form-grid-two">
          <label>
            Vật phẩm
            <select name="item_id" value={form.item_id} onChange={(e) => setForm((prev) => ({ ...prev, item_id: e.target.value }))}>
              <option value="">Chọn vật phẩm</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>Giá vàng<input type="number" value={form.price_gold} onChange={(e) => setForm((prev) => ({ ...prev, price_gold: e.target.value }))} /></label>
          <label>Giá premium<input type="number" value={form.price_premium} onChange={(e) => setForm((prev) => ({ ...prev, price_premium: e.target.value }))} /></label>
          <label>Tồn kho<input type="number" value={form.stock_quantity} onChange={(e) => setForm((prev) => ({ ...prev, stock_quantity: e.target.value }))} /></label>
          <label>Giới hạn mua/ngày<input type="number" value={form.daily_purchase_limit} onChange={(e) => setForm((prev) => ({ ...prev, daily_purchase_limit: e.target.value }))} /></label>
          <label>VIP yêu cầu<input type="number" value={form.vip_required_level} onChange={(e) => setForm((prev) => ({ ...prev, vip_required_level: e.target.value }))} /></label>
          <label>Bắt đầu bán<input type="datetime-local" value={form.start_at} onChange={(e) => setForm((prev) => ({ ...prev, start_at: e.target.value }))} /></label>
          <label>Kết thúc bán<input type="datetime-local" value={form.end_at} onChange={(e) => setForm((prev) => ({ ...prev, end_at: e.target.value }))} /></label>
          <label className="form-checkbox-inline"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} /> Đang kích hoạt</label>
        </div>
      </CrudModal>
    </div>
  );
}
