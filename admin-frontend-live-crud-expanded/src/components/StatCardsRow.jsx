export function StatCardsRow({ items }) {
  return (
    <div className="readdy-stat-grid">
      {items.map((item) => (
        <div key={item.label} className={`readdy-stat-card ${item.tone ? `tone-${item.tone}` : ''}`}>
          <div>
            <div className="readdy-stat-label">{item.label}</div>
            <div className="readdy-stat-value">{item.value}</div>
          </div>
          <div className="readdy-stat-icon">{item.icon || '◻'}</div>
        </div>
      ))}
    </div>
  );
}
