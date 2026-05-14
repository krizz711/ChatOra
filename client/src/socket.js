import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

let socket = null;
const socketResetListeners = new Set();

export const getSocket = () => socket;

export const onSocketReset = (cb) => {
  socketResetListeners.add(cb);
};
export const offSocketReset = (cb) => {
  socketResetListeners.delete(cb);
};

export const initSocket = (token) => {
  if (socket) socket.disconnect();
  socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  // Notify listeners that socket instance was replaced
  socketResetListeners.forEach((cb) => {
    try { cb(socket); } catch (err) { console.error('socket reset listener error', err); }
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
