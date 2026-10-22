import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';

const emptyForm = {
  room_type: 'custom',
  name: '',
  code: '',
  description: '',
  linked_guild_id: '',
  min_vip_level_id: '',
  is_active: true,
};

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [tab, setTab] = useState('rooms');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ totalMessages: 0, activeRooms: 0, pendingReports: 0, totalMembers: 0 });
  const [rooms, setRooms] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/chat/admin/rooms');
      setRooms(result?.data?.rooms || []);
      setReports(result?.data?.reports || []);
      setStats(result?.data?.stats || { totalMessages: 0, activeRooms: 0, pendingReports: 0, totalMembers: 0 });
    } catch (error) {
      setErrorText(error.message || 'Không tải được dữ liệu chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRooms = useMemo(() => rooms.filter((room) => !search.trim() || JSON.stringify(room).toLowerCase().includes(search.trim().toLowerCase())), [rooms, search]);

  const openCreate = () => {
    setEditingRoom(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (room) => {
    setEditingRoom(room);
    setForm({
      room_type: room.room_type || 'custom',
      name: room.name || '',
      code: room.code || '',
      description: room.description || '',
      linked_guild_id: room.linked_guild_id || '',
      min_vip_level_id: room.min_vip_level_id || '',
      is_active: Boolean(room.is_active),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      room_type: form.room_type,
      name: form.name,
      code: form.code,
      description: form.description || null,
      linked_guild_id: form.linked_guild_id === '' ? null : Number(form.linked_guild_id),
      min_vip_level_id: form.min_vip_level_id === '' ? null : Number(form.min_vip_level_id),
      is_active: form.is_active ? 1 : 0,
    };
    try {
      if (editingRoom) {
        await apiRequest(`/api/chat/admin/rooms/${editingRoom.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/chat/admin/rooms', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu phòng chat thất bại');
    }
  };

  const openMessages = async (room) => {
    try {
      const result = await apiRequest(`/api/chat/admin/rooms/${room.id}/messages`);
      setSelectedRoom(result?.data?.room || room);
      setMessages(result?.data?.messages || []);
      setMessageModalOpen(true);
    } catch (error) {
      alert(error.message || 'Không tải được tin nhắn phòng chat');
    }
  };

  const handleDeleteRoom = async (room) => {
    if (!window.confirm(`Ẩn phòng chat ${room.name}?`)) return;
    try {
      await apiRequest(`/api/chat/admin/rooms/${room.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa phòng chat thất bại');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Ẩn tin nhắn này?')) return;
    try {
      await apiRequest(`/api/chat/admin/messages/${messageId}`, { method: 'DELETE' });
      if (selectedRoom) {
        await openMessages(selectedRoom);
      }
      await loadData();
    } catch (error) {
      alert(error.message || 'Ẩn tin nhắn thất bại');
    }
  };

  const roomTypeSummary = useMemo(() => {
    return rooms.reduce((acc, room) => {
      acc[room.room_type] = (acc[room.room_type] || 0) + 1;
      return acc;
    }, {});
  }, [rooms]);

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý Cộng đồng Chat" description="Quản lý phòng chat, tin nhắn và báo cáo vi phạm" />

      <div className="chat-gradient-stat-grid">
        <div className="chat-gradient-stat tone-blue-gradient"><span>Tổng tin nhắn</span><strong>{formatNumber(stats.totalMessages)}</strong></div>
        <div className="chat-gradient-stat tone-green-gradient"><span>Phòng hoạt động</span><strong>{formatNumber(stats.activeRooms)}</strong></div>
        <div className="chat-gradient-stat tone-orange-gradient"><span>Báo cáo chờ xử lý</span><strong>{formatNumber(stats.pendingReports)}</strong></div>
        <div className="chat-gradient-stat tone-purple-gradient"><span>Tổng thành viên</span><strong>{formatNumber(stats.totalMembers)}</strong></div>
      </div>

      <div className="panel readdy-tabs-panel">
        <div className="readdy-tabs is-four-tabs">
          <button className={tab === 'rooms' ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab('rooms')}>Phòng chat</button>
          <button className={tab === 'messages' ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab('messages')}>Tin nhắn</button>
          <button className={tab === 'reports' ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab('reports')}>Báo cáo <span className="tab-counter">{stats.pendingReports}</span></button>
          <button className={tab === 'stats' ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab('stats')}>Thống kê</button>
        </div>

        <div className="readdy-toolbar toolbar-guilds">
          <div className="readdy-search-input">
            <span>⌕</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm phòng chat..." />
          </div>
          <button className="teal-btn" onClick={openCreate}>+ Thêm phòng chat</button>
        </div>

        {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
        {loading ? <div className="empty-card"><div className="empty-title">Đang tải dữ liệu chat...</div></div> : null}

        {!loading && tab === 'rooms' ? (
          <div className="table-wrap">
            <table className="readdy-table">
              <thead>
                <tr>
                  <th>Phòng chat</th>
                  <th>Trạng thái</th>
                  <th>Thành viên</th>
                  <th>Tin nhắn</th>
                  <th>Hoạt động cuối</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => (
                  <tr key={room.id}>
                    <td>
                      <div className="readdy-user-copy">
                        <strong>{room.name}</strong>
                        <span>{room.description || room.code}</span>
                      </div>
                    </td>
                    <td><span className={`readdy-chip ${Number(room.is_active) === 1 ? 'chip-green' : 'chip-gray'}`}>{Number(room.is_active) === 1 ? 'Hoạt động' : 'Đã ẩn'}</span></td>
                    <td>{formatNumber(room.active_member_count || room.member_count)}</td>
                    <td>{formatNumber(room.message_count)}</td>
                    <td>{room.last_message_at ? String(room.last_message_at).replace('T', ' ').slice(0, 16) : '-'}</td>
                    <td>
                      <div className="readdy-actions-inline">
                        <button className="icon-btn blue" onClick={() => openMessages(room)}>◉</button>
                        <button className="icon-btn teal" onClick={() => openEdit(room)}>✎</button>
                        <button className="icon-btn red" onClick={() => handleDeleteRoom(room)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && tab === 'messages' ? (
          <div className="empty-card">
            <div className="empty-title">Chọn biểu tượng mắt ở tab “Phòng chat” để xem tin nhắn chi tiết.</div>
          </div>
        ) : null}

        {!loading && tab === 'reports' ? (
          <div className="table-wrap">
            <table className="readdy-table">
              <thead>
                <tr>
                  <th>Phòng</th>
                  <th>Người báo cáo</th>
                  <th>Tác giả tin nhắn</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {reports.length ? reports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.room_name}</td>
                    <td>{report.reported_by_name}</td>
                    <td>{report.message_author_name}</td>
                    <td>{report.reason}</td>
                    <td><span className={`readdy-chip ${report.report_status === 'pending' ? 'chip-red' : 'chip-gray'}`}>{report.report_status}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan="5">Chưa có báo cáo nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && tab === 'stats' ? (
          <div className="mini-stat-grid">
            {Object.entries(roomTypeSummary).map(([key, value]) => (
              <div className="mini-stat-card" key={key}>
                <span>{key}</span>
                <strong>{formatNumber(value)}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <CrudModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRoom ? 'Chỉnh sửa phòng chat' : 'Tạo phòng chat'}
        footer={
          <>
            <button className="secondary-btn" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="teal-btn" onClick={handleSave}>Lưu phòng chat</button>
          </>
        }
      >
        <div className="form-grid-two">
          <label>Tên phòng<input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></label>
          <label>Mã code<input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} /></label>
          <label>
            Loại phòng
            <select value={form.room_type} onChange={(e) => setForm((prev) => ({ ...prev, room_type: e.target.value }))}>
              <option value="custom">Custom</option>
              <option value="global">Global</option>
              <option value="guild">Guild</option>
              <option value="vip">VIP</option>
              <option value="system">System</option>
            </select>
          </label>
          <label>Guild liên kết<input value={form.linked_guild_id} onChange={(e) => setForm((prev) => ({ ...prev, linked_guild_id: e.target.value }))} /></label>
          <label>VIP level tối thiểu<input value={form.min_vip_level_id} onChange={(e) => setForm((prev) => ({ ...prev, min_vip_level_id: e.target.value }))} /></label>
          <label className="form-checkbox-inline"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} /> Kích hoạt</label>
          <label className="form-span-2">Mô tả<textarea rows="4" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
        </div>
      </CrudModal>

      <CrudModal
        open={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        title={selectedRoom ? `Tin nhắn: ${selectedRoom.name}` : 'Tin nhắn phòng chat'}
        size="large"
        footer={<button className="secondary-btn" onClick={() => setMessageModalOpen(false)}>Đóng</button>}
      >
        <div className="modal-message-list">
          {messages.map((message) => (
            <div key={message.id} className="modal-message-item">
              <div>
                <strong>{message.display_name || message.username}</strong>
                <div className="modal-message-meta">{String(message.sent_at).replace('T', ' ').slice(0, 19)}</div>
                <p>{message.content}</p>
              </div>
              <button className="icon-btn red" onClick={() => handleDeleteMessage(message.id)}>🗑</button>
            </div>
          ))}
        </div>
      </CrudModal>
    </div>
  );
}
