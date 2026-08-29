'use client';

import { useEffect, useId, useRef, useState } from 'react';

export default function AppSelect({ value = '', onChange, options = [], ariaLabel, className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const normalizedValue = String(value ?? '');
  const selected = options.find((option) => String(option.value) === normalizedValue) || options[0];

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const select = (nextValue) => {
    onChange(String(nextValue));
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((current) => !current);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const currentIndex = Math.max(0, options.findIndex((option) => String(option.value) === normalizedValue));
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = Math.min(options.length - 1, Math.max(0, currentIndex + direction));
    if (options[nextIndex]) select(options[nextIndex].value);
  };

  return (
    <div ref={rootRef} className={`app-select${open ? ' open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="app-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <span>{selected?.label ?? ''}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
      </button>
      {open && (
        <div className="app-select-menu" id={listId} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const active = String(option.value) === normalizedValue;
            return (
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={active ? 'selected' : ''}
                key={String(option.value)}
                onClick={() => select(option.value)}
              >
                <span>{option.label}</span>{active && <span className="app-select-check">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
