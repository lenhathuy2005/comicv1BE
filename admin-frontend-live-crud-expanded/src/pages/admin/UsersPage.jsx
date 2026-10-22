import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatNumber, statusChip } from '../../utils/adminHelpers';

const emptyForm = {
  username: '',
  email: '',
  password: '',
  display_name: '',
  avatar_url: '',
  account_status: 'active',
  role_id: '',
  is_email_verified: true,
  full_name: '',
  phone_number: '',
  country: '',
  bio: '',
  gold_balance: 0,
  premium_currency: 0,
  power_score: 0,
  current_level_id: '',
  current_realm_id: '',
  current_exp: 0,
  total_exp_earned: 0,
  combat_power: 0,
  current_vip_level_id: '',
  total_topup_amount: 0,
  vip_exp: 0,
};

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vipFilter, setVipFilter] = useState('all');
  const [data, setData] = useState({ stats: {}, items: [], roles: [], levels: [], realms: [], vipLevels: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/admin/users');
      setData({
        stats: result?.data?.stats || {},
        items: result?.data?.items || [],
        roles: result?.data?.roles || [],
        levels: result?.data?.levels || [],
        realms: result?.data?.realms || [],
        vipLevels: result?.data?.vipLevels || [],
      });
    } catch (error) {
      setErrorText(error.message || 'Không tải được người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => data.items.filter((item) => {
    const q = keyword.trim().toLowerCase();
    const okKeyword = !q || JSON.stringify(item).toLowerCase().includes(q);
    const okStatus = statusFilter === 'all' || item.account_status === statusFilter;
    const okVip = vipFilter === 'all' || (vipFilter === 'vip' ? Number(item.vip_level_number || 0) > 0 : Number(item.vip_level_number || 0) === 0);
    return okKeyword && okStatus && okVip;
  }), [data.items, keyword, statusFilter, vipFilter]);

  const statCards = [
    { label: 'Tổng người dùng', value: formatNumber(data.stats.total), icon: '👤', tone: 'blue' },
    { label: 'Hoạt động', value: formatNumber(data.stats.active), icon: '✅', tone: 'green' },
    { label: 'VIP', value: formatNumber(data.stats.vip), icon: '👑', tone: 'gold' },
    { label: 'Bị khóa', value: formatNumber(data.stats.blocked), icon: '⛔', tone: 'red' },
  ];

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = async (item) => {
    try {
      const result = await apiRequest(`/api/admin/users/${item.id}`);
      const detail = result?.data;
      setEditingId(item.id);
      setForm({
        username: detail.username || '',
        email: detail.email || '',
        password: '',
        display_name: detail.display_name || '',
        avatar_url: detail.avatar_url || '',
        account_status: detail.account_status || 'active',
        role_id: detail.role_id || '',
        is_email_verified: Boolean(detail.is_email_verified),
        full_name: detail.full_name || '',
        phone_number: detail.phone_number || '',
        country: detail.country || '',
        bio: detail.bio || '',
        gold_balance: detail.gold_balance || 0,
        premium_currency: detail.premium_currency || 0,
        power_score: detail.power_score || 0,
        current_level_id: detail.current_level_id || '',
        current_realm_id: detail.current_realm_id || '',
        current_exp: detail.current_exp || 0,
        total_exp_earned: detail.total_exp_earned || 0,
        combat_power: detail.combat_power || 0,
        current_vip_level_id: detail.current_vip_level_id || '',
        total_topup_amount: detail.total_topup_amount || 0,
        vip_exp: detail.vip_exp || 0,
      });
      setModalOpen(true);
    } catch (error) {
      alert(error.message || 'Không tải được chi tiết user');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        role_id: form.role_id ? Number(form.role_id) : null,
        current_level_id: form.current_level_id ? Number(form.current_level_id) : null,
        current_realm_id: form.current_realm_id ? Number(form.current_realm_id) : null,
        current_vip_level_id: form.current_vip_level_id ? Number(form.current_vip_level_id) : null,
      };
      if (!editingId && !payload.password) throw new Error('Mật khẩu là bắt buộc khi tạo user');
      if (editingId) {
        if (!payload.password) delete payload.password;
        await apiRequest(`/api/admin/users/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu user thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa người dùng ${item.display_name}?`)) return;
    try {
      await apiRequest(`/api/admin/users/${item.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa user thất bại');
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý Người dùng" description="Quản lý tài khoản người dùng bằng dữ liệu thật" action={<button className="teal-btn" onClick={openCreate}>+ Thêm người dùng</button>} />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-toolbar-card">
        <div className="readdy-toolbar toolbar-users">
          <div className="readdy-search-input is-wide"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm theo tên, email, username..." /></div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="suspended">suspended</option>
            <option value="banned">banned</option>
          </select>
          <select value={vipFilter} onChange={(event) => setVipFilter(event.target.value)}>
            <option value="all">Tất cả VIP</option>
            <option value="vip">Có VIP</option>
            <option value="normal">Thường</option>
          </select>
        </div>
      </div>
      {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
      {loading ? <div className="empty-card"><div className="empty-title">Đang tải người dùng...</div></div> : null}
      {!loading && filtered.length === 0 ? <EmptyState title="Không có người dùng phù hợp" description="Đổi bộ lọc hoặc thêm người dùng mới." action={<button className="teal-btn" onClick={openCreate}>Thêm người dùng</button>} /> : null}
      {!loading && filtered.length > 0 ? (
        <div className="panel readdy-table-panel">
          <div className="table-wrap">
            <table className="readdy-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Email</th>
                  <th>Cấp độ</th>
                  <th>Cảnh giới</th>
                  <th>VIP</th>
                  <th>Bang phái</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="readdy-user-row">
                        <div className="avatar-orb avatar-blue">{(item.display_name || 'U').slice(0, 1)}</div>
                        <div className="readdy-user-copy">
                          <strong>{item.display_name}</strong>
                          <span>@{item.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.email}</td>
                    <td><span className="readdy-chip chip-mint">Lv. {item.level_number || 0}</span></td>
                    <td>{item.realm_name || '-'}</td>
                    <td><span className={`readdy-chip ${Number(item.vip_level_number || 0) > 0 ? 'chip-gold' : 'chip-gray'}`}>{item.vip_level_name || 'Thường'}</span></td>
                    <td>{item.guild_name || '-'}</td>
                    <td><span className={`readdy-chip ${statusChip(item.account_status)}`}>{item.account_status}</span></td>
                    <td>
                      <div className="readdy-actions-inline">
                        <button className="icon-btn teal" onClick={() => openEdit(item)}>✎</button>
                        <button className="icon-btn red" onClick={() => handleDelete(item)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <CrudModal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Chỉnh sửa người dùng' : 'Thêm người dùng'} size="large" footer={<><button className="secondary-btn" onClick={() => setModalOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu...' : 'Lưu người dùng'}</button></>}>
        <div className="form-grid-two">
          <label>Tên hiển thị<input value={form.display_name} onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))} /></label>
          <label>Username<input value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} /></label>
          <label>Email<input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} /></label>
          <label>Mật khẩu<input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} placeholder={editingId ? 'Để trống nếu không đổi' : 'Bắt buộc'} /></label>
          <label>Role<select value={form.role_id} onChange={(event) => setForm((prev) => ({ ...prev, role_id: event.target.value }))}><option value="">Chọn role</option>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name || role.code}</option>)}</select></label>
          <label>Trạng thái<select value={form.account_status} onChange={(event) => setForm((prev) => ({ ...prev, account_status: event.target.value }))}><option value="active">active</option><option value="pending">pending</option><option value="suspended">suspended</option><option value="banned">banned</option></select></label>
          <label>Level<select value={form.current_level_id} onChange={(event) => setForm((prev) => ({ ...prev, current_level_id: event.target.value }))}><option value="">Chọn level</option>{data.levels.map((item) => <option key={item.id} value={item.id}>Lv. {item.level_number}</option>)}</select></label>
          <label>Cảnh giới<select value={form.current_realm_id} onChange={(event) => setForm((prev) => ({ ...prev, current_realm_id: event.target.value }))}><option value="">Chọn cảnh giới</option>{data.realms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>VIP<select value={form.current_vip_level_id} onChange={(event) => setForm((prev) => ({ ...prev, current_vip_level_id: event.target.value }))}><option value="">Chọn VIP</option>{data.vipLevels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Xác minh email<select value={String(form.is_email_verified)} onChange={(event) => setForm((prev) => ({ ...prev, is_email_verified: event.target.value === 'true' }))}><option value="true">Đã xác minh</option><option value="false">Chưa xác minh</option></select></label>
          <label>Vàng<input type="number" value={form.gold_balance} onChange={(event) => setForm((prev) => ({ ...prev, gold_balance: event.target.value }))} /></label>
          <label>Premium<input type="number" value={form.premium_currency} onChange={(event) => setForm((prev) => ({ ...prev, premium_currency: event.target.value }))} /></label>
          <label>Power score<input type="number" value={form.power_score} onChange={(event) => setForm((prev) => ({ ...prev, power_score: event.target.value }))} /></label>
          <label>Combat power<input type="number" value={form.combat_power} onChange={(event) => setForm((prev) => ({ ...prev, combat_power: event.target.value }))} /></label>
          <label>EXP hiện tại<input type="number" value={form.current_exp} onChange={(event) => setForm((prev) => ({ ...prev, current_exp: event.target.value }))} /></label>
          <label>Tổng EXP<input type="number" value={form.total_exp_earned} onChange={(event) => setForm((prev) => ({ ...prev, total_exp_earned: event.target.value }))} /></label>
          <label>Full name<input value={form.full_name} onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))} /></label>
          <label>Phone<input value={form.phone_number} onChange={(event) => setForm((prev) => ({ ...prev, phone_number: event.target.value }))} /></label>
          <label>Country<input value={form.country} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} /></label>
          <label>Topup total<input type="number" value={form.total_topup_amount} onChange={(event) => setForm((prev) => ({ ...prev, total_topup_amount: event.target.value }))} /></label>
          <label>VIP EXP<input type="number" value={form.vip_exp} onChange={(event) => setForm((prev) => ({ ...prev, vip_exp: event.target.value }))} /></label>
          <label>Avatar URL<input value={form.avatar_url} onChange={(event) => setForm((prev) => ({ ...prev, avatar_url: event.target.value }))} /></label>
          <label className="form-span-2">Bio<textarea rows="4" value={form.bio} onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))} /></label>
        </div>
      </CrudModal>
    </div>
  );
}
