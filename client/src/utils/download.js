import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { getStoredToken } from './token';

const SERVER = import.meta.env.VITE_SERVER_URL || '';

const fetchViaProxy = async (url) => {
  const token = getStoredToken();
  const proxyUrl = `${SERVER}/api/upload/fetch?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
  return res;
};

const fetchFile = async (url) => {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) return res;
    }
  } catch {}
  return fetchViaProxy(url);
};

const senderName = (msg) => msg?.sender?.username || 'unknown';

const toAbsoluteUrl = (url) => {
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
};

// Download chat as .txt
export const downloadChatTxt = (messages, roomName) => {
  try {
    const lines = (messages || []).map(msg => {
      const time = msg.timestamp
        ? format(new Date(msg.timestamp), 'HH:mm:ss')
        : '--:--:--';
      if (msg.type === 'file') {
        return `[${time}] ${senderName(msg)}: [File: ${msg.fileName || 'unknown'}]`;
      }
      return `[${time}] ${senderName(msg)}: ${msg.text || ''}`;
    });
    const header = `Chat Export — ${roomName}\nDate: ${format(new Date(), 'PPP')}\n${'─'.repeat(40)}\n\n`;
    const blob = new Blob([header + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${roomName.replace(/[^a-z0-9]/gi, '_')}_chat.txt`);
  } catch {
    alert('Could not export chat.');
  }
};

// Download single file from URL
export const downloadFile = async (url, fileName, fileType) => {
  if (!url) { alert('No file URL available.'); return; }

  // For PDFs — open in new tab directly, most reliable cross-browser
  if (fileType === 'application/pdf' || (fileName || '').toLowerCase().endsWith('.pdf')) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    const res = await fetchFile(url);
    const blob = await res.blob();
    if (blob.size === 0) throw new Error('Empty blob');
    saveAs(blob, fileName || 'download');
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

// Download all media + chat as zip
export const downloadChatZip = async (messages, roomName) => {
  try {
    const zip = new JSZip();
    const safeName = roomName.replace(/[^a-z0-9]/gi, '_');
    const folder = zip.folder(safeName);
    const failedFiles = [];
    const lines = (messages || []).map(msg => {
      const time = msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm:ss') : '--:--:--';
      if (msg.type === 'file') return `[${time}] ${senderName(msg)}: [File: ${msg.fileName || 'unknown'}]`;
      return `[${time}] ${senderName(msg)}: ${msg.text || ''}`;
    });
    folder.file('chat.txt', lines.join('\n'));
    const fileMessages = (messages || []).filter(m => m.type === 'file' && m.fileUrl);
    for (const msg of fileMessages) {
      try {
        const res = await fetchFile(msg.fileUrl);
        const blob = await res.blob();
        if (blob.size === 0) continue;
        folder.file(msg.fileName || 'file', blob);
      } catch {
        failedFiles.push(msg.fileName || msg.fileUrl || 'unknown file');
      }
    }
    if (failedFiles.length) {
      folder.file('download_warnings.txt', `Some files could not be downloaded:\n${failedFiles.map(name => `- ${name}`).join('\n')}`);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${safeName}_export.zip`);
  } catch {
    alert('Could not create zip. Try .txt instead.');
  }
};
