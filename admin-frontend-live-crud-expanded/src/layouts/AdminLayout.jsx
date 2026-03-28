import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAdminAuth, getAdminUser } from '../services/auth';

const navSections = [
  {
    title: 'TỔNG QUAN',
    items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: '◫' }],
  },
  {
    title: 'QUẢN LÝ NỘI DUNG',
    items: [
      { label: 'Truyện tranh', to: '/admin/comics', icon: '▣' },
      { label: 'Chapter', to: '/admin/chapters', icon: '≣' },
      { label: 'Thể loại', to: '/admin/categories', icon: '◇' },
      { label: 'Bình luận', to: '/admin/comments', icon: '◌' },
    ],
  },
  {
    title: 'QUẢN LÝ NGƯỜI DÙNG',
    items: [
      { label: 'Người dùng', to: '/admin/users', icon: '◎' },
      { label: 'VIP', to: '/admin/vip', icon: '✦' },
      { label: 'Bang phái', to: '/admin/guilds', icon: '◍' },
    ],
  },
  {
    title: 'HỆ THỐNG TU LUYỆN',
    items: [
      { label: 'Cảnh giới', to: '/admin/realms', icon: '◈' },
      { label: 'Nhiệm vụ', to: '/admin/quests', icon: '☑' },
      { label: 'AFK', to: '/admin/afk', icon: '◷' },
      { label: 'BXH', to: '/admin/rankings', icon: '♛' },
    ],
  },
  {
    title: 'THƯƠNG MẠI',
    items: [
      { label: 'Shop', to: '/admin/shop', icon: '⌂' },
      { label: 'Vật phẩm', to: '/admin/items', icon: '⬡' },
      { label: 'Giao dịch', to: '/admin/transactions', icon: '⊖' },
    ],
  },
  {
    title: 'CỘNG ĐỒNG',
    items: [
      { label: 'Chat', to: '/admin/chat', icon: '▣' },
      { label: 'Thông báo', to: '/admin/notifications', icon: '◔' },
    ],
  },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const adminUser = getAdminUser();
  const initials =
    adminUser?.displayName?.slice(0, 1)?.toUpperCase() ||
    adminUser?.username?.slice(0, 1)?.toUpperCase() ||
    'A';

  const handleLogout = () => {
    clearAdminAuth();
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell readdy-shell">
      <aside className="sidebar readdy-sidebar">
        <div className="brand readdy-brand">
          <div className="brand-art">✦</div>
          <div className="brand-copy">
            <span className="brand-title">Admin Panel</span>
          </div>
        </div>

        <div className="sidebar-scrollable">
          {navSections.map((section) => (
            <div key={section.title} className="sidebar-section">
              <div className="sidebar-group-title">{section.title}</div>
              <nav className="sidebar-nav">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <Link key={item.to} to={item.to} className={isActive ? 'nav-link active' : 'nav-link'}>
                      <span className="nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="sidebar-bottom-arrow">‹</div>
      </aside>

      <div className="main-shell readdy-main-shell">
        <header className="topbar readdy-topbar">
          <div className="readdy-topbar-left">
            <button className="menu-ghost" type="button">☰</button>
            <div className="readdy-search-input topbar-search-wrap">
              <span>⌕</span>
              <input className="topbar-search" type="text" placeholder="Tìm kiếm..." readOnly />
            </div>
          </div>

          <div className="topbar-right readdy-topbar-right">
            <button className="topbar-icon-btn" type="button">◔</button>
            <button className="topbar-icon-btn" type="button">✉</button>
            <div className="topbar-profile-card">
              <div className="avatar-chip readdy-avatar-chip">{initials}</div>
              <div>
                <div className="topbar-profile-name">{adminUser?.displayName || adminUser?.username || 'Admin User'}</div>
                <div className="topbar-profile-role">Quản trị viên</div>
              </div>
            </div>
            <button className="topbar-icon-btn ghost-plus" type="button" onClick={handleLogout}>＋</button>
          </div>
        </header>
        <main className="main-content readdy-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
