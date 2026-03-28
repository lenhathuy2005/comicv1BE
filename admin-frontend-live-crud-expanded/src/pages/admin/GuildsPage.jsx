import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatDateTime, formatNumber, slugify, statusChip } from '../../utils/adminHelpers';

const emptyGuild = {
  name: '',
  slug: '',
  logo_url: '',
  description: '',
  announcement: '',
  leader_user_id: '',
  member_limit: 30,
  level: 1,
  contribution_points: 0,
  guild_power: 0,
  guild_status: 'active',
};

const emptyRole = {
  code: '',
  name: '',
  hierarchy_level: 1,
  can_manage_members: true,
  can_approve_join: true,
  can_post_notice: false,
  can_manage_chat: false,
  can_promote_members: false,
  can_manage_guild: false,
  description: '',
};

export default function GuildsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [tab, setTab] = useState('Bang phái');
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState({ stats: {}, items: [], members: [], requests: [], roles: [], logs: [], users: [] });
  const [guildModalOpen, setGuildModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingGuild, setEditingGuild] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [guildForm, setGuildForm] = useState(emptyGuild);
  const [roleForm, setRoleForm] = useState(emptyRole);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/admin/guilds');
      setData({
        stats: result?.data?.stats || {},
        items: result?.data?.items || [],
        members: result?.data?.members || [],
        requests: result?.data?.requests || [],
        roles: result?.data?.roles || [],
        logs: result?.data?.logs || [],
        users: result?.data?.users || [],
      });
    } catch (error) {
      setErrorText(error.message || 'Không tải được bang phái');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredGuilds = useMemo(() => data.items.filter((item) => {
    const q = keyword.trim().toLowerCase();
    return !q || JSON.stringify(item).toLowerCase().includes(q);
  }), [data.items, keyword]);

  const statCards = [
    { label: 'Tổng bang phái', value: formatNumber(data.stats.total), icon: '🛡', tone: 'mint' },
    { label: 'Bang hoạt động', value: formatNumber(data.stats.active), icon: '✅', tone: 'green' },
    { label: 'Tổng thành viên', value: formatNumber(data.stats.members), icon: '👥', tone: 'purple' },
    { label: 'Yêu cầu chờ duyệt', value: formatNumber(data.stats.pending), icon: '⏳', tone: 'orange' },
  ];

  const openCreateGuild = () => {
    setEditingGuild(null);
    setGuildForm(emptyGuild);
    setGuildModalOpen(true);
  };

  const openEditGuild = (item) => {
    setEditingGuild(item);
    setGuildForm({
      name: item.name || '',
      slug: item.slug || '',
      logo_url: item.logo_url || '',
      description: item.description || '',
      announcement: item.announcement || '',
      leader_user_id: item.leader_user_id || '',
      member_limit: item.member_limit || 30,
      level: item.level || 1,
      contribution_points: item.contribution_points || 0,
      guild_power: item.guild_power || 0,
      guild_status: item.guild_status || 'active',
    });
    setGuildModalOpen(true);
  };

  const saveGuild = async () => {
    setSaving(true);
    try {
      const payload = { ...guildForm, leader_user_id: Number(guildForm.leader_user_id) };
      if (editingGuild) {
        await apiRequest(`/api/admin/guilds/${editingGuild.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/admin/guilds', { method: 'POST', body: JSON.stringify(payload) });
      }
      setGuildModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu bang phái thất bại');
    } finally {
      setSaving(false);
    }
  };

  const deleteGuild = async (item) => {
    if (!window.confirm(`Xóa bang phái ${item.name}?`)) return;
    try {
      await apiRequest(`/api/admin/guilds/${item.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa bang phái thất bại');
    }
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm(emptyRole);
    setRoleModalOpen(true);
  };

  const openEditRole = (item) => {
    setEditingRole(item);
    setRoleForm({ ...item });
    setRoleModalOpen(true);
  };

  const saveRole = async () => {
    setSaving(true);
    try {
      if (editingRole) {
        await apiRequest(`/api/admin/guild-roles/${editingRole.id}`, { method: 'PUT', body: JSON.stringify(roleForm) });
      } else {
        await apiRequest('/api/admin/guild-roles', { method: 'POST', body: JSON.stringify(roleForm) });
      }
      setRoleModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu chức vụ thất bại');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (item) => {
    if (!window.confirm(`Xóa chức vụ ${item.name}?`)) return;
    try {
      await apiRequest(`/api/admin/guild-roles/${item.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa chức vụ thất bại');
    }
  };

  const reviewRequest = async (item, action) => {
    try {
      await apiRequest(`/api/admin/guild-join-requests/${item.id}/${action}`, { method: 'POST', body: JSON.stringify({}) });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xử lý yêu cầu thất bại');
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý Bang Phái" description="Quản lý bang hội, thành viên, chức vụ và yêu cầu gia nhập bằng dữ liệu thật" action={<button className="teal-btn" onClick={openCreateGuild}>+ Thêm bang phái</button>} />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-tabs-panel">
        <div className="readdy-tabs">
          {['Bang phái', 'Thành viên', 'Yêu cầu gia nhập', 'Chức vụ & Quyền hạn', 'Log hoạt động'].map((label) => (
            <button key={label} className={tab === label ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab(label)}>
              {label}
              {label === 'Yêu cầu gia nhập' ? <span className="tab-counter">{formatNumber(data.requests.filter((item) => item.request_status === 'pending').length)}</span> : null}
            </button>
          ))}
        </div>
        <div className="readdy-toolbar toolbar-guilds">
          <div className="readdy-search-input"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm..." /></div>
          {tab === 'Bang phái' ? <button className="teal-btn" onClick={openCreateGuild}>+ Thêm bang phái</button> : null}
          {tab === 'Chức vụ & Quyền hạn' ? <button className="teal-btn" onClick={openCreateRole}>+ Thêm chức vụ</button> : null}
        </div>
        {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
        {loading ? <div className="empty-card"><div className="empty-title">Đang tải bang phái...</div></div> : null}
        {!loading && tab === 'Bang phái' ? (
          filteredGuilds.length === 0 ? <EmptyState title="Chưa có bang phái" description="Tạo bang phái đầu tiên." action={<button className="teal-btn" onClick={openCreateGuild}>Thêm bang phái</button>} /> : (
            <div className="readdy-guild-grid">
              {filteredGuilds.map((item) => (
                <div key={item.id} className="readdy-guild-card">
                  <div className="readdy-guild-top">
                    <div className="readdy-guild-emblem tone-gold">✪</div>
                    <div className="readdy-guild-copy">
                      <h3>{item.name}</h3>
                      <p>{item.description || 'Chưa có mô tả'}</p>
                    </div>
                    <span className={`readdy-chip ${statusChip(item.guild_status)}`}>{item.guild_status}</span>
                  </div>
                  <div className="readdy-guild-meta-grid">
                    <span>♛ {item.leader_name || '-'}</span>
                    <span>◌ {formatNumber(item.members_count)}/{formatNumber(item.member_limit)} thành viên</span>
                    <span>⚡ Sức mạnh: {formatNumber(item.guild_power)}</span>
                    <span>⌁ Yêu cầu chờ duyệt: {formatNumber(item.pending_requests)}</span>
                  </div>
                  <div className="readdy-guild-footer">
                    <div className="readdy-inline-meta"><span className="readdy-chip chip-mint">Cấp {item.level}</span> Thành lập: {formatDateTime(item.created_at)}</div>
                    <div className="readdy-actions-inline">
                      <button className="icon-btn teal" onClick={() => openEditGuild(item)}>✎</button>
                      <button className="icon-btn red" onClick={() => deleteGuild(item)}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}
        {!loading && tab === 'Thành viên' ? (
          <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Bang phái</th><th>Người dùng</th><th>Chức vụ</th><th>Trạng thái</th><th>Đóng góp</th><th>Ngày vào</th></tr></thead><tbody>{data.members.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())).map((item) => <tr key={item.id}><td>{item.guild_name}</td><td>{item.user_name}</td><td>{item.role_name}</td><td><span className={`readdy-chip ${statusChip(item.join_status)}`}>{item.join_status}</span></td><td>{formatNumber(item.contribution_points)}</td><td>{formatDateTime(item.joined_at)}</td></tr>)}</tbody></table></div>
        ) : null}
        {!loading && tab === 'Yêu cầu gia nhập' ? (
          <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Bang phái</th><th>Người chơi</th><th>Lời nhắn</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>{data.requests.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())).map((item) => <tr key={item.id}><td>{item.guild_name}</td><td>{item.user_name}</td><td>{item.request_message || '-'}</td><td><span className={`readdy-chip ${statusChip(item.request_status)}`}>{item.request_status}</span></td><td>{formatDateTime(item.created_at)}</td><td><div className="readdy-actions-inline">{item.request_status === 'pending' ? <><button className="soft-btn" onClick={() => reviewRequest(item, 'approve')}>Duyệt</button><button className="icon-danger-btn" onClick={() => reviewRequest(item, 'reject')}>Từ chối</button></> : '-'}</div></td></tr>)}</tbody></table></div>
        ) : null}
        {!loading && tab === 'Chức vụ & Quyền hạn' ? (
          <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Mã</th><th>Tên</th><th>Thứ bậc</th><th>Quyền</th><th>Thao tác</th></tr></thead><tbody>{data.roles.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())).map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.hierarchy_level}</td><td>{['can_manage_members','can_approve_join','can_post_notice','can_manage_chat','can_promote_members','can_manage_guild'].filter((key) => Number(item[key]) === 1).join(', ') || '-'}</td><td><div className="readdy-actions-inline"><button className="icon-btn teal" onClick={() => openEditRole(item)}>✎</button><button className="icon-btn red" onClick={() => deleteRole(item)}>🗑</button></div></td></tr>)}</tbody></table></div>
        ) : null}
        {!loading && tab === 'Log hoạt động' ? (
          <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Bang phái</th><th>Hành động</th><th>Người thực hiện</th><th>Mục tiêu</th><th>Chi tiết</th><th>Thời gian</th></tr></thead><tbody>{data.logs.filter((item) => !keyword.trim() || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())).map((item) => <tr key={item.id}><td>{item.guild_name}</td><td>{item.action_type}</td><td>{item.user_name || '-'}</td><td>{item.target_user_name || '-'}</td><td>{item.details || '-'}</td><td>{formatDateTime(item.created_at)}</td></tr>)}</tbody></table></div>
        ) : null}
      </div>
      <CrudModal open={guildModalOpen} onClose={() => setGuildModalOpen(false)} title={editingGuild ? 'Chỉnh sửa bang phái' : 'Thêm bang phái'} footer={<><button className="secondary-btn" onClick={() => setGuildModalOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={saveGuild}>{saving ? 'Đang lưu...' : 'Lưu bang phái'}</button></>}>
        <div className="form-grid-two">
          <label>Tên bang<input value={guildForm.name} onChange={(event) => setGuildForm((prev) => ({ ...prev, name: event.target.value, slug: prev.slug || slugify(event.target.value) }))} /></label>
          <label>Slug<input value={guildForm.slug} onChange={(event) => setGuildForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))} /></label>
          <label>Bang chủ<select value={guildForm.leader_user_id} onChange={(event) => setGuildForm((prev) => ({ ...prev, leader_user_id: event.target.value }))}><option value="">Chọn người dùng</option>{data.users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label>
          <label>Trạng thái<select value={guildForm.guild_status} onChange={(event) => setGuildForm((prev) => ({ ...prev, guild_status: event.target.value }))}><option value="active">active</option><option value="locked">locked</option><option value="disbanded">disbanded</option></select></label>
          <label>Giới hạn thành viên<input type="number" value={guildForm.member_limit} onChange={(event) => setGuildForm((prev) => ({ ...prev, member_limit: event.target.value }))} /></label>
          <label>Cấp bang<input type="number" value={guildForm.level} onChange={(event) => setGuildForm((prev) => ({ ...prev, level: event.target.value }))} /></label>
          <label>Contribution<input type="number" value={guildForm.contribution_points} onChange={(event) => setGuildForm((prev) => ({ ...prev, contribution_points: event.target.value }))} /></label>
          <label>Guild power<input type="number" value={guildForm.guild_power} onChange={(event) => setGuildForm((prev) => ({ ...prev, guild_power: event.target.value }))} /></label>
          <label className="form-span-2">Logo URL<input value={guildForm.logo_url} onChange={(event) => setGuildForm((prev) => ({ ...prev, logo_url: event.target.value }))} /></label>
          <label className="form-span-2">Mô tả<textarea rows="4" value={guildForm.description} onChange={(event) => setGuildForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
          <label className="form-span-2">Thông báo bang<textarea rows="3" value={guildForm.announcement} onChange={(event) => setGuildForm((prev) => ({ ...prev, announcement: event.target.value }))} /></label>
        </div>
      </CrudModal>
      <CrudModal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title={editingRole ? 'Chỉnh sửa chức vụ bang' : 'Thêm chức vụ bang'} footer={<><button className="secondary-btn" onClick={() => setRoleModalOpen(false)}>Hủy</button><button className="teal-btn" disabled={saving} onClick={saveRole}>{saving ? 'Đang lưu...' : 'Lưu chức vụ'}</button></>}>
        <div className="form-grid-two">
          <label>Mã<input value={roleForm.code} onChange={(event) => setRoleForm((prev) => ({ ...prev, code: event.target.value }))} /></label>
          <label>Tên<input value={roleForm.name} onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))} /></label>
          <label>Thứ bậc<input type="number" value={roleForm.hierarchy_level} onChange={(event) => setRoleForm((prev) => ({ ...prev, hierarchy_level: event.target.value }))} /></label>
          <label className="form-span-2">Mô tả<textarea rows="3" value={roleForm.description} onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
          {['can_manage_members','can_approve_join','can_post_notice','can_manage_chat','can_promote_members','can_manage_guild'].map((field) => (
            <label key={field}>{field}<select value={String(roleForm[field])} onChange={(event) => setRoleForm((prev) => ({ ...prev, [field]: event.target.value === 'true' }))}><option value="true">Có</option><option value="false">Không</option></select></label>
          ))}
        </div>
      </CrudModal>
    </div>
  );
}
