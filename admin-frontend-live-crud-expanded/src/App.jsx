import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import UsersPage from './pages/admin/UsersPage';
import ComicsPage from './pages/admin/ComicsPage';
import GuildsPage from './pages/admin/GuildsPage';
import ShopPage from './pages/admin/ShopPage';
import ChaptersPage from './pages/admin/ChaptersPage';
import VipPage from './pages/admin/VipPage';
import RankingsPage from './pages/admin/RankingsPage';
import CategoriesPage from './pages/admin/CategoriesPage';
import CommentsPage from './pages/admin/CommentsPage';
import RealmsPage from './pages/admin/RealmsPage';
import QuestsPage from './pages/admin/QuestsPage';
import AfkPage from './pages/admin/AfkPage';
import ItemsPage from './pages/admin/ItemsPage';
import TransactionsPage from './pages/admin/TransactionsPage';
import ChatPage from './pages/admin/ChatPage';
import NotificationsPage from './pages/admin/NotificationsPage';

function ProtectedAdminRoute({ children }) {
  const token = localStorage.getItem('admin_access_token');
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="comics" element={<ComicsPage />} />
        <Route path="chapters" element={<ChaptersPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="genres" element={<Navigate to="/admin/categories" replace />} />
        <Route path="comments" element={<CommentsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="vip" element={<VipPage />} />
        <Route path="guilds" element={<GuildsPage />} />
        <Route path="realms" element={<RealmsPage />} />
        <Route path="quests" element={<QuestsPage />} />
        <Route path="missions" element={<Navigate to="/admin/quests" replace />} />
        <Route path="afk" element={<AfkPage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="rankings" element={<RankingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}
