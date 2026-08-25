// Icones inline — mateix path/viewBox que els strings SVG d'index.html,
// convertides a components React (JSX ja escapa sol, no calen strings HTML).
export function IconaWifiOff({ className }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M5 12.5a10 10 0 0 1 5.5-3.4" />
      <path d="M19 12.5a10 10 0 0 0-3.2-2.4" />
      <path d="M2 8.5a15 15 0 0 1 4.2-2.6" />
      <path d="M22 8.5a15 15 0 0 0-4.7-3" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  );
}

export function IconaPeces({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" />
      <path d="M3 7l9 5 9-5M12 22V12" />
    </svg>
  );
}

export function IconaCabal({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5s6.5 7.6 6.5 12.1a6.5 6.5 0 0 1-13 0C5.5 10.1 12 2.5 12 2.5z" />
    </svg>
  );
}

export function IconaConsum({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4.5 14h6L10 22l9.5-13h-6L13 2z" />
    </svg>
  );
}

export function IconaReferencia({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 12.5 12.6 20.4a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1 0-2.8L11.5 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.5z" />
      <circle cx="16" cy="8" r="1.2" />
    </svg>
  );
}
