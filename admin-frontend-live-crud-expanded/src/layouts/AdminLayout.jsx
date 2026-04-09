import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  PanelsTopLeft,
  Tags,
  MessageCircle,
  Users,
  Crown,
  Shield,
  Sparkles,
  ScrollText,
  TimerReset,
  Trophy,
  ShoppingBag,
  Package,
  ReceiptText,
  MessagesSquare,
  Bell,
  Search,
  Menu,
  LogOut,
  ChevronLeft,
  Star,
} from 'lucide-react';
import { clearAdminAuth, getAdminUser } from '../services/auth';

const navSections = [
  {
    title: 'TỔNG QUAN',
    items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'QUẢN LÝ NỘI DUNG',
    items: [
      { label: 'Truyện tranh', to: '/admin/comics', icon: BookOpen },
      { label: 'Chapter', to: '/admin/chapters', icon: PanelsTopLeft },
      { label: 'Thể loại', to: '/admin/categories', icon: Tags },
      { label: 'Bình luận', to: '/admin/comments', icon: MessageCircle },
    ],
  },
  {
    title: 'QUẢN LÝ NGƯỜI DÙNG',
    items: [
      { label: 'Người dùng', to: '/admin/users', icon: Users },
      { label: 'VIP', to: '/admin/vip', icon: Crown },
      { label: 'Bang phái', to: '/admin/guilds', icon: Shield },
    ],
  },
  {
    title: 'HỆ THỐNG TU LUYỆN',
    items: [
      { label: 'Cảnh giới', to: '/admin/realms', icon: Sparkles },
      { label: 'Nhiệm vụ', to: '/admin/quests', icon: ScrollText },
      { label: 'AFK', to: '/admin/afk', icon: TimerReset },
      { label: 'BXH', to: '/admin/rankings', icon: Trophy },
    ],
  },
  {
    title: 'THƯƠNG MẠI',
    items: [
      { label: 'Shop', to: '/admin/shop', icon: ShoppingBag },
      { label: 'Vật phẩm', to: '/admin/items', icon: Package },
      { label: 'Giao dịch', to: '/admin/transactions', icon: ReceiptText },
    ],
  },
  {
    title: 'CỘNG ĐỒNG',
    items: [
      { label: 'Chat', to: '/admin/chat', icon: MessagesSquare },
      { label: 'Thông báo', to: '/admin/notifications', icon: Bell },
    ],
  },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const adminUser = getAdminUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials =
    adminUser?.displayName?.slice(0, 1)?.toUpperCase() ||
    adminUser?.username?.slice(0, 1)?.toUpperCase() ||
    'A';

  const handleLogout = () => {
    clearAdminAuth();
    navigate('/admin/login');
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 992) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <style>{`
        .admin-shell {
          display: flex;
          min-height: 100vh;
          width: 100%;
          max-width: 100%;
          align-items: flex-start;
          background: #f4f7fb;
        }

        .readdy-sidebar {
          flex: 0 0 280px;
          width: 280px;
          min-width: 280px;
          max-width: 280px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(circle at top left, rgba(45, 212, 191, 0.18), transparent 28%),
            linear-gradient(180deg, #071226 0%, #08101f 48%, #091427 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          z-index: 1200;
        }

        .sidebar-scrollable {
          flex: 1;
          overflow-y: auto;
          padding-bottom: 18px;
        }

        .sidebar-scrollable::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar-scrollable::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.14);
          border-radius: 999px;
        }

        .readdy-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 22px 20px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #4f8cff, #6d5dfc);
          color: #fff;
          box-shadow: 0 10px 24px rgba(79, 140, 255, 0.32);
        }

        .brand-title {
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.01em;
        }

        .sidebar-section {
          padding: 16px 14px 0;
        }

        .sidebar-group-title {
          padding: 0 10px 10px;
          color: rgba(226, 232, 240, 0.62);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 46px;
          padding: 0 14px;
          border-radius: 14px;
          color: #d7dfec;
          text-decoration: none;
          transition: all 0.22s ease;
        }

        .nav-link:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }

        .nav-link.active {
          background: linear-gradient(90deg, #21c7b7 0%, #21c7b7 100%);
          color: #ffffff;
          box-shadow: 0 10px 24px rgba(33, 199, 183, 0.18);
        }

        .nav-icon {
          width: 18px;
          height: 18px;
          flex: 0 0 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .nav-link span:last-child {
          font-size: 15px;
          font-weight: 700;
        }

        .sidebar-footer {
          padding: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .sidebar-bottom-arrow {
          width: 100%;
          height: 42px;
          border: 0;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          color: #dbe7ff;
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .readdy-main-shell {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .readdy-topbar {
          position: sticky;
          top: 0;
          z-index: 900;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 22px;
          background: rgba(244, 247, 251, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(15, 23, 42, 0.06);
        }

        .readdy-topbar-left,
        .readdy-topbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .menu-ghost,
        .topbar-icon-btn {
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 12px;
          background: #ffffff;
          color: #0f172a;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
        }

        .menu-ghost {
          display: none;
        }

        .topbar-search-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 280px;
          width: 360px;
          height: 42px;
          padding: 0 14px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .topbar-search-wrap svg {
          color: #64748b;
        }

        .topbar-search {
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          color: #0f172a;
        }

        .topbar-profile-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 10px 6px 6px;
          background: #ffffff;
          border-radius: 14px;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
        }

        .avatar-chip {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #4f8cff, #6d5dfc);
          color: #fff;
          font-weight: 800;
        }

        .topbar-profile-name {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }

        .topbar-profile-role {
          font-size: 12px;
          color: #64748b;
        }

        .readdy-main-content {
          min-width: 0;
          padding: 22px;
        }

        .admin-mobile-overlay {
          display: none;
        }

        @media (max-width: 992px) {
          .admin-mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, 0.55);
            opacity: 0;
            pointer-events: none;
            transition: 0.25s ease;
            z-index: 1100;
          }

          .admin-mobile-overlay.show {
            opacity: 1;
            pointer-events: auto;
          }

          .readdy-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            transform: translateX(-100%);
            transition: transform 0.26s ease;
            box-shadow: none;
          }

          .readdy-sidebar.sidebar-open {
            transform: translateX(0);
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
          }

          .menu-ghost {
            display: inline-flex;
          }

          .sidebar-bottom-arrow {
            display: inline-flex;
          }

          .topbar-search-wrap {
            min-width: 0;
            width: 100%;
          }

          .readdy-topbar {
            flex-wrap: wrap;
          }

          .readdy-topbar-left,
          .readdy-topbar-right {
            width: 100%;
            justify-content: space-between;
          }
        }

        @media (max-width: 640px) {
          .readdy-main-content {
            padding: 14px;
          }

          .readdy-topbar {
            padding: 14px;
          }

          .readdy-sidebar {
            width: min(86vw, 320px);
            min-width: min(86vw, 320px);
            max-width: min(86vw, 320px);
          }
        }
      `}</style>

      <div
        className={sidebarOpen ? 'admin-mobile-overlay show' : 'admin-mobile-overlay'}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="admin-shell readdy-shell">
        <aside className={`sidebar readdy-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="brand readdy-brand">
            <div className="brand-mark">
              <Star size={18} />
            </div>
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
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={isActive ? 'nav-link active' : 'nav-link'}
                      >
                        <span className="nav-icon">
                          <Icon size={17} />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <button
              className="sidebar-bottom-arrow"
              type="button"
              onClick={() => setSidebarOpen(false)}
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </aside>

        <div className="main-shell readdy-main-shell">
          <header className="topbar readdy-topbar">
            <div className="readdy-topbar-left">
              <button
                className="menu-ghost"
                type="button"
                onClick={() => setSidebarOpen((prev) => !prev)}
              >
                <Menu size={18} />
              </button>

              <div className="readdy-search-input topbar-search-wrap">
                <Search size={16} />
                <input className="topbar-search" type="text" placeholder="Tìm kiếm..." readOnly />
              </div>
            </div>

            <div className="topbar-right readdy-topbar-right">
              <button className="topbar-icon-btn" type="button">
                <Bell size={17} />
              </button>

              <div className="topbar-profile-card">
                <div className="avatar-chip">{initials}</div>
                <div>
                  <div className="topbar-profile-name">
                    {adminUser?.displayName || adminUser?.username || 'Admin User'}
                  </div>
                  <div className="topbar-profile-role">Quản trị viên</div>
                </div>
              </div>

              <button className="topbar-icon-btn" type="button" onClick={handleLogout}>
                <LogOut size={17} />
              </button>
            </div>
          </header>

          <main className="main-content readdy-main-content">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}