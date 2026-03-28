export default function PageTitleBar({ title, description, action }) {
  return (
    <div className="readdy-page-head">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="readdy-page-head-action">{action}</div> : null}
    </div>
  );
}
