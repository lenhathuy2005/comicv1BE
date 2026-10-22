import PageTitleBar from '../../components/PageTitleBar';

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="readdy-page">
      <PageTitleBar title={title} description={description} action={<button className="teal-btn">+ Tạo mới</button>} />
      <div className="empty-card">
        <div className="empty-icon">◎</div>
        <div className="empty-title">Module đang chờ nối API thật</div>
        <p className="empty-description">Khung giao diện, route, sidebar và action button đã được dựng theo cùng style admin. Phần tiếp theo là nối endpoint thật cho module này.</p>
      </div>
    </div>
  );
}
