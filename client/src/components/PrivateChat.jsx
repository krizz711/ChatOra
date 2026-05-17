import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { uploadFile } from '../utils/api';
import { downloadChatTxt, downloadFile } from '../utils/download';
import { format } from 'date-fns';
import styles from './PrivateChat.module.css';

export default function PrivateChat({ targetUser, messages, onSend, onSendFile, onClose, onCallUser, onStarUser, starringUserId, onViewProfile, fullScreen = false }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          <span>{targetUser.username}</span>
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
          <button className={styles.iconBtn} onClick={() => onCallUser?.(targetUser, 'voice')} title="Call">
            Call
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

      <div className={styles.inputArea}>
        <input type="file" ref={fileRef} onChange={handleFile} style={{ display: 'none' }} accept="image/*,.pdf,.txt" />
        <button className={styles.attachBtn} onClick={() => fileRef.current?.click()}>Attach</button>
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
