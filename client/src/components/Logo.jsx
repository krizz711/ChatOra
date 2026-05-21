const SIZE_PRESETS = {
  small: { fontSize: '1rem', dotSize: 8, spacing: 8 },
  medium: { fontSize: '1.2rem', dotSize: 10, spacing: 9 },
  large: { fontSize: '1.6rem', dotSize: 12, spacing: 10 },
  xl: { fontSize: '2rem', dotSize: 14, spacing: 12 },
};

export default function Logo({ size = 'medium', className = '' }) {
  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.medium;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${preset.spacing}px`,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: 'var(--text, #f5f7ff)',
        lineHeight: 1,
      }}
      aria-label="NexChat"
    >
      <span
        aria-hidden="true"
        style={{
          width: `${preset.dotSize}px`,
          height: `${preset.dotSize}px`,
          borderRadius: '999px',
          background: 'linear-gradient(135deg, #2dd4bf 0%, #22c55e 100%)',
          boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.12), 0 0 18px rgba(45, 212, 191, 0.4)',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: preset.fontSize }}>NexChat</span>
    </div>
  );
}
