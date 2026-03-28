export default function EmptyState({ title, description, action }) {
  return (
    <div className="empty-card">
      <div className="empty-icon">◎</div>
      <div className="empty-title">{title}</div>
      <p className="empty-description">{description}</p>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}
