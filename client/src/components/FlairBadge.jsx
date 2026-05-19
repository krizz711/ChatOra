import React from 'react';
import styles from './FlairBadge.module.css';

function EarthFlairIcon() {
  return (
    <span className={styles.earthIcon} aria-hidden>
      <span className={styles.earthGlobe} />
    </span>
  );
}

export default function FlairBadge({ flair, size = 'sm' }) {
  if (!flair) return null;

  const isEarth = flair.id === 'earthloader';
  const style = isEarth ? undefined : {
    borderColor: flair.color,
    color: flair.color,
    background: flair.bg,
  };

  return (
    <div
      className={`${styles.badge} ${styles[size]} ${isEarth ? styles.earthBadge : ''}`}
      style={style}
      title={flair.description}
    >
      {isEarth ? <EarthFlairIcon /> : <span className={styles.emoji}>{flair.emoji}</span>}
      <span className={styles.label}>{flair.label}</span>
    </div>
  );
}
