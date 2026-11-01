import { useEffect, useRef } from "react";

/** Bottom sheet on phones, centred card on desktops (CSS decides). Esc or a tap outside closes it. */
export default function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const first = ref.current && ref.current.querySelector("input,select,textarea,button");
    if (first) first.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle" ref={ref}>
        <h2 id="mTitle">{title}</h2>
        {children}
      </div>
    </div>
  );
}
