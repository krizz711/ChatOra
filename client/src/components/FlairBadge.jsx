import React from 'react';

export default function FlairBadge({ flair, size = 'sm' }) {
  if (!flair) return null;

  const isOwner = flair.id === 'owner';
  const style = isOwner ? {
    borderColor: flair.color,
    color: '#fff',
    background: flair.color,
    boxShadow: `0 0 12px ${flair.color}`,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  } : {
    borderColor: flair.color,
    color: flair.color,
    background: flair.bg,
  };

  return (
    <div
      className={`badge ${size}`}
      style={style}
      title={flair.description}
    >
      <span className="emoji" style={{ marginRight: 6 }}>{flair.emoji}</span>
      <span className="label">{flair.label}</span>
    </div>
  );
}
