import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import PageTitleBar from '../../components/PageTitleBar';
import { StatCardsRow } from '../../components/StatCardsRow';

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function statusChipClass(value) {
  const map = {
    success: 'chip-green',
    claimed: 'chip-green',
    failed: 'chip-red',
    cancelled: 'chip-red',
    refunded: 'chip-gray',
    pending: 'chip-gold',
  };
  return map[String(value || '').toLowerCase()] || 'chip-gray';
}

function statusLabel(value) {
  const map = {
    success: 'Thành công',
    claimed: 'Thành công',
    failed: 'Thất bại',
    cancelled: 'Đã hủy',
    refunded: 'Hoàn tiền',
    pending: 'Đang chờ',
  };
  return map[String(value || '').toLowerCase()] || value || '-';
}

function downloadCsv(rows) {
  const header = ['Mã GD', 'Người dùng', 'Vật phẩm/Gói', 'Số lượng', 'Tổng tiền', 'Loại', 'Trạng thái', 'Thời gian'];
  const lines = rows.map((row) => [
    row.transaction_code,
    row.display_name || row.username || '',
    row.item_name || '',
    row.quantity || 0,
    row.total_amount || 0,
    row.transaction_type || '',
    row.transaction_status || '',
    row.created_at || '',
  ]);
  const csv = [header, ...lines].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'transactions.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total: 0, revenueToday: 0, success: 0, failed: 0 });
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorText('');
    try {
      const result = await apiRequest('/api/shop/admin/transactions');
      setTransactions(toArray(result?.data));
      setStats(result?.data?.stats || { total: 0, revenueToday: 0, success: 0, failed: 0 });
    } catch (error) {
      setErrorText(error.message || 'Không tải được giao dịch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    return transactions.filter((row) => {
      const q = keyword.trim().toLowerCase();
      const okKeyword = !q || JSON.stringify(row).toLowerCase().includes(q);
      const okType = typeFilter === 'all' || row.transaction_type === typeFilter;
      const okStatus = statusFilter === 'all' || String(row.transaction_status || '').toLowerCase() === statusFilter;
      const okFrom = !dateFrom || String(row.created_at).slice(0, 10) >= dateFrom;
      const okTo = !dateTo || String(row.created_at).slice(0, 10) <= dateTo;
      return okKeyword && okType && okStatus && okFrom && okTo;
    });
  }, [transactions, keyword, typeFilter, statusFilter, dateFrom, dateTo]);

  const typeOptions = Array.from(new Set(transactions.map((row) => row.transaction_type).filter(Boolean)));

  return (
    <div className="readdy-page">
      <PageTitleBar title="Quản lý Giao dịch" description="Theo dõi toàn bộ lịch sử giao dịch trong hệ thống" />
      <StatCardsRow
        items={[
          { label: 'Tổng giao dịch', value: formatNumber(stats.total), icon: '⊖', tone: 'mint' },
          { label: 'Doanh thu hôm nay', value: formatNumber(stats.revenueToday), icon: '💲', tone: 'green' },
          { label: 'Giao dịch thành công', value: formatNumber(stats.success), icon: '✓', tone: 'green' },
          { label: 'Giao dịch thất bại', value: formatNumber(stats.failed), icon: '✕', tone: 'red' },
        ]}
      />

      <div className="panel readdy-toolbar-card">
        <div className="readdy-toolbar toolbar-transactions-visual">
          <div className="field-stack">
            <label>Tìm kiếm</label>
            <div className="readdy-search-input">
              <span>⌕</span>
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Mã GD, người dùng, vật phẩm..." />
            </div>
          </div>
          <div className="field-stack">
            <label>Loại giao dịch</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">Tất cả</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="field-stack">
            <label>Trạng thái</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="success">Thành công</option>
              <option value="pending">Đang chờ</option>
              <option value="failed">Thất bại</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
          <div className="field-stack">
            <label>Từ ngày</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field-stack">
            <label>Đến ngày</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="toolbar-actions-end">
          <button className="teal-btn" onClick={() => downloadCsv(filteredRows)}>⤓ Xuất CSV</button>
        </div>
      </div>

      {errorText ? <div className="empty-card"><div className="empty-title">{errorText}</div></div> : null}
      {loading ? <div className="empty-card"><div className="empty-title">Đang tải giao dịch...</div></div> : null}

      {!loading && filteredRows.length > 0 ? (
        <div className="panel readdy-table-panel">
          <div className="table-wrap">
            <table className="readdy-table">
              <thead>
                <tr>
                  <th>Mã GD</th>
                  <th>Người mua</th>
                  <th>Vật phẩm</th>
                  <th>Số lượng</th>
                  <th>Tổng tiền</th>
                  <th>Loại GD</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.source_type}-${row.id}`}>
                    <td>{row.transaction_code}</td>
                    <td>
                      <div className="readdy-user-row">
                        <div className="avatar-orb avatar-gray">{(row.display_name || row.username || '?').slice(0, 1)}</div>
                        <div className="readdy-user-copy">
                          <strong>{row.display_name || row.username}</strong>
                          <span>{row.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="readdy-comic-row">
                        {row.item_icon_url ? <img className="table-thumb" src={row.item_icon_url} alt={row.item_name} /> : <div className="comic-thumb">✦</div>}
                        <span>{row.item_name}</span>
                      </div>
                    </td>
                    <td>{row.quantity}</td>
                    <td>🪙 {formatNumber(row.total_amount)}</td>
                    <td><span className="readdy-chip chip-blue">{row.transaction_type}</span></td>
                    <td><span className={`readdy-chip ${statusChipClass(row.transaction_status)}`}>{statusLabel(row.transaction_status)}</span></td>
                    <td>{String(row.created_at).replace('T', ' ').slice(0, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
