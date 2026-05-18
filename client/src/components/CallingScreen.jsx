// Spinner removed; using inline spinner in JSX to avoid LoaderContext dependency

export default function CallingScreen({ remoteUser, callState, callType, onEnd, localVideoRef, remoteVideoRef }) {
  if (callState === 'ended') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 500,
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        Call ended
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text)',
        overflow: 'hidden',
      }}
    >
      {callState === 'calling' && (
        <>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTop: '3px solid var(--accent)',
            animation: 'spin 1s linear infinite',
            marginBottom: 24,
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ marginTop: 18, fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
            Calling {remoteUser?.username}...
          </div>
          <button
            type="button"
            onClick={onEnd}
            style={{
              marginTop: 20,
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--red)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 10px 24px rgba(220, 38, 38, 0.25)',
            }}
            aria-label="End call"
            title="End call"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </>
      )}

      {callState === 'connected' && callType === 'video' && (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              background: '#000',
            }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute',
              right: 20,
              bottom: 92,
              width: 160,
              aspectRatio: '16 / 9',
              objectFit: 'cover',
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: '#000',
              boxShadow: '0 14px 30px rgba(0, 0, 0, 0.25)',
            }}
          />
          <button
            type="button"
            onClick={onEnd}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 24,
              transform: 'translateX(-50%)',
              width: 68,
              height: 68,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--red)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 10px 24px rgba(220, 38, 38, 0.25)',
              zIndex: 2,
            }}
            aria-label="End call"
            title="End call"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </>
      )}

      {callState === 'connected' && callType === 'voice' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                fontWeight: 800,
              }}
            >
              {remoteUser?.avatar_url ? (
                <img
                  src={remoteUser.avatar_url}
                  alt={remoteUser?.username}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                (remoteUser?.username || '??').slice(0, 2).toUpperCase()
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center' }}>
              {remoteUser?.username}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
              Connected
            </div>
          </div>
          <button
            type="button"
            onClick={onEnd}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 24,
              transform: 'translateX(-50%)',
              width: 68,
              height: 68,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--red)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 10px 24px rgba(220, 38, 38, 0.25)',
            }}
            aria-label="End call"
            title="End call"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
