import React from 'react';

const sizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 52,
  xl: 72,
};

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';
}

export default function Avatar({ name, src, size = 'md', online, style }) {
  const dimension = sizes[size] || sizes.md;

  return (
    <span
      aria-label={name ? `${name} avatar` : 'User avatar'}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: dimension,
        height: dimension,
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(6, 182, 212, 0.85))',
          color: 'white',
          fontSize: `${Math.max(11, dimension * 0.36)}px`,
          fontWeight: 700,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.16)',
        }}
      >
        {src ? (
          <img
            alt=""
            src={src}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          getInitials(name)
        )}
      </span>

      {typeof online === 'boolean' && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: Math.max(8, dimension * 0.26),
            height: Math.max(8, dimension * 0.26),
            borderRadius: 'var(--radius-full)',
            background: online ? 'var(--status-online)' : 'var(--status-offline)',
            border: '2px solid var(--bg-surface)',
          }}
        />
      )}
    </span>
  );
}
