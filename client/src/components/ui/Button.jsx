import React from 'react';

const variants = {
  primary: {
    background: 'var(--accent-gradient)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 12px var(--accent-glow)',
  },
  secondary: {
    background: 'var(--bg-overlay)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
  danger: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: 'var(--status-error)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
  },
};

const sizes = {
  sm: { padding: '5px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' },
  md: { padding: '8px 18px', fontSize: '0.875rem', borderRadius: 'var(--radius-md)' },
  lg: { padding: '11px 24px', fontSize: '0.95rem', borderRadius: 'var(--radius-md)' },
  icon: { padding: '8px', fontSize: '1rem', borderRadius: 'var(--radius-md)', lineHeight: 1 },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
  style,
  className,
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s, transform 0.1s, box-shadow 0.15s',
    outline: 'none',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    ...variants[variant],
    ...sizes[size],
    ...style,
  };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      style={base}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={className}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = disabled ? '0.5' : '1'; }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
}