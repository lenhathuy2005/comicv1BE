import { useEffect } from "react";
import { createPortal } from "react-dom";
import "../../styles/components/admin-modal.css";

export default function AdminModal({
  open,
  title,
  children,
  onClose,
  footer,
  width = 920,
}) {
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal"
        style={{ maxWidth: `${width}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">{title}</h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="admin-modal-body">
          {children}
        </div>

        {footer ? <div className="admin-modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}