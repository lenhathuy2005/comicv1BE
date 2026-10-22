import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatDateTime, formatNumber, statusChip } from '../../utils/adminHelpers';

export default function CommentsPage() {
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [comicId, setComicId] = useState('all');
  const [items, setItems] = useState([]);
  const [comics, setComics] = useState([]);
  const [stats, setStats] = useState({ total: 0, visible: 0, hidden: 0, reported: 0 });
  const [detail, setDetail] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/admin/comments');
      setItems(result?.data?.items || []);
      setComics(result?.data?.comics || []);
      setStats(result?.data?.stats || { total: 0, visible: 0, hidden: 0, reported: 0 });
    } catch (error) {
      setErrorText(error.message || 'Không tải được bình luận');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const q = keyword.trim().toLowerCase();
    const okKeyword = !q || JSON.stringify(item).toLowerCase().includes(q);
    const okStatus = status === 'all' || item.comment_status === status;
    const okComic = comicId === 'all' || String(item.comic_id) === comicId;
    return okKeyword && okStatus && okComic;
  }), [items, keyword, status, comicId]);

  const statCards = [
    { label: 'Tổng bình luận', value: formatNumber(stats.total), icon: '💬', tone: 'mint' },
    { label: 'Đang hiển thị', value: formatNumber(stats.visible), icon: '👁', tone: 'green' },
    { label: 'Bị báo cáo', value: formatNumber(stats.reported), icon: '⚠', tone: 'red' },
    { label: 'Đã ẩn', value: formatNumber(stats.hidden), icon: '🙈', tone: 'gray' },
  ];

  const updateStatus = async (item, nextStatus) => {
    try {
      await apiRequest(`/api/admin/comments/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ comment_status: nextStatus }),
      });
      await loadData();
      if (detail?.id === item.id) setDetail((prev) => ({ ...prev, comment_status: nextStatus }));
    } catch (error) {
      alert(error.message || 'Cập nhật trạng thái bình luận thất bại');
    }
  };

  const deleteComment = async (item) => {
    if (!window.confirm('Xóa bình luận này?')) return;
    try {
      await apiRequest(`/api/admin/comments/${item.id}`, { method: 'DELETE' });
      await loadData();
      if (detail?.id === item.id) setDetail(null);
    } catch (error) {
      alert(error.message || 'Xóa bình luận thất bại');
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý Bình luận" description="Kiểm duyệt bình luận thật từ hệ thống" />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-toolbar-card">
        <div className="readdy-toolbar toolbar-comments">
          <div className="readdy-search-input is-wide"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm bình luận, người dùng, truyện..." /></div>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="visible">visible</option>
            <option value="hidden">hidden</option>
            <option value="deleted">deleted</option>
          </select>
          <select value={comicId} onChange={(event) => setComicId(event.target.value)}>
            <option value="all">Tất cả truyện</option>
            {comics.map((comic) => <option key={comic.id} value={comic.id}>{comic.title}</option>)}
          </select>
        </div>
      </div>
      {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
      {loading ? <div className="empty-card"><div className="empty-title">Đang tải bình luận...</div></div> : null}
      {!loading && filtered.length === 0 ? <EmptyState title="Không có bình luận phù hợp" description="Đổi bộ lọc hoặc thử từ khóa khác." /> : null}
      {!loading && filtered.length > 0 ? (
        <div className="panel readdy-table-panel">
          <div className="table-wrap">
            <table className="readdy-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Truyện / Chapter</th>
                  <th>Nội dung</th>
                  <th>Tương tác</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><div className="readdy-user-copy"><strong>{item.user_name}</strong><span>@{item.username}</span></div></td>
                    <td><div className="readdy-user-copy"><strong>{item.comic_title || '-'}</strong><span>{item.chapter_title || (item.chapter_number ? `Ch. ${item.chapter_number}` : '-')}</span></div></td>
                    <td className="cell-comment">{item.content}</td>
                    <td><div className="readdy-user-copy"><strong>♥ {formatNumber(item.like_count)}</strong><span>⚑ {formatNumber(item.report_count)}</span></div></td>
                    <td><span className={`readdy-chip ${statusChip(item.comment_status)}`}>{item.comment_status}</span></td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>
                      <div className="readdy-actions-inline">
                        <button className="icon-btn blue" onClick={() => setDetail(item)}>◉</button>
                        <button className="icon-btn teal" onClick={() => updateStatus(item, item.comment_status === 'visible' ? 'hidden' : 'visible')}>{item.comment_status === 'visible' ? '🙈' : '👁'}</button>
                        <button className="icon-btn red" onClick={() => deleteComment(item)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <CrudModal open={!!detail} onClose={() => setDetail(null)} title="Chi tiết bình luận" footer={<><button className="secondary-btn" onClick={() => setDetail(null)}>Đóng</button>{detail ? <button className="teal-btn" onClick={() => updateStatus(detail, detail.comment_status === 'visible' ? 'hidden' : 'visible')}>Chuyển sang {detail.comment_status === 'visible' ? 'hidden' : 'visible'}</button> : null}</>}>
        {detail ? (
          <div className="form-grid-two">
            <label>Người dùng<input readOnly value={`${detail.user_name} (@${detail.username})`} /></label>
            <label>Trạng thái<input readOnly value={detail.comment_status} /></label>
            <label className="form-span-2">Truyện / Chapter<input readOnly value={`${detail.comic_title || '-'} / ${detail.chapter_title || detail.chapter_number || '-'}`} /></label>
            <label className="form-span-2">Nội dung<textarea readOnly rows="6" value={detail.content || ''} /></label>
            <label>Lượt thích<input readOnly value={detail.like_count || 0} /></label>
            <label>Số report<input readOnly value={detail.report_count || 0} /></label>
          </div>
        ) : null}
      </CrudModal>
    </div>
  );
}
