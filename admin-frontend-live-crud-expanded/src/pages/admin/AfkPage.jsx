import { useEffect, useMemo, useState } from 'react';
import CrudModal from '../../components/CrudModal';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatDateTime, formatNumber } from '../../utils/adminHelpers';

const emptyConfig = {
  config_key: '',
  config_value: '',
  value_type: 'string',
  description: '',
};

const recommendedConfigs = [
  {
    config_key: 'afk_enabled',
    config_value: 'true',
    value_type: 'bool',
    description: 'Bật hoặc tắt toàn bộ hệ thống AFK',
  },
  {
    config_key: 'afk_exp_per_minute',
    config_value: '10',
    value_type: 'decimal',
    description: 'EXP cơ bản nhận được mỗi phút AFK',
  },
  {
    config_key: 'afk_gold_per_minute',
    config_value: '2',
    value_type: 'decimal',
    description: 'Vàng cơ bản nhận được mỗi phút AFK',
  },
  {
    config_key: 'afk_bonus_percent',
    config_value: '0',
    value_type: 'decimal',
    description: 'Phần trăm thưởng cộng thêm chung cho AFK',
  },
  {
    config_key: 'afk_vip_bonus_percent',
    config_value: '20',
    value_type: 'decimal',
    description: 'Phần trăm thưởng cộng thêm cho tài khoản VIP',
  },
  {
    config_key: 'afk_min_minutes_to_claim',
    config_value: '1',
    value_type: 'int',
    description: 'Số phút tối thiểu cần AFK để được nhận thưởng',
  },
  {
    config_key: 'afk_max_minutes_per_session',
    config_value: '480',
    value_type: 'int',
    description: 'Số phút tối đa được tính thưởng trong một phiên AFK',
  },
  {
    config_key: 'afk_daily_max_minutes',
    config_value: '720',
    value_type: 'int',
    description: 'Tổng số phút AFK tối đa được tính thưởng mỗi ngày',
  },
  {
    config_key: 'afk_banner_image_url',
    config_value: '/uploads/afk/afk-banner.png',
    value_type: 'string',
    description: 'Ảnh banner hiển thị ở màn AFK trên mobile. Có thể dùng URL đầy đủ hoặc đường dẫn /uploads/...',
  },
];

const configLabelMap = {
  afk_enabled: 'Trạng thái AFK',
  afk_exp_per_minute: 'EXP / phút',
  afk_gold_per_minute: 'Vàng / phút',
  afk_bonus_percent: 'Bonus chung',
  afk_vip_bonus_percent: 'Bonus VIP',
  afk_min_minutes_to_claim: 'Phút tối thiểu',
  afk_max_minutes_per_session: 'Giới hạn phiên',
  afk_daily_max_minutes: 'Giới hạn ngày',
  afk_banner_image_url: 'Ảnh AFK',
};

function getConfigDisplayName(key) {
  return configLabelMap[key] || key;
}

function getStatusClass(value) {
  if (value === 'running') return 'status-pill active';
  if (value === 'finished') return 'status-pill pending';
  if (value === 'cancelled') return 'status-pill danger';
  return 'status-pill muted';
}

function getClaimClass(value) {
  if (value === 'claimed') return 'status-pill active';
  if (value === 'pending') return 'status-pill pending';
  if (value === 'expired') return 'status-pill danger';
  return 'status-pill muted';
}

export default function AfkPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [tab, setTab] = useState('Cấu hình AFK');
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState({
    overview: {},
    configs: [],
    sessions: [],
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyConfig);

  const loadData = async () => {
    setLoading(true);
    setErrorText('');

    try {
      const result = await apiRequest('/api/admin/afk');

      setData({
        overview: result?.data?.overview || {},
        configs: result?.data?.configs || [],
        sessions: result?.data?.sessions || [],
      });
    } catch (error) {
      setErrorText(error.message || 'Không tải được AFK');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const configsByKey = useMemo(() => {
    const map = {};

    for (const item of data.configs) {
      map[item.config_key] = item;
    }

    return map;
  }, [data.configs]);

  const missingRecommendedConfigs = useMemo(() => {
    return recommendedConfigs.filter(
      (item) => !configsByKey[item.config_key]
    );
  }, [configsByKey]);

  const filteredConfigs = useMemo(() => {
    const text = keyword.trim().toLowerCase();

    if (!text) return data.configs;

    return data.configs.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(text)
    );
  }, [data.configs, keyword]);

  const filteredSessions = useMemo(() => {
    const text = keyword.trim().toLowerCase();

    if (!text) return data.sessions;

    return data.sessions.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(text)
    );
  }, [data.sessions, keyword]);

  const statCards = [
    {
      label: 'Tổng cấu hình',
      value: formatNumber(data.overview.totalConfigs),
      icon: '⚙',
      tone: 'mint',
    },
    {
      label: 'Phiên đang chạy',
      value: formatNumber(data.overview.runningSessions),
      icon: '▶',
      tone: 'green',
    },
    {
      label: 'EXP phát hôm nay',
      value: formatNumber(data.overview.claimedExpToday),
      icon: '✨',
      tone: 'purple',
    },
    {
      label: 'Vàng phát hôm nay',
      value: formatNumber(data.overview.claimedGoldToday),
      icon: '🪙',
      tone: 'gold',
    },
  ];

  const afkEnabledConfig = configsByKey.afk_enabled;
  const afkEnabled =
    afkEnabledConfig?.config_value === 'true' ||
    afkEnabledConfig?.config_value === '1';

  const quickStats = [
    {
      label: 'User đang AFK',
      value: formatNumber(data.overview.usersAfk),
      icon: '👤',
    },
    {
      label: 'Chờ claim',
      value: formatNumber(data.overview.pendingClaims),
      icon: '🎁',
    },
    {
      label: 'Giờ AFK hôm nay',
      value: formatNumber(
        Math.round(Number(data.overview.totalHoursToday || 0))
      ),
      icon: '⏰',
    },
    {
      label: 'Lượt claim hôm nay',
      value: formatNumber(data.overview.totalClaimsToday),
      icon: '📦',
    },
  ];

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyConfig);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      config_key: item.config_key,
      config_value: item.config_value,
      value_type: item.value_type,
      description: item.description || '',
    });
    setModalOpen(true);
  };

  const saveConfig = async () => {
    if (!form.config_key.trim()) {
      alert('Vui lòng nhập config key');
      return;
    }

    if (form.config_value === undefined || form.config_value === '') {
      alert('Vui lòng nhập config value');
      return;
    }

    setSaving(true);

    try {
      if (editingItem) {
        await apiRequest(`/api/admin/afk/configs/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest('/api/admin/afk/configs', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }

      setModalOpen(false);
      await loadData();
    } catch (error) {
      alert(error.message || 'Lưu cấu hình AFK thất bại');
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (item) => {
    if (!window.confirm(`Xóa cấu hình ${item.config_key}?`)) return;

    try {
      await apiRequest(`/api/admin/afk/configs/${item.id}`, {
        method: 'DELETE',
      });

      await loadData();
    } catch (error) {
      alert(error.message || 'Xóa cấu hình AFK thất bại');
    }
  };

  const createRecommendedConfigSet = async () => {
    if (missingRecommendedConfigs.length === 0) {
      alert('Bộ cấu hình chuẩn đã đầy đủ');
      return;
    }

    setCreatingPreset(true);

    try {
      for (const config of missingRecommendedConfigs) {
        await apiRequest('/api/admin/afk/configs', {
          method: 'POST',
          body: JSON.stringify(config),
        });
      }

      await loadData();
      alert('Đã thêm bộ cấu hình AFK chuẩn');
    } catch (error) {
      alert(error.message || 'Không tạo được bộ cấu hình AFK chuẩn');
    } finally {
      setCreatingPreset(false);
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar
        title="Quản lý AFK"
        description="Theo dõi phiên tu luyện ngoại tuyến, phần thưởng và cấu hình vận hành"
        action={
          tab === 'Cấu hình AFK' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="secondary-btn"
                onClick={createRecommendedConfigSet}
                disabled={creatingPreset}
              >
                {creatingPreset
                  ? 'Đang tạo...'
                  : `⚡ Tạo cấu hình chuẩn ${
                      missingRecommendedConfigs.length > 0
                        ? `(${missingRecommendedConfigs.length})`
                        : ''
                    }`}
              </button>

              <button className="teal-btn" onClick={openCreate}>
                + Thêm cấu hình
              </button>
            </div>
          ) : null
        }
      />

      <StatCardsRow items={statCards} />

      <div
        className="panel"
        style={{
          marginBottom: 20,
          padding: 22,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            borderRadius: 22,
            padding: 20,
            background:
              'linear-gradient(135deg, rgba(13,148,136,0.16), rgba(59,130,246,0.10))',
            border: '1px solid rgba(13,148,136,0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                display: 'grid',
                placeItems: 'center',
                fontSize: 28,
                background: 'rgba(13,148,136,0.16)',
              }}
            >
              🧘
            </div>

            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 22,
                  color: '#0f172a',
                }}
              >
                Trung tâm AFK
              </div>
              <div style={{ color: '#64748b', marginTop: 4 }}>
                Kiểm soát trạng thái, thưởng và giới hạn tu luyện ngoại tuyến
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                fontWeight: 800,
                background: afkEnabled
                  ? 'rgba(34,197,94,0.14)'
                  : 'rgba(239,68,68,0.14)',
                color: afkEnabled ? '#15803d' : '#dc2626',
              }}
            >
              {afkEnabled ? '● AFK đang bật' : '● AFK đang tắt'}
            </span>

            <span
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                fontWeight: 800,
                background: 'rgba(59,130,246,0.12)',
                color: '#2563eb',
              }}
            >
              EXP/phút:{' '}
              {configsByKey.afk_exp_per_minute?.config_value || '-'}
            </span>

            <span
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                fontWeight: 800,
                background: 'rgba(245,158,11,0.14)',
                color: '#d97706',
              }}
            >
              Vàng/phút:{' '}
              {configsByKey.afk_gold_per_minute?.config_value || '-'}
            </span>

            <span
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                fontWeight: 800,
                background: 'rgba(168,85,247,0.14)',
                color: '#7e22ce',
              }}
            >
              Bonus VIP:{' '}
              {configsByKey.afk_vip_bonus_percent?.config_value || '0'}%
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          {quickStats.map((item) => (
            <div
              key={item.label}
              style={{
                borderRadius: 18,
                padding: 16,
                background: '#fff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 12px 24px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{ fontSize: 22 }}>{item.icon}</div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#0f172a',
                  marginTop: 8,
                }}
              >
                {item.value}
              </div>
              <div
                style={{
                  color: '#64748b',
                  marginTop: 4,
                  fontWeight: 700,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel readdy-tabs-panel">
        <div className="readdy-tabs is-three">
          {['Cấu hình AFK', 'Phiên AFK', 'Thống kê'].map((label) => (
            <button
              key={label}
              className={tab === label ? 'readdy-tab active' : 'readdy-tab'}
              onClick={() => setTab(label)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="readdy-toolbar">
          <div className="readdy-search-input is-wide">
            <span>⌕</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={
                tab === 'Cấu hình AFK'
                  ? 'Tìm cấu hình...'
                  : 'Tìm user, trạng thái, log...'
              }
            />
          </div>
        </div>

        {errorText ? (
          <div className="empty-card">
            <div className="empty-title">{errorText}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="empty-card">
            <div className="empty-title">Đang tải dữ liệu AFK...</div>
          </div>
        ) : null}

        {!loading && tab === 'Cấu hình AFK' ? (
          filteredConfigs.length === 0 ? (
            <EmptyState
              title="Chưa có cấu hình AFK"
              description="Hãy tạo bộ cấu hình chuẩn để hệ thống vận hành đầy đủ."
              action={
                <button
                  className="teal-btn"
                  onClick={createRecommendedConfigSet}
                >
                  Tạo cấu hình chuẩn
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="readdy-table">
                <thead>
                  <tr>
                    <th>Cấu hình</th>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Type</th>
                    <th>Mô tả</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredConfigs.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 900 }}>
                        {getConfigDisplayName(item.config_key)}
                      </td>
                      <td>{item.config_key}</td>
                      <td>{item.config_value}</td>
                      <td>{item.value_type}</td>
                      <td>{item.description || '-'}</td>
                      <td>
                        <div className="readdy-actions-inline">
                          <button
                            className="icon-btn teal"
                            onClick={() => openEdit(item)}
                          >
                            ✎
                          </button>

                          <button
                            className="icon-btn red"
                            onClick={() => deleteConfig(item)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {!loading && tab === 'Phiên AFK' ? (
          filteredSessions.length === 0 ? (
            <EmptyState
              title="Chưa có phiên AFK"
              description="Khi user bắt đầu AFK, dữ liệu sẽ xuất hiện tại đây."
            />
          ) : (
            <div className="table-wrap">
              <table className="readdy-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Bắt đầu</th>
                    <th>Kết thúc</th>
                    <th>Thời lượng</th>
                    <th>EXP</th>
                    <th>Vàng</th>
                    <th>Claim</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSessions.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 900 }}>
                          {item.user_name || item.username || '-'}
                        </div>
                        <div style={{ color: '#64748b', marginTop: 3 }}>
                          ID user: {item.user_id}
                        </div>
                      </td>
                      <td>{formatDateTime(item.started_at)}</td>
                      <td>{formatDateTime(item.ended_at)}</td>
                      <td>
                        {formatNumber(item.duration_seconds || 0)}
                        s
                      </td>
                      <td>{formatNumber(item.total_exp_earned || 0)}</td>
                      <td>{formatNumber(item.total_gold_earned || 0)}</td>
                      <td>
                        <span className={getClaimClass(item.claim_status)}>
                          {item.claim_status}
                        </span>
                      </td>
                      <td>
                        <span className={getStatusClass(item.session_status)}>
                          {item.session_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {!loading && tab === 'Thống kê' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 18,
              padding: 18,
            }}
          >
            <div
              style={{
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                background: '#fff',
                padding: 20,
              }}
            >
              <h3 style={{ marginTop: 0 }}>Tóm tắt vận hành</h3>

              <p>
                Hệ thống hiện có{' '}
                <b>{formatNumber(data.overview.totalConfigs)}</b> cấu hình,
                <b> {formatNumber(data.overview.runningSessions)}</b> phiên
                đang chạy và{' '}
                <b>{formatNumber(data.overview.usersAfk)}</b> user đang AFK.
              </p>

              <p>
                Số phiên chờ nhận thưởng:{' '}
                <b>{formatNumber(data.overview.pendingClaims)}</b>.
              </p>
            </div>

            <div
              style={{
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                background: '#fff',
                padding: 20,
              }}
            >
              <h3 style={{ marginTop: 0 }}>Thưởng hôm nay</h3>

              <p>
                EXP đã phát:{' '}
                <b>{formatNumber(data.overview.claimedExpToday)}</b>
              </p>

              <p>
                Vàng đã phát:{' '}
                <b>{formatNumber(data.overview.claimedGoldToday)}</b>
              </p>

              <p>
                Tổng lượt claim:{' '}
                <b>{formatNumber(data.overview.totalClaimsToday)}</b>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <CrudModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? 'Chỉnh sửa cấu hình AFK'
            : 'Thêm cấu hình AFK'
        }
        footer={
          <>
            <button
              className="secondary-btn"
              onClick={() => setModalOpen(false)}
            >
              Hủy
            </button>

            <button
              className="teal-btn"
              disabled={saving}
              onClick={saveConfig}
            >
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </>
        }
      >
        <div className="form-grid-two">
          <label>
            Config key
            <input
              value={form.config_key}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  config_key: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Value type
            <select
              value={form.value_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  value_type: event.target.value,
                }))
              }
            >
              <option value="string">string</option>
              <option value="int">int</option>
              <option value="decimal">decimal</option>
              <option value="json">json</option>
              <option value="bool">bool</option>
            </select>
          </label>

          <label className="form-span-2">
            Config value
            <input
              value={form.config_value}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  config_value: event.target.value,
                }))
              }
            />
          </label>

          <label className="form-span-2">
            Mô tả
            <textarea
              rows="4"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </label>
        </div>
      </CrudModal>
    </div>
  );
}