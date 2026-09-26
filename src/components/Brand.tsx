export function Brand({ compact = false }: { compact?: boolean }) {
  return compact ? <span className="brand-kicker">PILLAR BUILDWORKS</span> : <div className="pillar-brand"><div><strong>PILLAR<span className="pillar-mark" aria-hidden="true"><svg viewBox="0 0 40 54" fill="none"><path d="M7 52V3h21q9 0 9 9v15q0 9-9 9H7M2 8h12M2 15h10M2 23h10M2 31h10M2 39h10M2 47h10" stroke="currentColor" strokeWidth="2"/><path d="M4 0h6v6H4zM4 48h6v6H4z" fill="currentColor"/></svg></span></strong><span>BUILDWORKS</span></div><div className="brand-meta">FIELD NOTES<br/>BUILT FOR SITE</div></div>;
}
