import { useRef, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { uploadFile } from '../utils/api';
import { downloadChatTxt, downloadChatZip, downloadFile } from '../utils/download';
import { format } from 'date-fns';
import styles from './ChatRoom.module.css';

export default function ChatRoom({ room, onUserClick }) {
  const { user } = useAuth();
  const { messages, typingUsers, onlineCount, sendMessage, sendFile, sendTypingStart, sendTypingStop } = useChat(room.id);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showDownload, setShowDownload] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const typingList = Object.values(typingUsers).filter(u => u !== user.username);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text, replyTo?.id);
    setText('');
    setReplyTo(null);
    sendTypingStop();
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = e => {
    setText(e.target.value);
    if (e.target.value) sendTypingStart();
    else sendTypingStop();
  };

  const getGlowClass = (gender) => {
    if (gender === 'female') return styles.glowFemale;
    if (gender === 'male') return styles.glowMale;
    return styles.glowNeutral;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (room.is_global) {
      if ((file.type.startsWith('image/') && file.type !== 'image/gif') || file.type.startsWith('video/')) {
        alert('Images and videos are not allowed in global rooms. Only GIFs are permitted.');
        fileRef.current.value = '';
        return;
      }
    }
    setUploading(true); setUploadProgress(0);
    try {
      const data = await uploadFile(file, p => setUploadProgress(p));
      sendFile(data.url, data.originalName, data.mimetype, data.size);
    } catch { alert('Upload failed. Check file size (max 10MB).'); }
    finally { setUploading(false); fileRef.current.value = ''; }
  };

  const isImage = (type) => type?.startsWith('image/');
  const fmtSize = (bytes) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`;

  return (
    <div className={styles.room}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.roomName}>{room.name}</div>
          <div className={styles.roomMeta}>{onlineCount} online</div>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.downloadWrap}>
            <button className={styles.iconBtn} onClick={() => setShowDownload(!showDownload)} title="Download">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {showDownload && (
              <div className={styles.dropdown}>
                <button onClick={() => { downloadChatTxt(messages, room.name); setShowDownload(false); }}>
                  Download as .txt
                </button>
                <button onClick={() => { downloadChatZip(messages, room.name); setShowDownload(false); }}>
                  Download as .zip (includes files)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <div>No messages yet. Say hello!</div>
          </div>
        )}

        {messages.map((msg, i) => {
          const sender = msg.sender || {};
          const isMine = sender.id === user.id;
          const showAvatar = i === 0 || messages[i - 1]?.sender?.id !== sender.id;
          const glowClass = getGlowClass(sender.gender);

          return (
            <div key={msg.id} className={`${styles.msgRow} ${isMine ? styles.mine : ''} fade-in`}>
              {!isMine && (
                <div className={styles.avatarCol} style={{ visibility: showAvatar ? 'visible' : 'hidden' }}>
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, cursor: 'pointer' }}
                    onClick={() => onUserClick?.(sender)}
                    title="Click to message">
                    {sender.avatar_url
                      ? <img src={sender.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                      : sender.username?.slice(0, 2).toUpperCase() || '??'}
                  </div>
                </div>
              )}

              <div className={styles.msgContent}>
                {showAvatar && !isMine && (
                  <div className={styles.senderName} onClick={() => onUserClick?.(sender)} style={{ cursor: 'pointer', textDecoration: 'underline' }} title="Click to message">
                    {sender.username || 'Unknown'}
                  </div>
                )}

                {msg.replyTo && (
                  <div className={styles.replyBadge}>Replying to message</div>
                )}

                <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther} ${glowClass}`}
                  onDoubleClick={() => setReplyTo(msg)}>

                  {msg.type === 'file' && (
                    <div className={styles.fileMsg}>
                      {isImage(msg.fileType) ? (
                        <img
                          src={msg.fileUrl}
                          alt={msg.fileName}
                          className={styles.imageMsg}
                          onClick={() => window.open(msg.fileUrl, '_blank')}
                        />
                      ) : (
                        <div className={styles.fileCard}>
                          <div className={styles.fileIcon}>
                            {msg.fileType === 'application/pdf' ? 'PDF' : 'File'}
                          </div>
                          <div>
                            <div className={styles.fileName}>{msg.fileName}</div>
                            {msg.fileSize && (
                              <div className={styles.fileSize}>{fmtSize(msg.fileSize)}</div>
                            )}
                          </div>
                        </div>
                      )}
                      <button
                        className={styles.dlBtn}
                        onClick={() => downloadFile(msg.fileUrl, msg.fileName, msg.fileType)}
                      >
                        Download
                      </button>
                    </div>
                  )}

                  {msg.text && <div className={styles.msgText}>{msg.text}</div>}
                </div>

                <div className={styles.msgTime}>
                  {format(new Date(msg.timestamp), 'HH:mm')}
                </div>
              </div>
            </div>
          );
        })}

        {typingList.length > 0 && (
          <div className={styles.typing}>
            <span className={styles.typingDots}><span /><span /><span /></span>
            {typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div className={styles.replyBanner}>
          <span>Replying to <strong>{replyTo.sender.username}</strong>: {replyTo.text?.slice(0, 50)}</span>
          <button onClick={() => setReplyTo(null)}>x</button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className={styles.uploadBar}>
          <div className={styles.uploadFill} style={{ width: `${uploadProgress}%` }} />
          <span>Uploading {uploadProgress}%</span>
        </div>
      )}

      {/* Input */}
      <div className={styles.inputArea}>
        <input type="file" ref={fileRef} onChange={handleFileUpload} style={{ display: 'none' }}
          accept={room.is_global ? "image/gif,.pdf,.txt,.zip" : "image/*,video/*,.pdf,.txt,.zip"} />
        <button className={styles.attachBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <textarea
          className={styles.input}
          value={text}
          onChange={handleTyping}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${room.name}...`}
          rows={1}
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={!text.trim()}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
