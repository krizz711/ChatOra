import React from 'react';

export default function FlairBadge({ flair, size = 'sm' }) {
  if (!flair) return null;
  const style = { borderColor: flair.color, color: flair.color, background: flair.bg };
  return (
    <div className={`badge ${size}`} style={style} title={flair.description}>
      <span className="emoji" style={{ marginRight: 6 }}>{flair.emoji}</span>
      <span className="label">{flair.label}</span>
    </div>
  );
}
