import React from 'react';

export default function Badge({ count, max = 99, variant = 'primary', style }) {
  if (!count || count === 0) return null;
  const display = count > max ? `${max}+` : String(count);

  const colors = {
    primary: { bg: 'var(--accent-primary)', color: '#fff' },
    cyan: { bg: 'var(--accent-secondary)', color: '#fff' },
    error: { bg: 'var(--status-error)', color: '#fff' },
    muted: { bg: 'var(--bg-overlay)', color: 'var(--text-secondary)' },
  };

  const { bg, color } = colors[variant] || colors.primary;

  return (
    <span
      aria-label={`${display} unread`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '18px',
        padding: '0 5px',
        borderRadius: 'var(--radius-full)',
        background: bg,
        color,
        fontSize: '0.7rem',
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
    >
      {display}
    </span>
  );
}