import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatDate, formatNumber, slugify, toArray } from '../../utils/adminHelpers';

const blankForm = { name: '', slug: '', description: '' };

export default function CategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, totalComics: 0, averageComics: 0 });
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(blankForm);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/admin/genres');
      setItems(toArray(result?.data));
      setStats(result?.data?.stats || { total: 0, totalComics: 0, averageComics: 0 });
    } catch (error) {
      setErrorText(error.message || 'Không tải được thể loại');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const q = keyword.trim().toLowerCase();
    return !q || JSON.stringify(item).toLowerCase().includes(q);
  }), [items, keyword]);

  const statCards = [
    { label: 'Tổng thể loại', value: formatNumber(stats.total), icon: '🏷', tone: 'mint' },
    { label: 'Tổng truyện', value: formatNumber(stats.totalComics), icon: '📚', tone: 'green' },
    { label: 'TB truyện/thể loại', value: formatNumber(stats.averageComics), icon: '≈', tone: 'purple' },
  ];

  const openCreate = () => { setEditingItem(null); setForm(blankForm); setOpen(true); };
  const openEdit = (item) => { setEditingItem(item); setForm({ name: item.name || '', slug: item.slug || '', description: item.description || '' }); setOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, slug: slugify(form.slug || form.name) };
      if (editingItem) {
        await apiRequest(`/api/admin/genres/${editingItem.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/admin/genres', { method: 'POST', body: JSON.stringify(payload) });
      }
      setOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu thể loại thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa thể loại ${item.name}?`)) return;
    try {
      await apiRequest(`/api/admin/genres/${item.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa thể loại thất bại');
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý Thể loại" description="Quản lý các thể loại truyện bằng dữ liệu thật từ database" action={<button className="teal-btn" onClick={openCreate}>+ Thêm thể loại</button>} />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-toolbar-card">
        <div className="readdy-toolbar">
          <div className="readdy-search-input is-wide"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm thể loại..." /></div>
        </div>
      </div>
      {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
      {loading ? <div className="empty-card"><div className="empty-title">Đang tải thể loại...</div></div> : null}
      {!loading && filtered.length === 0 ? <EmptyState title="Chưa có thể loại" description="Tạo thể loại đầu tiên để gắn cho truyện." action={<button className="teal-btn" onClick={openCreate}>Tạo thể loại</button>} /> : null}
      {!loading && filtered.length > 0 ? (
        <div className="readdy-card-grid">
          {filtered.map((item) => (
            <div key={item.id} className="readdy-feature-card">
              <div className="readdy-feature-top">
                <div className="readdy-square tone-teal">🏷</div>
                <div className="readdy-feature-copy">
                  <h3>{item.name}</h3>
                  <span>/{item.slug}</span>
                </div>
                <span className="readdy-chip chip-green">Hoạt động</span>
              </div>
              <p className="readdy-feature-text">{item.description || 'Chưa có mô tả'}</p>
              <div className="readdy-feature-meta">
                <span>▤ {formatNumber(item.comics_count)} truyện</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
              <div className="readdy-feature-actions">
                <button className="soft-btn" onClick={() => openEdit(item)}>✎ Chỉnh sửa</button>
                <button className="icon-danger-btn" onClick={() => handleDelete(item)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <CrudModal open={open} onClose={() => setOpen(false)} title={editingItem ? 'Chỉnh sửa thể loại' : 'Thêm thể loại mới'} footer={<><button className="secondary-btn" onClick={() => setOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu...' : 'Lưu thể loại'}</button></>}>
        <div className="form-grid-two">
          <label>Tên thể loại<input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value, slug: prev.slug || slugify(event.target.value) }))} /></label>
          <label>Slug<input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))} /></label>
          <label className="form-span-2">Mô tả<textarea rows="4" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
        </div>
      </CrudModal>
    </div>
  );
}
