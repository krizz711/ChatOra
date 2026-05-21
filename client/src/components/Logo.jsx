import React from 'react';

export default function Logo({ size = 'medium', className = '' }) {
  const sizes = {
    small: { icon: 20, text: 16 },
    medium: { icon: 24, text: 20 },
    large: { icon: 32, text: 28 },
    xl: { icon: 42, text: 36 }
  };
  
  const currentSize = sizes[size] || sizes.medium;

  return (
    <div 
      className={`chatora-logo-wrapper ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size === 'small' ? '6px' : '8px',
        userSelect: 'none'
      }}
    >
      <svg 
        width={currentSize.icon} 
        height={currentSize.icon} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M12 2C6.477 2 2 6.03 2 11c0 2.843 1.488 5.372 3.82 7.042l-1.396 3.024a1 1 0 0 0 1.306 1.306l3.024-1.396A11.018 11.018 0 0 0 12 20c5.523 0 10-4.03 10-9s-4.477-9-10-9Z"
          fill="url(#chatora-gradient)"
        />
        <path 
          d="M15 11c0 1.657-1.343 3-3 3s-3-1.343-3-3" 
          stroke="white" 
          strokeWidth="2" 
          strokeLinecap="round" 
        />
        <circle cx="8" cy="10" r="1.5" fill="white" />
        <circle cx="16" cy="10" r="1.5" fill="white" />
        <defs>
          <linearGradient id="chatora-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--accent, #008cff)" />
            <stop offset="1" stopColor="var(--accent-dim, #a855f7)" />
          </linearGradient>
        </defs>
      </svg>
      <span 
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 800,
          fontSize: currentSize.text,
          letterSpacing: '-0.03em',
          color: 'var(--text)',
          lineHeight: 1
        }}
      >
        ChatOra
      </span>
    </div>
  );
}
