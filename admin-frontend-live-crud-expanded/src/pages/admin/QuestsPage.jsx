import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatNumber, fromDatetimeLocal, toDatetimeLocal } from '../../utils/adminHelpers';

const emptyForm = {
  code: '',
  title: '',
  description: '',
  mission_type: 'daily',
  target_type: 'read_chapter',
  target_value: 1,
  reward_gold: 0,
  reward_exp: 0,
  reward_item_id: '',
  reward_item_qty: 0,
  is_active: true,
  start_at: '',
  end_at: '',
};

export default function QuestsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [tab, setTab] = useState('daily');
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState({ stats: {}, items: [], itemOptions: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/admin/missions');
      setData({ stats: result?.data?.stats || {}, items: result?.data?.items || [], itemOptions: result?.data?.itemOptions || [] });
    } catch (error) {
      setErrorText(error.message || 'Không tải được nhiệm vụ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => data.items.filter((item) => {
    const q = keyword.trim().toLowerCase();
    const okKeyword = !q || JSON.stringify(item).toLowerCase().includes(q);
    const okTab = item.mission_type === tab;
    const okStatus = status === 'all' || (status === 'active' ? Number(item.is_active) === 1 : Number(item.is_active) !== 1);
    return okKeyword && okTab && okStatus;
  }), [data.items, keyword, tab, status]);

  const statCards = [
    { label: 'Tổng nhiệm vụ', value: formatNumber(data.stats.total), icon: '☑', tone: 'blue' },
    { label: 'Đang hoạt động', value: formatNumber(data.stats.active), icon: '✅', tone: 'green' },
    { label: 'Tạm dừng', value: formatNumber(data.stats.paused), icon: '⏸', tone: 'gray' },
    { label: 'Sự kiện', value: formatNumber(data.stats.events), icon: '🎉', tone: 'gold' },
  ];

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...emptyForm, mission_type: tab });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      code: item.code || '',
      title: item.title || '',
      description: item.description || '',
      mission_type: item.mission_type || 'daily',
      target_type: item.target_type || 'read_chapter',
      target_value: item.target_value || 1,
      reward_gold: item.reward_gold || 0,
      reward_exp: item.reward_exp || 0,
      reward_item_id: item.reward_item_id || '',
      reward_item_qty: item.reward_item_qty || 0,
      is_active: Number(item.is_active) === 1,
      start_at: toDatetimeLocal(item.start_at),
      end_at: toDatetimeLocal(item.end_at),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        reward_item_id: form.reward_item_id ? Number(form.reward_item_id) : null,
        start_at: fromDatetimeLocal(form.start_at),
        end_at: fromDatetimeLocal(form.end_at),
      };
      if (editingItem) {
        await apiRequest(`/api/admin/missions/${editingItem.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/admin/missions', { method: 'POST', body: JSON.stringify(payload) });
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu nhiệm vụ thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa nhiệm vụ ${item.title}?`)) return;
    try { await apiRequest(`/api/admin/missions/${item.id}`, { method: 'DELETE' }); await loadData(); } catch (error) { alert(error.message || 'Xóa nhiệm vụ thất bại'); }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý Nhiệm vụ" description="Cấu hình nhiệm vụ bằng dữ liệu thật từ API" action={<button className="teal-btn" onClick={openCreate}>+ Thêm nhiệm vụ</button>} />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-tabs-panel">
        <div className="readdy-tabs is-three">
          {[['daily', 'Nhiệm vụ hàng ngày'], ['weekly', 'Nhiệm vụ hàng tuần'], ['event', 'Sự kiện đặc biệt'], ['story', 'Nhiệm vụ cốt truyện']].map(([value, label]) => <button key={value} className={tab === value ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab(value)}>{label} <span className="tab-counter">{data.items.filter((item) => item.mission_type === value).length}</span></button>)}
        </div>
        <div className="readdy-toolbar toolbar-quests">
          <div className="readdy-search-input is-wide"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm nhiệm vụ..." /></div>
          <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="inactive">Tạm dừng</option></select>
        </div>
        {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
        {loading ? <div className="empty-card"><div className="empty-title">Đang tải nhiệm vụ...</div></div> : null}
        {!loading && filtered.length === 0 ? <EmptyState title="Không có nhiệm vụ phù hợp" description="Đổi bộ lọc hoặc tạo nhiệm vụ mới." action={<button className="teal-btn" onClick={openCreate}>Tạo nhiệm vụ</button>} /> : null}
        {!loading && filtered.length > 0 ? <div className="readdy-quest-grid">{filtered.map((item) => <div key={item.id} className="readdy-quest-card tone-mint"><div className="readdy-quest-top"><div className="readdy-square tone-mint">☑</div><div className="readdy-quest-copy"><h3>{item.title}</h3><div className="readdy-inline-meta"><span className={`readdy-chip ${Number(item.is_active) === 1 ? 'chip-green' : 'chip-gray'}`}>{Number(item.is_active) === 1 ? 'Hoạt động' : 'Tạm dừng'}</span><span className="readdy-chip chip-purple">{item.target_type}</span></div></div><div className="readdy-actions-inline"><button className="icon-btn teal" onClick={() => openEdit(item)}>✎</button><button className="icon-btn red" onClick={() => handleDelete(item)}>🗑</button></div></div><p>{item.description || 'Chưa có mô tả'}</p><div className="readdy-realm-line"><span>Mục tiêu:</span><strong>{formatNumber(item.target_value)}</strong></div><div className="readdy-quest-reward">Phần thưởng: <strong>{formatNumber(item.reward_exp)} EXP + {formatNumber(item.reward_gold)} Gold {item.reward_item_name ? `+ ${item.reward_item_qty} ${item.reward_item_name}` : ''}</strong></div></div>)}</div> : null}
      </div>
      <CrudModal open={modalOpen} onClose={() => setModalOpen(false)} title={editingItem ? 'Chỉnh sửa nhiệm vụ' : 'Thêm nhiệm vụ'} footer={<><button className="secondary-btn" onClick={() => setModalOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu...' : 'Lưu nhiệm vụ'}</button></>}>
        <div className="form-grid-two">
          <label>Mã nhiệm vụ<input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></label>
          <label>Tên nhiệm vụ<input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} /></label>
          <label>Loại<select value={form.mission_type} onChange={(event) => setForm((prev) => ({ ...prev, mission_type: event.target.value }))}><option value="daily">daily</option><option value="weekly">weekly</option><option value="event">event</option><option value="story">story</option></select></label>
          <label>Target type<select value={form.target_type} onChange={(event) => setForm((prev) => ({ ...prev, target_type: event.target.value }))}><option value="read_chapter">read_chapter</option><option value="login">login</option><option value="comment">comment</option><option value="afk">afk</option><option value="buy_item">buy_item</option><option value="join_guild">join_guild</option><option value="chat">chat</option><option value="custom">custom</option></select></label>
          <label>Target value<input type="number" value={form.target_value} onChange={(event) => setForm((prev) => ({ ...prev, target_value: event.target.value }))} /></label>
          <label>Trạng thái<select value={String(form.is_active)} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.value === 'true' }))}><option value="true">Hoạt động</option><option value="false">Tạm dừng</option></select></label>
          <label>Reward gold<input type="number" value={form.reward_gold} onChange={(event) => setForm((prev) => ({ ...prev, reward_gold: event.target.value }))} /></label>
          <label>Reward exp<input type="number" value={form.reward_exp} onChange={(event) => setForm((prev) => ({ ...prev, reward_exp: event.target.value }))} /></label>
          <label>Reward item<select value={form.reward_item_id} onChange={(event) => setForm((prev) => ({ ...prev, reward_item_id: event.target.value }))}><option value="">Không có</option>{data.itemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Reward item qty<input type="number" value={form.reward_item_qty} onChange={(event) => setForm((prev) => ({ ...prev, reward_item_qty: event.target.value }))} /></label>
          <label>Start at<input type="datetime-local" value={form.start_at} onChange={(event) => setForm((prev) => ({ ...prev, start_at: event.target.value }))} /></label>
          <label>End at<input type="datetime-local" value={form.end_at} onChange={(event) => setForm((prev) => ({ ...prev, end_at: event.target.value }))} /></label>
          <label className="form-span-2">Mô tả<textarea rows="4" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
        </div>
      </CrudModal>
    </div>
  );
}
