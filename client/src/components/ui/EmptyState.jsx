import React from 'react';

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-6)',
        textAlign: 'center',
        height: '100%',
        color: 'var(--text-muted)',
      }}
    >
      {icon && (
        <div style={{ fontSize: '2.5rem', lineHeight: 1, marginBottom: '4px', opacity: 0.5 }}>
          {icon}
        </div>
      )}
      {title && (
        <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {title}
        </p>
      )}
      {description && (
        <p style={{ fontSize: '0.82rem', lineHeight: 1.6, maxWidth: '240px' }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '4px' }}>{action}</div>}
    </div>
  );
}