import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatNumber } from '../../utils/adminHelpers';

const emptyLevel = { level_number: 0, name: '', required_topup_amount: 0, badge_name: '', badge_color: '', description: '' };
const emptyBenefit = { vip_level_id: '', benefit_code: '', benefit_name: '', benefit_value: '', description: '' };

export default function VipPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [tab, setTab] = useState('Cấp VIP');
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState({ overview: {}, levels: [], benefits: [], users: [] });
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [benefitModalOpen, setBenefitModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [editingBenefit, setEditingBenefit] = useState(null);
  const [levelForm, setLevelForm] = useState(emptyLevel);
  const [benefitForm, setBenefitForm] = useState(emptyBenefit);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/admin/vip');
      setData({ overview: result?.data?.overview || {}, levels: result?.data?.levels || [], benefits: result?.data?.benefits || [], users: result?.data?.users || [] });
    } catch (error) {
      setErrorText(error.message || 'Không tải được dữ liệu VIP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredLevels = useMemo(() => data.levels.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())), [data.levels, keyword]);
  const filteredBenefits = useMemo(() => data.benefits.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())), [data.benefits, keyword]);
  const filteredUsers = useMemo(() => data.users.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())), [data.users, keyword]);

  const statCards = [
    { label: 'Tổng cấp VIP', value: formatNumber(data.overview.totalLevels), icon: '👑', tone: 'gold' },
    { label: 'Tổng quyền lợi', value: formatNumber(data.overview.totalBenefits), icon: '🎁', tone: 'mint' },
    { label: 'Người dùng VIP', value: formatNumber(data.overview.vipUsers), icon: '👥', tone: 'purple' },
    { label: 'Tổng topup', value: formatNumber(data.overview.totalTopup), icon: '💰', tone: 'green' },
  ];

  const saveLevel = async () => {
    setSaving(true);
    try {
      if (editingLevel) {
        await apiRequest(`/api/admin/vip/levels/${editingLevel.id}`, { method: 'PUT', body: JSON.stringify(levelForm) });
      } else {
        await apiRequest('/api/admin/vip/levels', { method: 'POST', body: JSON.stringify(levelForm) });
      }
      setLevelModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu VIP level thất bại');
    } finally {
      setSaving(false);
    }
  };

  const saveBenefit = async () => {
    setSaving(true);
    try {
      if (editingBenefit) {
        await apiRequest(`/api/admin/vip/benefits/${editingBenefit.id}`, { method: 'PUT', body: JSON.stringify(benefitForm) });
      } else {
        await apiRequest('/api/admin/vip/benefits', { method: 'POST', body: JSON.stringify(benefitForm) });
      }
      setBenefitModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu quyền lợi VIP thất bại');
    } finally {
      setSaving(false);
    }
  };

  const deleteLevel = async (item) => {
    if (!window.confirm(`Xóa VIP level ${item.name}?`)) return;
    try { await apiRequest(`/api/admin/vip/levels/${item.id}`, { method: 'DELETE' }); await loadData(); } catch (error) { alert(error.message || 'Xóa VIP level thất bại'); }
  };
  const deleteBenefit = async (item) => {
    if (!window.confirm(`Xóa quyền lợi ${item.benefit_name}?`)) return;
    try { await apiRequest(`/api/admin/vip/benefits/${item.id}`, { method: 'DELETE' }); await loadData(); } catch (error) { alert(error.message || 'Xóa quyền lợi VIP thất bại'); }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý VIP" description="Quản lý cấp VIP, quyền lợi và người dùng VIP bằng dữ liệu thật" action={tab === 'Cấp VIP' ? <button className="teal-btn" onClick={() => { setEditingLevel(null); setLevelForm(emptyLevel); setLevelModalOpen(true); }}>+ Thêm cấp VIP</button> : tab === 'Quyền lợi' ? <button className="teal-btn" onClick={() => { setEditingBenefit(null); setBenefitForm(emptyBenefit); setBenefitModalOpen(true); }}>+ Thêm quyền lợi</button> : null} />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-tabs-panel">
        <div className="readdy-tabs is-three">{['Cấp VIP', 'Quyền lợi', 'Người dùng VIP'].map((label) => <button key={label} className={tab === label ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab(label)}>{label}</button>)}</div>
        <div className="readdy-toolbar"><div className="readdy-search-input is-wide"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm..." /></div></div>
        {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
        {loading ? <div className="empty-card"><div className="empty-title">Đang tải dữ liệu VIP...</div></div> : null}
        {!loading && tab === 'Cấp VIP' ? (filteredLevels.length === 0 ? <EmptyState title="Chưa có cấp VIP" description="Tạo cấp VIP đầu tiên." /> : <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Level</th><th>Tên</th><th>Topup yêu cầu</th><th>Badge</th><th>Thao tác</th></tr></thead><tbody>{filteredLevels.map((item) => <tr key={item.id}><td>{item.level_number}</td><td>{item.name}</td><td>{formatNumber(item.required_topup_amount)}</td><td>{item.badge_name || '-'} {item.badge_color ? `(${item.badge_color})` : ''}</td><td><div className="readdy-actions-inline"><button className="icon-btn teal" onClick={() => { setEditingLevel(item); setLevelForm({ level_number: item.level_number, name: item.name, required_topup_amount: item.required_topup_amount, badge_name: item.badge_name || '', badge_color: item.badge_color || '', description: item.description || '' }); setLevelModalOpen(true); }}>✎</button><button className="icon-btn red" onClick={() => deleteLevel(item)}>🗑</button></div></td></tr>)}</tbody></table></div>) : null}
        {!loading && tab === 'Quyền lợi' ? (filteredBenefits.length === 0 ? <EmptyState title="Chưa có quyền lợi VIP" description="Tạo quyền lợi đầu tiên." /> : <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Cấp VIP</th><th>Mã</th><th>Tên quyền lợi</th><th>Giá trị</th><th>Thao tác</th></tr></thead><tbody>{filteredBenefits.map((item) => <tr key={item.id}><td>{item.vip_level_name}</td><td>{item.benefit_code}</td><td>{item.benefit_name}</td><td>{item.benefit_value || '-'}</td><td><div className="readdy-actions-inline"><button className="icon-btn teal" onClick={() => { setEditingBenefit(item); setBenefitForm({ vip_level_id: item.vip_level_id, benefit_code: item.benefit_code, benefit_name: item.benefit_name, benefit_value: item.benefit_value || '', description: item.description || '' }); setBenefitModalOpen(true); }}>✎</button><button className="icon-btn red" onClick={() => deleteBenefit(item)}>🗑</button></div></td></tr>)}</tbody></table></div>) : null}
        {!loading && tab === 'Người dùng VIP' ? (filteredUsers.length === 0 ? <EmptyState title="Chưa có người dùng VIP" description="Khi có giao dịch topup hoặc gán VIP, người dùng sẽ hiện tại đây." /> : <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Người dùng</th><th>Cấp VIP</th><th>VIP EXP</th><th>Tổng topup</th></tr></thead><tbody>{filteredUsers.map((item) => <tr key={item.user_id}><td>{item.display_name} (@{item.username})</td><td>{item.vip_level_name || '-'}</td><td>{formatNumber(item.vip_exp)}</td><td>{formatNumber(item.total_topup_amount)}</td></tr>)}</tbody></table></div>) : null}
      </div>
      <CrudModal open={levelModalOpen} onClose={() => setLevelModalOpen(false)} title={editingLevel ? 'Chỉnh sửa cấp VIP' : 'Thêm cấp VIP'} footer={<><button className="secondary-btn" onClick={() => setLevelModalOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={saveLevel}>{saving ? 'Đang lưu...' : 'Lưu cấp VIP'}</button></>}><div className="form-grid-two"><label>Level number<input type="number" value={levelForm.level_number} onChange={(event) => setLevelForm((prev) => ({ ...prev, level_number: event.target.value }))} /></label><label>Tên VIP<input value={levelForm.name} onChange={(event) => setLevelForm((prev) => ({ ...prev, name: event.target.value }))} /></label><label>Topup yêu cầu<input type="number" value={levelForm.required_topup_amount} onChange={(event) => setLevelForm((prev) => ({ ...prev, required_topup_amount: event.target.value }))} /></label><label>Badge name<input value={levelForm.badge_name} onChange={(event) => setLevelForm((prev) => ({ ...prev, badge_name: event.target.value }))} /></label><label>Badge color<input value={levelForm.badge_color} onChange={(event) => setLevelForm((prev) => ({ ...prev, badge_color: event.target.value }))} /></label><label className="form-span-2">Mô tả<textarea rows="4" value={levelForm.description} onChange={(event) => setLevelForm((prev) => ({ ...prev, description: event.target.value }))} /></label></div></CrudModal>
      <CrudModal open={benefitModalOpen} onClose={() => setBenefitModalOpen(false)} title={editingBenefit ? 'Chỉnh sửa quyền lợi VIP' : 'Thêm quyền lợi VIP'} footer={<><button className="secondary-btn" onClick={() => setBenefitModalOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={saveBenefit}>{saving ? 'Đang lưu...' : 'Lưu quyền lợi'}</button></>}><div className="form-grid-two"><label>Cấp VIP<select value={benefitForm.vip_level_id} onChange={(event) => setBenefitForm((prev) => ({ ...prev, vip_level_id: event.target.value }))}><option value="">Chọn VIP level</option>{data.levels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Mã quyền lợi<input value={benefitForm.benefit_code} onChange={(event) => setBenefitForm((prev) => ({ ...prev, benefit_code: event.target.value }))} /></label><label>Tên quyền lợi<input value={benefitForm.benefit_name} onChange={(event) => setBenefitForm((prev) => ({ ...prev, benefit_name: event.target.value }))} /></label><label>Giá trị<input value={benefitForm.benefit_value} onChange={(event) => setBenefitForm((prev) => ({ ...prev, benefit_value: event.target.value }))} /></label><label className="form-span-2">Mô tả<textarea rows="4" value={benefitForm.description} onChange={(event) => setBenefitForm((prev) => ({ ...prev, description: event.target.value }))} /></label></div></CrudModal>
    </div>
  );
}
