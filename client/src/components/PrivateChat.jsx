import { useState, useRef, useEffect } from 'react';
import EmojiPicker from './EmojiPicker';
import { useAuth } from '../context/AuthContext';
import { uploadFile } from '../utils/api';
import { downloadChatTxt, downloadFile } from '../utils/download';
import { format } from 'date-fns';
import { getUserFlairs } from '../utils/flairs';
import FlairBadge from './FlairBadge';
import { Image } from 'lucide-react';
import styles from './PrivateChat.module.css';

export default function PrivateChat({ targetUser, messages, onSend, onSendFile, onClose, onCallUser, onStarUser, starringUserId, onViewProfile, fullScreen = false }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const emojiWrapRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!showEmoji) return;
    const close = (e) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [showEmoji]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadFile(file);
      onSendFile(data.url, data.originalName, data.mimetype);
    } catch { alert('Upload failed'); }
    finally { setUploading(false); fileRef.current.value = ''; }
  };

  const isImage = (type) => type?.startsWith('image/');

  return (
    <div className={`${styles.panel} ${fullScreen ? styles.fullScreen : ''}`}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
            {targetUser.avatar_url
              ? <img src={targetUser.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : targetUser.username?.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{targetUser.username}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {getUserFlairs(targetUser).map((f) => (
                <FlairBadge key={f.id} flair={f} size="xs" />
              ))}
            </div>
          </div>
          <button
            className={`${styles.starBtn} ${targetUser.starredByMe ? styles.starred : ''}`}
            type="button"
            onClick={() => onStarUser?.(targetUser.id)}
            disabled={starringUserId === targetUser.id || targetUser.id?.startsWith('guest_')}
            title={targetUser.starredByMe ? 'Unstar this chatter' : 'Star this chatter'}
          >
            <span className={styles.starIcon} aria-hidden="true" />
            {targetUser.stars || 0}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={styles.iconBtn} onClick={() => alert("Currently not available")} style={{ textDecoration: 'line-through', opacity: 0.5 }} title="Currently not available">
            Call
          </button>
          <button className={styles.iconBtn} onClick={() => alert("Currently not available")} style={{ textDecoration: 'line-through', opacity: 0.5 }} title="Currently not available">
            Video
          </button>
          <button className={styles.iconBtn} onClick={() => onViewProfile?.(targetUser)} title="View profile">
            Profile
          </button>
          <button className={styles.iconBtn} onClick={() => downloadChatTxt(messages, `DM_${targetUser.username}`)} title="Download">
            Save
          </button>
          <button className={styles.closeBtn} onClick={onClose}>x</button>
        </div>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>Start a private conversation with {targetUser.username}</div>
        )}
        {messages.map(msg => {
          const isMine = msg.sender.id === user.id;
          return (
            <div key={msg.id} className={`${styles.msgRow} ${isMine ? styles.mine : ''}`}>
              <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther}`}>
                {msg.type === 'file' ? (
                  isImage(msg.fileType)
                    ? <img src={msg.fileUrl} alt={msg.fileName} className={styles.img} onClick={() => downloadFile(msg.fileUrl, msg.fileName, msg.fileType)} />
                    : <div className={styles.file}>File: {msg.fileName} <button type="button" onClick={() => downloadFile(msg.fileUrl, msg.fileName, msg.fileType)}>Open</button> <button type="button" onClick={() => downloadFile(msg.fileUrl, msg.fileName, msg.fileType)}>Save</button></div>
                ) : (
                  <span>{msg.text}</span>
                )}
              </div>
              <div className={styles.time}>{format(new Date(msg.timestamp), 'HH:mm')}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {uploading && <div className={styles.uploading}>Uploading...</div>}

      <div className={styles.inputArea} style={{ position: 'relative' }}>
        <input type="file" ref={fileRef} onChange={handleFile} style={{ display: 'none' }} accept="image/*" />
        <button className={styles.attachBtn} onClick={() => fileRef.current?.click()} title="Send picture"><Image size={18} /></button>
        <div className="emojiPickerWrap" ref={emojiWrapRef}>
          <button type="button" className={styles.attachBtn} onClick={() => setShowEmoji(s => !s)} title="Emoji" aria-label="Open emoji picker">😊</button>
          {showEmoji && (
            <EmojiPicker onSelect={(e) => setText(t => t + e)} onClose={() => setShowEmoji(false)} />
          )}
        </div>
        <input
          className={styles.input}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${targetUser.username}...`}
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={!text.trim()}>Send</button>
      </div>
    </div>
  );
}
