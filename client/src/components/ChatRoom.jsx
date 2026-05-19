import React, { useRef, useEffect, useState, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { downloadChatTxt, downloadChatZip, downloadFile } from '../utils/download';
import { format } from 'date-fns';
import { getUserFlairs } from '../utils/flairs';
import FlairBadge from './FlairBadge';
import styles from './ChatRoom.module.css';
import EmojiPicker from './EmojiPicker';

const MessageRow = memo(({ msg, isMine, showAvatar, user, onUserClick, onReply, styles }) => {
  const sender = isMine ? user : (msg.sender || {});
  const glowClass = sender.gender === 'female' ? styles.glowFemale : sender.gender === 'male' ? styles.glowMale : styles.glowNeutral;
  const fmtSize = (bytes) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`;
  const isImage = (type) => type?.startsWith('image/');

  return (
    <div className={`${styles.msgRow} ${isMine ? styles.mine : ''} fade-in`}>
      {!isMine && (
        <div className={styles.avatarCol} style={{ visibility: showAvatar ? 'visible' : 'hidden' }}>
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, cursor: 'pointer' }}
            onClick={() => onUserClick?.(sender)}
            title="Click to message">
            {sender.avatar_url
              ? <img src={sender.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : sender.username?.slice(0, 2).toUpperCase() || '??'}
          </div>
        </div>
      )}

      <div className={styles.msgContent}>
        {showAvatar && !isMine && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div className={styles.senderName} onClick={() => onUserClick?.(sender)} style={{ cursor: 'pointer', textDecoration: 'underline' }} title="Click to message">
              {sender.username || 'Unknown'}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {getUserFlairs(sender).map((f) => (
                <FlairBadge key={f.id} flair={f} size="xs" />
              ))}
            </div>
          </div>
        )}

        {msg.replyTo && (
          <div className={styles.replyBadge}>Replying to message</div>
        )}

        <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleOther} ${glowClass}`}
          onDoubleClick={() => onReply?.(msg)}>

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
});

function ChatRoom({ room, onUserClick }) {
  const { user } = useAuth();
  const { messages, typingUsers, onlineCount, sendMessage, sendTypingStart, sendTypingStop } = useChat(room.id);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showDownload, setShowDownload] = useState(false);
  const bottomRef = useRef(null);
  const emojiWrapRef = useRef(null);
  const typingList = Object.values(typingUsers).filter(u => u !== user.username);

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

          return (
            <MessageRow
              key={msg.id}
              msg={msg}
              isMine={isMine}
              showAvatar={showAvatar}
              user={user}
              onUserClick={onUserClick}
              onReply={setReplyTo}
              styles={styles}
            />
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

      {/* Input */}
      <div className={styles.inputArea}>
        <div className="emojiPickerWrap" ref={emojiWrapRef}>
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => setShowEmoji(s => !s)}
            title="Emoji"
            aria-expanded={showEmoji}
            aria-label="Open emoji picker"
          >
            <span style={{ fontSize: 16 }}>😊</span>
          </button>
          {showEmoji && (
            <EmojiPicker
              onSelect={(e) => setText(t => t + e)}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>
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

export default memo(ChatRoom);
