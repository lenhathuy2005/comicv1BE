import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatDate, formatNumber, statusChip } from '../../utils/adminHelpers';

const emptyRealm = { name: '', realm_order: 1, description: '', base_power_bonus: 0 };
const emptyLevel = { level_number: 1, exp_required: 0, reward_gold: 0, reward_premium: 0 };

export default function RealmsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [tab, setTab] = useState('Cảnh giới');
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState({ overview: {}, realms: [], levels: [], snapshots: [], ranking: [] });
  const [realmModalOpen, setRealmModalOpen] = useState(false);
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [editingRealm, setEditingRealm] = useState(null);
  const [editingLevel, setEditingLevel] = useState(null);
  const [realmForm, setRealmForm] = useState(emptyRealm);
  const [levelForm, setLevelForm] = useState(emptyLevel);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const [cultivationRes, rankingRes] = await Promise.all([
        apiRequest('/api/admin/cultivation'),
        apiRequest('/api/admin/rankings/level?limit=20'),
      ]);
      setData({
        overview: cultivationRes?.data?.overview || {},
        realms: cultivationRes?.data?.realms || [],
        levels: cultivationRes?.data?.levels || [],
        snapshots: cultivationRes?.data?.snapshots || [],
        ranking: rankingRes?.data || [],
      });
    } catch (error) {
      setErrorText(error.message || 'Không tải được dữ liệu tu luyện');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredRealms = useMemo(() => data.realms.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())), [data.realms, keyword]);
  const filteredLevels = useMemo(() => data.levels.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())), [data.levels, keyword]);

  const statCards = [
    { label: 'Tổng cảnh giới', value: formatNumber(data.overview.totalRealms), icon: '🧿', tone: 'purple' },
    { label: 'Tổng level', value: formatNumber(data.overview.totalLevels), icon: '📈', tone: 'mint' },
    { label: 'Snapshot ranking', value: formatNumber(data.snapshots.length), icon: '🏆', tone: 'gold' },
  ];

  const saveRealm = async () => {
    setSaving(true);
    try {
      if (editingRealm) {
        await apiRequest(`/api/admin/realms/${editingRealm.id}`, { method: 'PUT', body: JSON.stringify(realmForm) });
      } else {
        await apiRequest('/api/admin/realms', { method: 'POST', body: JSON.stringify(realmForm) });
      }
      setRealmModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu cảnh giới thất bại');
    } finally {
      setSaving(false);
    }
  };

  const saveLevel = async () => {
    setSaving(true);
    try {
      if (editingLevel) {
        await apiRequest(`/api/admin/levels/${editingLevel.id}`, { method: 'PUT', body: JSON.stringify(levelForm) });
      } else {
        await apiRequest('/api/admin/levels', { method: 'POST', body: JSON.stringify(levelForm) });
      }
      setLevelModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu level thất bại');
    } finally {
      setSaving(false);
    }
  };

  const deleteRealm = async (item) => {
    if (!window.confirm(`Xóa cảnh giới ${item.name}?`)) return;
    try { await apiRequest(`/api/admin/realms/${item.id}`, { method: 'DELETE' }); await loadData(); } catch (error) { alert(error.message || 'Xóa cảnh giới thất bại'); }
  };
  const deleteLevel = async (item) => {
    if (!window.confirm(`Xóa level ${item.level_number}?`)) return;
    try { await apiRequest(`/api/admin/levels/${item.id}`, { method: 'DELETE' }); await loadData(); } catch (error) { alert(error.message || 'Xóa level thất bại'); }
  };
  const createSnapshot = async () => {
    try { await apiRequest('/api/admin/rankings/level/snapshot', { method: 'POST', body: JSON.stringify({ limit: 100 }) }); await loadData(); } catch (error) { alert(error.message || 'Tạo snapshot thất bại'); }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý Tu luyện" description="Cấu hình cảnh giới, level và bảng xếp hạng level bằng dữ liệu thật" action={tab === 'Cảnh giới' ? <button className="teal-btn" onClick={() => { setEditingRealm(null); setRealmForm(emptyRealm); setRealmModalOpen(true); }}>+ Thêm cảnh giới</button> : tab === 'Level' ? <button className="teal-btn" onClick={() => { setEditingLevel(null); setLevelForm(emptyLevel); setLevelModalOpen(true); }}>+ Thêm level</button> : <button className="teal-btn" onClick={createSnapshot}>+ Tạo snapshot level</button>} />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-tabs-panel">
        <div className="readdy-tabs is-three">
          {['Cảnh giới', 'Level', 'Bảng xếp hạng'].map((label) => <button key={label} className={tab === label ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab(label)}>{label}</button>)}
        </div>
        <div className="readdy-toolbar"><div className="readdy-search-input is-wide"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={`Tìm kiếm ${tab.toLowerCase()}...`} /></div></div>
        {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
        {loading ? <div className="empty-card"><div className="empty-title">Đang tải dữ liệu tu luyện...</div></div> : null}
        {!loading && tab === 'Cảnh giới' ? (filteredRealms.length === 0 ? <EmptyState title="Chưa có cảnh giới" description="Thêm cảnh giới mới để cấu hình hệ thống." /> : <div className="readdy-realm-grid">{filteredRealms.map((item) => <div key={item.id} className="readdy-realm-card tone-purple"><div className="readdy-realm-top"><div className="readdy-square tone-purple">✦</div><div><h3>{item.name}</h3><span>Thứ tự {item.realm_order}</span></div><div className="readdy-actions-inline"><button className="icon-btn teal" onClick={() => { setEditingRealm(item); setRealmForm({ name: item.name, realm_order: item.realm_order, description: item.description || '', base_power_bonus: item.base_power_bonus || 0 }); setRealmModalOpen(true); }}>✎</button><button className="icon-btn red" onClick={() => deleteRealm(item)}>🗑</button></div></div><p>{item.description || 'Chưa có mô tả'}</p><div className="readdy-realm-line"><span>Power bonus:</span><strong>{formatNumber(item.base_power_bonus)}</strong></div><div className="readdy-realm-note"><span>Ngày tạo:</span><strong>{formatDate(item.created_at)}</strong></div></div>)}</div>) : null}
        {!loading && tab === 'Level' ? (filteredLevels.length === 0 ? <EmptyState title="Chưa có level" description="Thêm level đầu tiên." /> : <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Level</th><th>EXP cần</th><th>Thưởng vàng</th><th>Thưởng premium</th><th>Thao tác</th></tr></thead><tbody>{filteredLevels.map((item) => <tr key={item.id}><td>Lv. {item.level_number}</td><td>{formatNumber(item.exp_required)}</td><td>{formatNumber(item.reward_gold)}</td><td>{formatNumber(item.reward_premium)}</td><td><div className="readdy-actions-inline"><button className="icon-btn teal" onClick={() => { setEditingLevel(item); setLevelForm({ level_number: item.level_number, exp_required: item.exp_required, reward_gold: item.reward_gold, reward_premium: item.reward_premium }); setLevelModalOpen(true); }}>✎</button><button className="icon-btn red" onClick={() => deleteLevel(item)}>🗑</button></div></td></tr>)}</tbody></table></div>) : null}
        {!loading && tab === 'Bảng xếp hạng' ? (<><div className="table-wrap"><table className="readdy-table"><thead><tr><th>Hạng</th><th>Người chơi</th><th>Level</th><th>Realm</th><th>EXP hiện tại</th></tr></thead><tbody>{data.ranking.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())).map((item) => <tr key={item.entity_id}><td>#{item.rank_position}</td><td>{item.name}</td><td>{item.score_value}</td><td>{item.realm_name || '-'}</td><td>{formatNumber(item.current_exp)}</td></tr>)}</tbody></table></div><div className="panel" style={{ marginTop: 16 }}><h3>Snapshot gần đây</h3><div className="table-wrap"><table className="readdy-table"><thead><tr><th>Ngày snapshot</th><th>Loại</th><th>Số dòng</th></tr></thead><tbody>{data.snapshots.map((item, index) => <tr key={`${item.snapshot_date}-${item.ranking_type}-${index}`}><td>{item.snapshot_date}</td><td><span className={`readdy-chip ${statusChip(item.ranking_type)}`}>{item.ranking_type}</span></td><td>{formatNumber(item.total_rows)}</td></tr>)}</tbody></table></div></div></>) : null}
      </div>
      <CrudModal open={realmModalOpen} onClose={() => setRealmModalOpen(false)} title={editingRealm ? 'Chỉnh sửa cảnh giới' : 'Thêm cảnh giới'} footer={<><button className="secondary-btn" onClick={() => setRealmModalOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={saveRealm}>{saving ? 'Đang lưu...' : 'Lưu cảnh giới'}</button></>}><div className="form-grid-two"><label>Tên cảnh giới<input value={realmForm.name} onChange={(event) => setRealmForm((prev) => ({ ...prev, name: event.target.value }))} /></label><label>Thứ tự<input type="number" value={realmForm.realm_order} onChange={(event) => setRealmForm((prev) => ({ ...prev, realm_order: event.target.value }))} /></label><label>Power bonus<input type="number" value={realmForm.base_power_bonus} onChange={(event) => setRealmForm((prev) => ({ ...prev, base_power_bonus: event.target.value }))} /></label><label className="form-span-2">Mô tả<textarea rows="4" value={realmForm.description} onChange={(event) => setRealmForm((prev) => ({ ...prev, description: event.target.value }))} /></label></div></CrudModal>
      <CrudModal open={levelModalOpen} onClose={() => setLevelModalOpen(false)} title={editingLevel ? 'Chỉnh sửa level' : 'Thêm level'} footer={<><button className="secondary-btn" onClick={() => setLevelModalOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={saveLevel}>{saving ? 'Đang lưu...' : 'Lưu level'}</button></>}><div className="form-grid-two"><label>Level number<input type="number" value={levelForm.level_number} onChange={(event) => setLevelForm((prev) => ({ ...prev, level_number: event.target.value }))} /></label><label>EXP required<input type="number" value={levelForm.exp_required} onChange={(event) => setLevelForm((prev) => ({ ...prev, exp_required: event.target.value }))} /></label><label>Reward gold<input type="number" value={levelForm.reward_gold} onChange={(event) => setLevelForm((prev) => ({ ...prev, reward_gold: event.target.value }))} /></label><label>Reward premium<input type="number" value={levelForm.reward_premium} onChange={(event) => setLevelForm((prev) => ({ ...prev, reward_premium: event.target.value }))} /></label></div></CrudModal>
    </div>
  );
}
