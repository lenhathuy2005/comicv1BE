import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { getAdminUser } from '../../services/auth';

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function pickData(result, fallback = []) {
  if (result.status !== 'fulfilled') return fallback;
  return result.value?.data ?? fallback;
}

function formatNumber(value) {
  const parsed = Number(value || 0);
  return parsed.toLocaleString('en-US');
}

function getRankingName(item) {
  return (
    item?.data?.displayName ||
    item?.data?.display_name ||
    item?.data?.username ||
    item?.data?.name ||
    item?.display_name ||
    item?.username ||
    item?.name ||
    `Entity #${item?.entityId || item?.entity_id || '-'}`
  );
}

function getRankingScore(item) {
  return Number(
    item?.scoreValue ??
      item?.score_value ??
      item?.data?.combatPower ??
      item?.data?.guildPower ??
      item?.data?.scoreValue ??
      0
  );
}

function getComicStatus(comic) {
  return comic?.publication_status || comic?.publicationStatus || 'draft';
}

export default function DashboardPage() {
  const adminUser = getAdminUser();
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [dashboard, setDashboard] = useState({
    users: [],
    comics: [],
    guilds: [],
    shopItems: [],
    vipLevels: [],
    rankingTypes: [],
    rankingPower: [],
    afkConfigs: [],
    chatRooms: [],
  });

  const loadDashboard = async () => {
    setLoading(true);
    setErrorText('');

    try {
      const results = await Promise.allSettled([
        apiRequest('/api/users'),
        apiRequest('/api/comics?limit=50'),
        apiRequest('/api/guilds'),
        apiRequest('/api/shop/admin/shop-items'),
        apiRequest('/api/vip/levels'),
        apiRequest('/api/rankings/types'),
        apiRequest('/api/rankings/power?limit=6'),
        apiRequest('/api/afk/configs'),
        apiRequest('/api/chat/rooms'),
      ]);

      setDashboard({
        users: toArray(pickData(results[0])),
        comics: toArray(pickData(results[1])),
        guilds: toArray(pickData(results[2])),
        shopItems: toArray(pickData(results[3])),
        vipLevels: toArray(pickData(results[4])),
        rankingTypes: toArray(pickData(results[5])),
        rankingPower: toArray(pickData(results[6])),
        afkConfigs: toArray(pickData(results[7])),
        chatRooms: toArray(pickData(results[8])),
      });
    } catch (error) {
      setErrorText(error.message || 'Không tải được dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = useMemo(
    () => [
      {
        label: 'Total Users',
        value: formatNumber(dashboard.users.length),
        foot: 'Tài khoản đang có trong hệ thống',
      },
      {
        label: 'Total Comics',
        value: formatNumber(dashboard.comics.length),
        foot: 'Tổng số đầu truyện đang quản lý',
      },
      {
        label: 'Active Guilds',
        value: formatNumber(dashboard.guilds.length),
        foot: 'Bang hội đang hoạt động',
      },
      {
        label: 'Shop Items',
        value: formatNumber(dashboard.shopItems.length),
        foot: 'SKU hiển thị ở shop admin',
      },
    ],
    [dashboard]
  );

  const rankingBars = useMemo(() => {
    const bars = dashboard.rankingPower.slice(0, 6).map((item, index) => ({
      id: item.id || index,
      name: getRankingName(item),
      shortName: getRankingName(item).slice(0, 12),
      score: getRankingScore(item),
    }));

    const maxScore = Math.max(...bars.map((item) => item.score), 1);

    return bars.map((item) => ({
      ...item,
      percent: Math.max(12, Math.round((item.score / maxScore) * 100)),
    }));
  }, [dashboard.rankingPower]);

  const recentUsers = useMemo(() => dashboard.users.slice(0, 6), [dashboard.users]);
  const recentComics = useMemo(() => dashboard.comics.slice(0, 6), [dashboard.comics]);
  const recentGuilds = useMemo(() => dashboard.guilds.slice(0, 5), [dashboard.guilds]);

  return (
    <div className="dashboard-page page-stack">
      <section className="dashboard-hero panel panel-hero">
        <div>
          <div className="hero-badge">Live dashboard</div>
          <h1>Xin chào {adminUser?.displayName || adminUser?.username || 'Admin'}</h1>
          <p className="hero-text">
            Đây là base admin đã được làm lại để giống phong cách dashboard hiện đại hơn,
            đồng thời vẫn bám đúng backend và database bạn đã gửi.
          </p>
        </div>

        <div className="hero-actions">
          <button className="secondary-btn" onClick={loadDashboard}>
            Refresh data
          </button>
          <div className="hero-meta-card">
            <span>Modules online</span>
            <strong>{dashboard.rankingTypes.length + dashboard.vipLevels.length + dashboard.afkConfigs.length}</strong>
          </div>
        </div>
      </section>

      {loading ? <div className="panel">Đang tải dữ liệu dashboard...</div> : null}
      {errorText ? <div className="error-box">{errorText}</div> : null}

      {!loading && !errorText ? (
        <>
          <section className="metric-grid">
            {stats.map((item) => (
              <div className="metric-card" key={item.label}>
                <div className="metric-top">
                  <div className="metric-label">{item.label}</div>
                  <div className="metric-dot" />
                </div>
                <div className="metric-value">{item.value}</div>
                <div className="metric-foot">{item.foot}</div>
              </div>
            ))}
          </section>

          <section className="content-grid-2 dashboard-main-grid">
            <div className="panel">
              <div className="panel-head-row">
                <div>
                  <h3 className="panel-title">Top power ranking</h3>
                  <p className="panel-subtitle">Tóm tắt lực chiến cao nhất hiện có</p>
                </div>
              </div>

              <div className="ranking-chart">
                {rankingBars.map((item) => (
                  <div className="ranking-bar-item" key={item.id}>
                    <div className="ranking-bar-top">
                      <span>{item.shortName}</span>
                      <strong>{formatNumber(item.score)}</strong>
                    </div>
                    <div className="ranking-bar-track">
                      <div className="ranking-bar-fill" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
                {rankingBars.length === 0 ? <div className="empty-state">Chưa có dữ liệu ranking</div> : null}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head-row">
                <div>
                  <h3 className="panel-title">System overview</h3>
                  <p className="panel-subtitle">Các nhóm dữ liệu đang có thể đọc từ API</p>
                </div>
              </div>

              <div className="summary-grid">
                <div className="summary-item">
                  <span>VIP levels</span>
                  <strong>{dashboard.vipLevels.length}</strong>
                </div>
                <div className="summary-item">
                  <span>Ranking types</span>
                  <strong>{dashboard.rankingTypes.length}</strong>
                </div>
                <div className="summary-item">
                  <span>AFK configs</span>
                  <strong>{dashboard.afkConfigs.length}</strong>
                </div>
                <div className="summary-item">
                  <span>Chat rooms</span>
                  <strong>{dashboard.chatRooms.length}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="content-grid-2">
            <div className="panel">
              <div className="panel-head-row">
                <div>
                  <h3 className="panel-title">Recent users</h3>
                  <p className="panel-subtitle">Danh sách tài khoản mới nhất</p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((user) => {
                      const status = user.account_status || 'default';

                      return (
                        <tr key={user.id}>
                          <td>{user.id}</td>
                          <td>{user.username}</td>
                          <td>{user.email}</td>
                          <td>
                            <span className={`status-badge status-${status}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {recentUsers.length === 0 ? (
                      <tr>
                        <td colSpan="4">Không có dữ liệu user</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head-row">
                <div>
                  <h3 className="panel-title">Recent comics</h3>
                  <p className="panel-subtitle">Tổng hợp trạng thái truyện gần đây</p>
                </div>
              </div>

              <div className="comic-list">
                {recentComics.map((comic) => (
                  <div className="comic-list-item" key={comic.id}>
                    <div>
                      <div className="comic-title">{comic.title}</div>
                                          </div>
                    <span className={`status-badge status-${getComicStatus(comic)}`}>
                      {getComicStatus(comic)}
                    </span>
                  </div>
                ))}
                {recentComics.length === 0 ? <div className="empty-state">Không có dữ liệu truyện</div> : null}
              </div>
            </div>
          </section>

          <section className="content-grid-2">
            <div className="panel">
              <div className="panel-head-row">
                <div>
                  <h3 className="panel-title">Guild snapshot</h3>
                  <p className="panel-subtitle">Tổng quan bang hội đang active</p>
                </div>
              </div>

              <div className="guild-stack">
                {recentGuilds.map((guild) => (
                  <div className="guild-row" key={guild.id}>
                    <div>
                      <div className="guild-name">{guild.name}</div>
                      <div className="guild-meta">Leader: {guild.leader_name || '-'}</div>
                    </div>
                    <div className="guild-right">
                      <strong>Lv.{guild.level || 0}</strong>
                      <span>{formatNumber(guild.guild_power || 0)} power</span>
                    </div>
                  </div>
                ))}
                {recentGuilds.length === 0 ? <div className="empty-state">Không có dữ liệu guild</div> : null}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head-row">
                <div>
                  <h3 className="panel-title">What is ready now</h3>
                  <p className="panel-subtitle">Những phần đang dùng được ngay trên base admin</p>
                </div>
              </div>

              <ul className="feature-list">
                <li>Sidebar + topbar + dashboard card theo style thống nhất</li>
                <li>Đăng nhập admin bằng token hiện tại</li>
                <li>Nối live API cho Users, Comics, Guilds, Shop</li>
                <li>Trang Dashboard đọc dữ liệu từ Rankings, VIP, AFK, Chat</li>
                <li>Có sẵn route để mở rộng tiếp VIP, Rankings, Chat, Notifications, AFK</li>
              </ul>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
