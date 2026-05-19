import { useEffect, useRef } from 'react';
import { playCallRing } from '../utils/notifications';

export default function IncomingCall({ incomingCall, onAccept, onDecline }) {
  const playedRef = useRef(null);

  useEffect(() => {
    if (!incomingCall?.fromUserId) return;
    if (playedRef.current === incomingCall.fromUserId) return;
    playedRef.current = incomingCall.fromUserId;
    playCallRing();
  }, [incomingCall]);

  if (!incomingCall) return null;

  const { fromUsername, fromAvatar, callType } = incomingCall;
  const initials = (fromUsername || '??').slice(0, 2).toUpperCase();

  return (
    <div
      className="fade-in"
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 1000,
        width: 320,
        padding: 16,
        borderRadius: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 18px 50px rgba(0, 0, 0, 0.18)',
        color: 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          {fromAvatar ? (
            <img
              src={fromAvatar}
              alt={fromUsername}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            initials
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>
            {fromUsername} is calling...
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 8px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            {callType === 'video' ? 'Video call' : 'Voice call'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={onAccept}
          style={{
            flex: 1,
            height: 38,
            border: 'none',
            borderRadius: 10,
            background: 'var(--green)',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Accept
        </button>
        <button
          type="button"
          onClick={onDecline}
          style={{
            flex: 1,
            height: 38,
            border: 'none',
            borderRadius: 10,
            background: 'var(--red)',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
