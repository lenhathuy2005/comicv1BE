import { useEffect, useMemo, useState } from 'react';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';
import EmptyState from '../../components/EmptyState';
import { apiRequest } from '../../services/api';
import { formatNumber } from '../../utils/adminHelpers';

export default function RealmsPage() {
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [tab, setTab] = useState('Cảnh giới');
  const [keyword, setKeyword] = useState('');
  const [data, setData] = useState({ overview: {}, realms: [], levels: [], breakthroughRules: [], ranking: [] });

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const [cultivationRes, rankingRes] = await Promise.all([
        apiRequest('/api/admin/cultivation'),
        apiRequest('/api/admin/rankings/level?limit=20'),
      ]);
      setData({
        overview: cultivationRes?.data?.overview || {},
        realms: cultivationRes?.data?.realms || [],
        levels: cultivationRes?.data?.levels || [],
        breakthroughRules: cultivationRes?.data?.breakthroughRules || [],
        ranking: rankingRes?.data || [],
      });
    } catch (error) {
      setErrorText(error.message || 'Không tải được dữ liệu cảnh giới');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const source = tab === 'Cảnh giới' ? data.realms : tab === 'Level' ? data.levels : tab === 'Đột phá' ? data.breakthroughRules : data.ranking;
    if (!q) return source;
    return source.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }, [tab, keyword, data]);

  const statCards = [
    { label: 'Tổng cảnh giới', value: formatNumber(data.overview.totalRealms), icon: '🧿', tone: 'purple' },
    { label: 'Tổng level', value: formatNumber(data.overview.totalLevels), icon: '📈', tone: 'mint' },
    { label: 'Mốc đột phá', value: formatNumber(data.overview.totalBreakthroughRules), icon: '⚡', tone: 'gold' },
    { label: 'Cảnh giới cuối', value: data.overview.finalRealm || 'Thần Thánh', icon: '👑', tone: 'rose' },
  ];

  return (
    <div className="readdy-page">
      <PageTitleBar title="Cảnh giới tu tiên v11" description="20 cảnh giới, 200 level, đột phá, bảo hiểm và hệ số AFK lấy từ file thiết kế" action={<button className="teal-btn" onClick={loadData}>Refresh</button>} />
      <StatCardsRow items={statCards} />
      <div className="panel readdy-tabs-panel">
        <div className="readdy-tabs is-four">
          {['Cảnh giới', 'Level', 'Đột phá', 'BXH'].map((label) => <button key={label} className={tab === label ? 'readdy-tab active' : 'readdy-tab'} onClick={() => setTab(label)}>{label}</button>)}
        </div>
        <div className="readdy-toolbar"><div className="readdy-search-input is-wide"><span>⌕</span><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm cảnh giới, level, vật phẩm..." /></div></div>
        {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
        {loading ? <div className="empty-card"><div className="empty-title">Đang tải dữ liệu...</div></div> : null}

        {!loading && tab === 'Cảnh giới' && (filtered.length === 0 ? <EmptyState title="Không có cảnh giới" /> : <div className="readdy-realm-grid">{filtered.map((item) => <div key={item.id} className="readdy-realm-card tone-purple"><div className="readdy-realm-top"><div className="readdy-square tone-purple">✦</div><div><h3>{item.name}</h3><span>Thứ tự {item.realm_order}</span></div></div><p>{item.description || 'Không có mô tả'}</p><div className="readdy-realm-line"><span>Power bonus</span><strong>{formatNumber(item.base_power_bonus)}</strong></div></div>)}</div>)}

        {!loading && tab === 'Level' && <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Level</th><th>Cảnh giới</th><th>Tầng</th><th>EXP cần</th><th>Power</th><th>AFK</th><th>Đột phá</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>Lv.{item.level_number}</td><td>{item.realm_name}</td><td>{item.stage_number} - {item.stage_name}</td><td>{formatNumber(item.exp_required)}</td><td>{formatNumber(item.power_points)}</td><td>{Number(item.afk_multiplier || 1).toFixed(3)}x</td><td>{item.is_breakthrough_level ? `Lên ${item.breakthrough_to_realm_name}` : '-'}</td></tr>)}</tbody></table></div>}

        {!loading && tab === 'Đột phá' && <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Mốc</th><th>Từ</th><th>Lên</th><th>Vật phẩm</th><th>Tỉ lệ gốc</th><th>Fail bonus</th><th>Bảo hiểm</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>Lv.{item.breakthrough_level}</td><td>{item.from_realm_name}</td><td>{item.to_realm_name}</td><td>{item.required_item_name} x{item.required_item_quantity}</td><td>{Number(item.success_rate_percent || 0).toFixed(0)}%</td><td>+{Number(item.fail_bonus_per_fail || 0) * 100}%</td><td>{item.insurance_item_name} x{item.insurance_item_quantity}</td></tr>)}</tbody></table></div>}

        {!loading && tab === 'BXH' && <div className="table-wrap"><table className="readdy-table"><thead><tr><th>Hạng</th><th>Người chơi</th><th>Level</th><th>Cảnh giới</th><th>EXP</th><th>Lực chiến</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.entityId || item.entity_id || item.rank}><td>#{item.rank || item.rank_position}</td><td>{item.data?.displayName || item.name || item.username || '-'}</td><td>{item.data?.levelNumber || item.level_number || '-'}</td><td>{item.data?.realmName || item.realm_name || '-'}</td><td>{formatNumber(item.data?.currentExp || item.current_exp || 0)}</td><td>{formatNumber(item.data?.combatPower || item.combat_power || 0)}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}
