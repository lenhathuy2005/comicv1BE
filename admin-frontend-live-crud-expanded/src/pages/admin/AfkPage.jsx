import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatDateTime, formatNumber } from '../../utils/adminHelpers';

const emptyConfig = { config_key: '', config_value: '', value_type: 'string', description: '' };

export default function AfkPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [tab, setTab] = useState('Cấu hình AFK');
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState({ overview: {}, configs: [], sessions: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyConfig);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/admin/afk');
      setData({ overview: result?.data?.overview || {}, configs: result?.data?.configs || [], sessions: result?.data?.sessions || [] });
    } catch (error) {
      setErrorText(error.message || 'Không tải được AFK');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadData(); }, []);

  const filteredConfigs = useMemo(() => data.configs.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())), [data.configs, keyword]);
  const filteredSessions = useMemo(() => data.sessions.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())), [data.sessions, keyword]);

  const statCards = [
    { label: 'Tổng cấu hình', value: formatNumber(data.overview.totalConfigs), icon: '⚙', tone: 'mint' },
    { label: 'Phiên đang chạy', value: formatNumber(data.overview.runningSessions), icon: '▶', tone: 'green' },
    { label: 'Tổng giờ AFK hôm nay', value: formatNumber(Math.round(Number(data.overview.totalHoursToday || 0))), icon: '⏰', tone: 'purple' },
    { label: 'User đang AFK', value: formatNumber(data.overview.usersAfk), icon: '👤', tone: 'gold' },
  ];

  const openCreate = () => { setEditingItem(null); setForm(emptyConfig); setModalOpen(true); };
  const openEdit = (item) => { setEditingItem(item); setForm({ config_key: item.config_key, config_value: item.config_value, value_type: item.value_type, description: item.description || '' }); setModalOpen(true); };

  const saveConfig = async () => {
    setSaving(true);
    try {
      if (editingItem) {
        await apiRequest(`/api/admin/afk/configs/${editingItem.id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await apiRequest('/api/admin/afk/configs', { method: 'POST', body: JSON.stringify(form) });
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu cấu hình AFK thất bại');
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (item) => {
    if (!window.confirm(`Xóa cấu hình ${item.config_key}?`)) return;
    try { await apiRequest(`/api/admin/afk/configs/${item.id}`, { method: 'DELETE' }); await loadData(); } catch (error) { alert(error.message || 'Xóa cấu hình AFK thất bại'); }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý AFK" description="Cấu hình và theo dõi hệ thống AFK bằng dữ liệu thật" action={tab === 'Cấu hình AFK' ? <button className="teal-btn" onClick={openCreate}>+ Thêm cấu hình</button> : null} />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-tabs-panel">
        <div className="readdy-tabs is-three">{['Cấu hình AFK', 'Log AFK', 'Thống kê'].map((label) => <button key={label} className={tab === label ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab(label)}>{label}</button>)}</div>
        <div className="readdy-toolbar"><div className="readdy-search-input is-wide"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm..." /></div></div>
        {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
        {loading ? <div className="empty-card"><div className="empty-title">Đang tải AFK...</div></div> : null}
        {!loading && tab === 'Cấu hình AFK' ? (filteredConfigs.length === 0 ? <EmptyState title="Chưa có cấu hình AFK" description="Tạo cấu hình đầu tiên." action={<button className="teal-btn" onClick={openCreate}>Thêm cấu hình</button>} /> : <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Key</th><th>Value</th><th>Type</th><th>Mô tả</th><th>Thao tác</th></tr></thead><tbody>{filteredConfigs.map((item) => <tr key={item.id}><td>{item.config_key}</td><td>{item.config_value}</td><td>{item.value_type}</td><td>{item.description || '-'}</td><td><div className="readdy-actions-inline"><button className="icon-btn teal" onClick={() => openEdit(item)}>✎</button><button className="icon-btn red" onClick={() => deleteConfig(item)}>🗑</button></div></td></tr>)}</tbody></table></div>) : null}
        {!loading && tab === 'Log AFK' ? (filteredSessions.length === 0 ? <EmptyState title="Chưa có log AFK" description="Khi user bắt đầu AFK, log sẽ xuất hiện ở đây." /> : <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Người dùng</th><th>Bắt đầu</th><th>Kết thúc</th><th>Thời lượng</th><th>Tổng EXP</th><th>Claim</th><th>Trạng thái</th></tr></thead><tbody>{filteredSessions.map((item) => <tr key={item.id}><td>{item.user_name}</td><td>{formatDateTime(item.started_at)}</td><td>{formatDateTime(item.ended_at)}</td><td>{formatNumber(item.duration_seconds)}s</td><td>{formatNumber(item.total_exp_earned)}</td><td>{item.claim_status}</td><td>{item.session_status}</td></tr>)}</tbody></table></div>) : null}
        {!loading && tab === 'Thống kê' ? <div className="panel"><h3>Tóm tắt AFK</h3><p>Hệ thống hiện có {formatNumber(data.configs.length)} cấu hình, {formatNumber(data.sessions.length)} log AFK gần đây và {formatNumber(data.overview.usersAfk)} người dùng đang AFK.</p></div> : null}
      </div>
      <CrudModal open={modalOpen} onClose={() => setModalOpen(false)} title={editingItem ? 'Chỉnh sửa cấu hình AFK' : 'Thêm cấu hình AFK'} footer={<><button className="secondary-btn" onClick={() => setModalOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={saveConfig}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</button></>}>
        <div className="form-grid-two"><label>Config key<input value={form.config_key} onChange={(event) => setForm((prev) => ({ ...prev, config_key: event.target.value }))} /></label><label>Value type<select value={form.value_type} onChange={(event) => setForm((prev) => ({ ...prev, value_type: event.target.value }))}><option value="string">string</option><option value="int">int</option><option value="decimal">decimal</option><option value="json">json</option><option value="bool">bool</option></select></label><label className="form-span-2">Config value<input value={form.config_value} onChange={(event) => setForm((prev) => ({ ...prev, config_value: event.target.value }))} /></label><label className="form-span-2">Mô tả<textarea rows="4" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></label></div>
      </CrudModal>
    </div>
  );
}
