import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatDate, formatNumber, fromDatetimeLocal, slugify, statusChip, toArray, toDatetimeLocal } from '../../utils/adminHelpers';

const emptyForm = {
  comic_id: '',
  chapter_number: '',
  title: '',
  slug: '',
  summary: '',
  access_type: 'free',
  publish_status: 'draft',
  released_at: '',
  images_text: '',
};

export default function ChaptersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [comicFilter, setComicFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState([]);
  const [comics, setComics] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/admin/chapters');
      setItems(result?.data?.items || []);
      setComics(result?.data?.comics || []);
    } catch (error) {
      setErrorText(error.message || 'Không tải được chapter');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = keyword.trim().toLowerCase();
      const okKeyword = !q || JSON.stringify(item).toLowerCase().includes(q);
      const okComic = comicFilter === 'all' || String(item.comic_id) === comicFilter;
      const okStatus = statusFilter === 'all' || item.publish_status === statusFilter;
      return okKeyword && okComic && okStatus;
    });
  }, [items, comicFilter, statusFilter, keyword]);

  const stats = [
    { label: 'Tổng chapter', value: formatNumber(items.length), icon: '📄', tone: 'mint' },
    { label: 'Đã xuất bản', value: formatNumber(items.filter((item) => item.publish_status === 'published').length), icon: '✔', tone: 'green' },
    { label: 'Nháp', value: formatNumber(items.filter((item) => item.publish_status === 'draft').length), icon: '✎', tone: 'gray' },
    { label: 'Tổng lượt xem', value: formatNumber(items.reduce((sum, item) => sum + Number(item.view_count || 0), 0)), icon: '👁', tone: 'gold' },
  ];

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = async (item) => {
    try {
      const result = await apiRequest(`/api/admin/chapters/${item.id}`);
      const detail = result?.data;
      setEditingId(item.id);
      setForm({
        comic_id: detail.comic_id || '',
        chapter_number: detail.chapter_number || '',
        title: detail.title || '',
        slug: detail.slug || '',
        summary: detail.summary || '',
        access_type: detail.access_type || 'free',
        publish_status: detail.publish_status || 'draft',
        released_at: toDatetimeLocal(detail.released_at),
        images_text: toArray(detail.images).map((image) => image.image_url).join('\n'),
      });
      setModalOpen(true);
    } catch (error) {
      alert(error.message || 'Không tải được chi tiết chapter');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const images = form.images_text
        .split('\n')
        .map((line, index) => ({ image_url: line.trim(), display_order: index + 1 }))
        .filter((item) => item.image_url);
      const payload = {
        comic_id: Number(form.comic_id),
        chapter_number: Number(form.chapter_number),
        title: form.title || null,
        slug: form.slug,
        summary: form.summary || null,
        access_type: form.access_type,
        publish_status: form.publish_status,
        released_at: fromDatetimeLocal(form.released_at),
        images,
      };
      if (editingId) {
        await apiRequest(`/api/admin/chapters/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/admin/chapters', { method: 'POST', body: JSON.stringify(payload) });
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu chapter thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa chapter ${item.title || item.chapter_number}?`)) return;
    try {
      await apiRequest(`/api/admin/chapters/${item.id}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa chapter thất bại');
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar
        title="Quản lý Chapter"
        description="Quản lý các chapter bằng dữ liệu thật từ API và database"
        action={<button className="teal-btn" onClick={openCreate}>+ Thêm chapter mới</button>}
      />

      <StatCardsRow items={stats} />

      <div className="panel readdy-toolbar-card">
        <div className="readdy-toolbar toolbar-chapters">
          <select value={comicFilter} onChange={(event) => setComicFilter(event.target.value)}>
            <option value="all">Tất cả truyện</option>
            {comics.map((comic) => <option key={comic.id} value={comic.id}>{comic.title}</option>)}
          </select>
          <div className="readdy-search-input is-wide">
            <span>⌕</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm kiếm chapter..." />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="published">published</option>
            <option value="draft">draft</option>
            <option value="hidden">hidden</option>
          </select>
        </div>
      </div>

      {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
      {loading ? <div className="empty-card"><div className="empty-title">Đang tải chapter...</div></div> : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState title="Chưa có chapter nào" description="Tạo chapter đầu tiên hoặc đổi bộ lọc để xem dữ liệu." action={<button className="teal-btn" onClick={openCreate}>Thêm chapter</button>} />
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="panel readdy-table-panel">
          <div className="table-wrap">
            <table className="readdy-table">
              <thead>
                <tr>
                  <th>Truyện</th>
                  <th>Chapter</th>
                  <th>Tiêu đề</th>
                  <th>Số ảnh</th>
                  <th>Trạng thái</th>
                  <th>Lượt xem</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{item.comic_title}</td>
                    <td><span className="readdy-chip chip-mint">Ch. {item.chapter_number}</span></td>
                    <td>{item.title || '-'}</td>
                    <td>{formatNumber(item.image_count)}</td>
                    <td><span className={`readdy-chip ${statusChip(item.publish_status)}`}>{item.publish_status}</span></td>
                    <td>{formatNumber(item.view_count)}</td>
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
        title={editingId ? 'Chỉnh sửa chapter' : 'Thêm chapter'}
        footer={
          <>
            <button className="secondary-btn" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="teal-btn" disabled={saving} onClick={handleSave}>{saving ? 'Đang lưu...' : 'Lưu chapter'}</button>
          </>
        }
      >
        <div className="form-grid-two">
          <label>
            Truyện
            <select value={form.comic_id} onChange={(event) => setForm((prev) => ({ ...prev, comic_id: event.target.value }))}>
              <option value="">Chọn truyện</option>
              {comics.map((comic) => <option key={comic.id} value={comic.id}>{comic.title}</option>)}
            </select>
          </label>
          <label>
            Số chapter
            <input type="number" step="0.01" value={form.chapter_number} onChange={(event) => setForm((prev) => ({ ...prev, chapter_number: event.target.value, slug: prev.slug || slugify(`chapter-${event.target.value}`) }))} />
          </label>
          <label>
            Tiêu đề
            <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value, slug: prev.slug || slugify(event.target.value) }))} />
          </label>
          <label>
            Slug
            <input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))} />
          </label>
          <label>
            Access type
            <select value={form.access_type} onChange={(event) => setForm((prev) => ({ ...prev, access_type: event.target.value }))}>
              <option value="free">free</option>
              <option value="vip_required">vip_required</option>
              <option value="premium_required">premium_required</option>
            </select>
          </label>
          <label>
            Publish status
            <select value={form.publish_status} onChange={(event) => setForm((prev) => ({ ...prev, publish_status: event.target.value }))}>
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="hidden">hidden</option>
            </select>
          </label>
          <label className="form-span-2">
            Phát hành lúc
            <input type="datetime-local" value={form.released_at} onChange={(event) => setForm((prev) => ({ ...prev, released_at: event.target.value }))} />
          </label>
          <label className="form-span-2">
            Tóm tắt
            <textarea rows="3" value={form.summary} onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))} />
          </label>
          <label className="form-span-2">
            Danh sách ảnh (mỗi dòng 1 URL)
            <textarea rows="8" value={form.images_text} onChange={(event) => setForm((prev) => ({ ...prev, images_text: event.target.value }))} />
          </label>
        </div>
      </CrudModal>
    </div>
  );
}
