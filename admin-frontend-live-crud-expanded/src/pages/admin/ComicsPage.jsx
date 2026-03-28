import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatDate, formatNumber, slugify, statusChip, toArray } from '../../utils/adminHelpers';

const emptyForm = {
  author_id: '',
  title: '',
  slug: '',
  cover_image_url: '',
  banner_image_url: '',
  summary: '',
  publication_status: 'draft',
  visibility_status: 'public',
  age_rating: 'all',
  genre_ids: [],
};

export default function ComicsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [data, setData] = useState({ items: [], authors: [], genres: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/admin/comics');
      setData({
        items: toArray(result?.data),
        authors: result?.data?.authors || [],
        genres: result?.data?.genres || [],
      });
    } catch (error) {
      setErrorText(error.message || 'Không tải được truyện');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    return data.items.filter((item) => {
      const q = keyword.trim().toLowerCase();
      const okKeyword = !q || JSON.stringify(item).toLowerCase().includes(q);
      const okStatus = status === 'all' || item.publication_status === status;
      return okKeyword && okStatus;
    });
  }, [data.items, keyword, status]);

  const stats = [
    { label: 'Tổng truyện', value: formatNumber(data.items.length), icon: '📚', tone: 'mint' },
    { label: 'Đang cập nhật', value: formatNumber(data.items.filter((item) => item.publication_status === 'ongoing').length), icon: '🌀', tone: 'green' },
    { label: 'Hoàn thành', value: formatNumber(data.items.filter((item) => item.publication_status === 'completed').length), icon: '✔', tone: 'blue' },
    { label: 'Tổng lượt xem', value: formatNumber(data.items.reduce((sum, item) => sum + Number(item.total_views || 0), 0)), icon: '👁', tone: 'gold' },
  ];

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      author_id: item.author_id || '',
      title: item.title || '',
      slug: item.slug || '',
      cover_image_url: item.cover_image_url || '',
      banner_image_url: item.banner_image_url || '',
      summary: item.summary || '',
      publication_status: item.publication_status || 'draft',
      visibility_status: item.visibility_status || 'public',
      age_rating: item.age_rating || 'all',
      genre_ids: String(item.genre_ids || '')
        .split(',')
        .map((value) => Number(value))
        .filter(Boolean),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        author_id: form.author_id ? Number(form.author_id) : null,
        genre_ids: form.genre_ids.map(Number).filter(Boolean),
      };
      if (editingItem) {
        await apiRequest(`/api/admin/comics/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/admin/comics', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu truyện thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa truyện ${item.title}?`)) return;
    try {
      await apiRequest(`/api/admin/comics/${item.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa truyện thất bại');
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar
        title="Quản lý Truyện tranh"
        description="Quản lý toàn bộ truyện tranh trong hệ thống bằng dữ liệu thật từ API"
        action={<button className="teal-btn" onClick={openCreate}>+ Thêm truyện mới</button>}
      />

      <StatCardsRow items={stats} />

      <div className="panel readdy-toolbar-card">
        <div className="readdy-toolbar toolbar-comics">
          <div className="readdy-search-input is-wide">
            <span>⌕</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm theo tên truyện, tác giả..." />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="ongoing">Đang cập nhật</option>
            <option value="completed">Hoàn thành</option>
            <option value="hiatus">Tạm ngưng</option>
            <option value="draft">Nháp</option>
          </select>
        </div>
      </div>

      {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
      {loading ? <div className="empty-card"><div className="empty-title">Đang tải dữ liệu truyện...</div></div> : null}

      {!loading && filteredItems.length === 0 ? (
        <EmptyState title="Chưa có truyện nào" description="Tạo truyện đầu tiên để bắt đầu quản lý nội dung." action={<button className="teal-btn" onClick={openCreate}>Thêm truyện</button>} />
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <div className="panel readdy-table-panel">
          <div className="table-wrap">
            <table className="readdy-table">
              <thead>
                <tr>
                  <th>Truyện</th>
                  <th>Tác giả</th>
                  <th>Thể loại</th>
                  <th>Trạng thái</th>
                  <th>Chapters</th>
                  <th>Lượt xem</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="readdy-comic-row">
                        <div className="comic-thumb">{(item.title || 'C').slice(0, 1)}</div>
                        <div className="readdy-user-copy">
                          <strong>{item.title}</strong>
                          <span>ID: {item.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.author_name || '-'}</td>
                    <td>{item.genres || '-'}</td>
                    <td><span className={`readdy-chip ${statusChip(item.publication_status)}`}>{item.publication_status}</span></td>
                    <td>{formatNumber(item.total_chapters)}</td>
                    <td>{formatNumber(item.total_views)}</td>
                    <td>{formatDate(item.created_at)}</td>
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

      <CrudModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Chỉnh sửa truyện' : 'Thêm truyện mới'}
        footer={
          <>
            <button className="secondary-btn" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="teal-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu...' : 'Lưu truyện'}</button>
          </>
        }
      >
        <div className="form-grid-two">
          <label>
            Tác giả
            <select value={form.author_id} onChange={(event) => setForm((prev) => ({ ...prev, author_id: event.target.value }))}>
              <option value="">Chưa chọn</option>
              {data.authors.map((author) => <option key={author.id} value={author.id}>{author.name}</option>)}
            </select>
          </label>
          <label>
            Tên truyện
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value, slug: prev.slug || slugify(event.target.value) }))} />
          </label>
          <label>
            Slug
            <input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))} />
          </label>
          <label>
            Trạng thái phát hành
            <select value={form.publication_status} onChange={(event) => setForm((prev) => ({ ...prev, publication_status: event.target.value }))}>
              <option value="draft">draft</option>
              <option value="ongoing">ongoing</option>
              <option value="completed">completed</option>
              <option value="hiatus">hiatus</option>
            </select>
          </label>
          <label>
            Hiển thị
            <select value={form.visibility_status} onChange={(event) => setForm((prev) => ({ ...prev, visibility_status: event.target.value }))}>
              <option value="public">public</option>
              <option value="private">private</option>
              <option value="hidden">hidden</option>
            </select>
          </label>
          <label>
            Độ tuổi
            <select value={form.age_rating} onChange={(event) => setForm((prev) => ({ ...prev, age_rating: event.target.value }))}>
              <option value="all">all</option>
              <option value="teen">teen</option>
              <option value="mature">mature</option>
            </select>
          </label>
          <label className="form-span-2">
            Thể loại
            <select multiple value={form.genre_ids.map(String)} onChange={(event) => setForm((prev) => ({ ...prev, genre_ids: Array.from(event.target.selectedOptions).map((option) => Number(option.value)) }))}>
              {data.genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
            </select>
          </label>
          <label className="form-span-2">Cover URL<input value={form.cover_image_url} onChange={(event) => setForm((prev) => ({ ...prev, cover_image_url: event.target.value }))} /></label>
          <label className="form-span-2">Banner URL<input value={form.banner_image_url} onChange={(event) => setForm((prev) => ({ ...prev, banner_image_url: event.target.value }))} /></label>
          <label className="form-span-2">Tóm tắt<textarea rows="4" value={form.summary} onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))} /></label>
        </div>
      </CrudModal>
    </div>
  );
}
