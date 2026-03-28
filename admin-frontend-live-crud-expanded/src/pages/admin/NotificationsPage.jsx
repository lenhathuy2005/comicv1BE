import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';

const emptyForm = {
  title: '',
  content: '',
  target_scope: 'all',
  scheduled_at: '',
  notification_status: 'draft',
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function toDatetimeLocal(value) {
  if (!value) return '';
  return String(value).replace(' ', 'T').slice(0, 16);
}

function statusCls(status) {
  const map = {
    sent: 'chip-green',
    scheduled: 'chip-gold',
    draft: 'chip-gray',
    cancelled: 'chip-red',
  };
  return map[status] || 'chip-gray';
}

function targetLabel(value) {
  const map = {
    all: 'Tất cả',
    vip_only: 'VIP',
    guild_only: 'Bang hội',
    specific_users: 'Nhóm chỉ định',
  };
  return map[value] || value;
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, scheduled: 0, draft: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/notifications/admin/system');
      setItems(toArray(result?.data));
      setStats(result?.data?.stats || { total: 0, sent: 0, scheduled: 0, draft: 0 });
    } catch (error) {
      setErrorText(error.message || 'Không tải được thông báo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = keyword.trim().toLowerCase();
      const okKeyword = !q || JSON.stringify(item).toLowerCase().includes(q);
      const okStatus = statusFilter === 'all' || item.notification_status === statusFilter;
      const okTarget = targetFilter === 'all' || item.target_scope === targetFilter;
      return okKeyword && okStatus && okTarget;
    });
  }, [items, keyword, statusFilter, targetFilter]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      content: item.content || '',
      target_scope: item.target_scope || 'all',
      scheduled_at: toDatetimeLocal(item.scheduled_at),
      notification_status: item.notification_status || 'draft',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        target_scope: form.target_scope,
        scheduled_at: form.scheduled_at ? form.scheduled_at.replace('T', ' ') + ':00' : null,
        notification_status: form.notification_status,
      };
      if (editingItem) {
        await apiRequest(`/api/notifications/admin/system/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/notifications/admin/system', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu thông báo thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa thông báo ${item.title}?`)) return;
    try {
      await apiRequest(`/api/notifications/admin/system/${item.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa thông báo thất bại');
    }
  };

  const handleSend = async (item) => {
    if (!window.confirm(`Gửi thông báo ${item.title} ngay bây giờ?`)) return;
    try {
      await apiRequest(`/api/notifications/admin/system/${item.id}/send`, { method: 'POST', body: JSON.stringify({}) });
      await loadData();
    } catch (error) {
      alert(error.message || 'Gửi thông báo thất bại');
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar
        title="Quản lý Thông báo"
        description="Quản lý thông báo hệ thống gửi đến người dùng"
        action={<button className="teal-btn" onClick={openCreate}>+ Tạo thông báo</button>}
      />

      <StatCardsRow
        items={[
          { label: 'Tổng thông báo', value: formatNumber(stats.total), icon: '🔔', tone: 'mint' },
          { label: 'Đã gửi', value: formatNumber(stats.sent), icon: '➤', tone: 'green' },
          { label: 'Đã lên lịch', value: formatNumber(stats.scheduled), icon: '🕘', tone: 'gold' },
          { label: 'Bản nháp', value: formatNumber(stats.draft), icon: '✎', tone: 'gray' },
        ]}
      />

      <div className="panel readdy-toolbar-card">
        <div className="readdy-toolbar toolbar-notifications-visual">
          <div className="readdy-search-input is-wide">
            <span>⌕</span>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm kiếm thông báo..." />
          </div>
          <div className="inline-select-row">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="scheduled">Đã lên lịch</option>
              <option value="sent">Đã gửi</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            <select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)}>
              <option value="all">Tất cả đối tượng</option>
              <option value="vip_only">VIP</option>
              <option value="guild_only">Bang hội</option>
              <option value="specific_users">Nhóm chỉ định</option>
            </select>
          </div>
        </div>
      </div>

      {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
      {loading ? <div className="empty-card"><div className="empty-title">Đang tải thông báo...</div></div> : null}

      {!loading && filteredItems.map((item) => (
        <div className="panel notification-card-real" key={item.id}>
          <div className="notification-card-head">
            <div className="notification-title-wrap">
              <div className="notification-icon-box">✦</div>
              <div>
                <div className="notification-title-row">
                  <h3>{item.title}</h3>
                  <span className={`readdy-chip ${statusCls(item.notification_status)}`}>{item.notification_status}</span>
                </div>
                <p>{item.content}</p>
                <div className="notification-meta-row">
                  <span>👥 {formatNumber(item.recipient_count)} người nhận</span>
                  <span>👁 {formatNumber(item.read_count)} đã đọc</span>
                  <span>🎯 {targetLabel(item.target_scope)}</span>
                  <span>🕒 {String(item.scheduled_at || item.sent_at || item.created_at).replace('T', ' ').slice(0, 19)}</span>
                </div>
              </div>
            </div>
            <div className="notification-right-meta">
              {item.scheduled_at ? <span>{String(item.scheduled_at).replace('T', ' ').slice(0, 19)}</span> : null}
            </div>
          </div>
          <div className="notification-action-row">
            {item.notification_status !== 'sent' ? <button className="soft-btn" onClick={() => handleSend(item)}>➤ Gửi ngay</button> : null}
            <button className="secondary-btn" onClick={() => openEdit(item)}>✎ Chỉnh sửa</button>
            <button className="icon-danger-btn" onClick={() => handleDelete(item)}>🗑 Xóa</button>
          </div>
        </div>
      ))}

      <CrudModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Chỉnh sửa thông báo' : 'Tạo thông báo'}
        footer={
          <>
            <button className="secondary-btn" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="teal-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu...' : 'Lưu thông báo'}</button>
          </>
        }
      >
        <div className="form-grid-two">
          <label>Tên thông báo<input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
          <label>
            Đối tượng
            <select value={form.target_scope} onChange={(e) => setForm((prev) => ({ ...prev, target_scope: e.target.value }))}>
              <option value="all">Tất cả</option>
              <option value="vip_only">VIP</option>
              <option value="guild_only">Bang hội</option>
              <option value="specific_users">Nhóm chỉ định</option>
            </select>
          </label>
          <label>
            Trạng thái
            <select value={form.notification_status} onChange={(e) => setForm((prev) => ({ ...prev, notification_status: e.target.value }))}>
              <option value="draft">Bản nháp</option>
              <option value="scheduled">Đã lên lịch</option>
              <option value="sent">Đã gửi</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </label>
          <label>Lên lịch<input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm((prev) => ({ ...prev, scheduled_at: e.target.value }))} /></label>
          <label className="form-span-2">Nội dung<textarea rows="5" value={form.content} onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))} /></label>
        </div>
      </CrudModal>
    </div>
  );
}
