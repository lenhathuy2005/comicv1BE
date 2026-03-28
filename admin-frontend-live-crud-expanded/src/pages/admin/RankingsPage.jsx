import { useEffect, useState } from 'react';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatNumber } from '../../utils/adminHelpers';

export default function RankingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [type, setType] = useState('power');
  const [overview, setOverview] = useState({ types: [], latestSnapshots: [] });
  const [items, setItems] = useState([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorText('');
      try {
        const [overviewRes, rankingRes] = await Promise.all([
          apiRequest('/api/admin/rankings'),
          apiRequest(`/api/admin/rankings/${type}?limit=50`),
        ]);
        setOverview({
          types: overviewRes?.data?.types || [],
          latestSnapshots: overviewRes?.data?.latestSnapshots || [],
        });
        setItems(rankingRes?.data || []);
      } catch (error) {
        setErrorText(error.message || 'Không tải được bảng xếp hạng');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [type]);

  const statCards = [
    { label: 'Loại ranking', value: formatNumber(overview.types.length), icon: '🏆', tone: 'gold' },
    { label: 'Dòng dữ liệu hiện tại', value: formatNumber(items.length), icon: '📊', tone: 'mint' },
    { label: 'Snapshot gần đây', value: formatNumber(overview.latestSnapshots.length), icon: '🗂', tone: 'purple' },
  ];

  const createSnapshot = async () => {
    setSaving(true);
    try {
      await apiRequest(`/api/admin/rankings/${type}/snapshot`, {
        method: 'POST',
        body: JSON.stringify({ limit: 100 }),
      });
      setType((prev) => `${prev}`);
      const [overviewRes, rankingRes] = await Promise.all([
        apiRequest('/api/admin/rankings'),
        apiRequest(`/api/admin/rankings/${type}?limit=50`),
      ]);
      setOverview({ types: overviewRes?.data?.types || [], latestSnapshots: overviewRes?.data?.latestSnapshots || [] });
      setItems(rankingRes?.data || []);
    } catch (error) {
      alert(error.message || 'Tạo snapshot thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="readdy-page">
      <PageTitleBar
        title="Quản lý Bảng xếp hạng"
        description="Theo dõi và tạo snapshot ranking bằng dữ liệu thật"
        action={<button className="teal-btn" disabled={saving} onClick={createSnapshot}>{saving ? 'Đang tạo...' : '+ Tạo snapshot'}</button>}
      />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-tabs-panel">
        <div className="readdy-tabs is-three">
          {[['power', 'Lực chiến'], ['level', 'Level'], ['vip', 'VIP'], ['guild_power', 'Bang hội']].map(([value, label]) => (
            <button key={value} className={type === value ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setType(value)}>{label}</button>
          ))}
        </div>
        {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
        {loading ? <div className="empty-card"><div className="empty-title">Đang tải bảng xếp hạng...</div></div> : null}
        {!loading && items.length === 0 ? <EmptyState title="Chưa có dữ liệu ranking" description="Tạo snapshot hoặc chờ có dữ liệu hệ thống." action={<button className="teal-btn" onClick={createSnapshot}>Tạo snapshot</button>} /> : null}
        {!loading && items.length > 0 ? (
          <div className="table-wrap">
            <table className="readdy-table">
              <thead>
                <tr><th>Hạng</th><th>Đối tượng</th><th>Điểm</th><th>Thông tin thêm</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.entity_id}-${item.rank_position}`}>
                    <td>#{item.rank_position}</td>
                    <td>{item.name}</td>
                    <td>{formatNumber(item.score_value)}</td>
                    <td>{item.realm_name || item.level_number || item.leader_name || item.vip_exp || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Snapshot gần đây</h3>
        {overview.latestSnapshots.length === 0 ? <p>Chưa có snapshot nào.</p> : (
          <div className="table-wrap">
            <table className="readdy-table">
              <thead><tr><th>Ngày</th><th>Loại</th><th>Số dòng</th></tr></thead>
              <tbody>
                {overview.latestSnapshots.map((item, index) => (
                  <tr key={`${item.snapshot_date}-${item.ranking_type}-${index}`}>
                    <td>{item.snapshot_date}</td>
                    <td>{item.ranking_type}</td>
                    <td>{formatNumber(item.total_rows)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
