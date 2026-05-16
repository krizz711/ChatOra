import { useEffect, useRef, useState } from 'react';
import { getSocket, onSocketReset, offSocketReset } from '../socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function useCall() {
  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState('voice');
  const [remoteUser, setRemoteUser] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const cleanup = () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
    } catch (err) {
      console.error('cleanup local stream error', err);
    }

    try {
      if (pcRef.current) {
        try { pcRef.current.close(); } catch (e) {}
        pcRef.current = null;
      }
    } catch (err) {
      console.error('cleanup pc error', err);
    }

    try {
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    } catch (err) {
      console.error('cleanup video element error', err);
    }
  };

  const createPeerConnection = (toUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      const socket = getSocket();
      if (candidate && socket) socket.emit('call:ice', { to: toUserId, candidate });
    };

    pc.ontrack = (event) => {
      try {
        const remoteStream = event.streams && event.streams[0];
        if (remoteStream) {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        }
      } catch (err) { console.error('ontrack error', err); }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        cleanup();
        setCallState('ended');
      }
    };

    return pc;
  };

  const startCall = async (targetUser, type = 'voice') => {
    setCallType(type);
    setRemoteUser(targetUser);
    setCallState('calling');

    try {
      const constraints = { audio: true, video: type === 'video' };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection(targetUser.id);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      if (socket) socket.emit('call:offer', { to: targetUser.id, offer: pc.localDescription, callType: type });
    } catch (err) {
      console.error('startCall error', err);
      cleanup();
      setCallState('idle');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    setCallType(incomingCall.callType || 'voice');
    setRemoteUser({ id: incomingCall.fromUserId, username: incomingCall.fromUsername, avatar: incomingCall.fromAvatar });

    try {
      const constraints = { audio: true, video: incomingCall.callType === 'video' };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection(incomingCall.fromUserId);
      // add local tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(incomingCall.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getSocket();
      if (socket) socket.emit('call:answer', { to: incomingCall.fromUserId, answer: pc.localDescription });

      setIncomingCall(null);
      setCallState('connected');
    } catch (err) {
      console.error('acceptCall error', err);
      cleanup();
      setCallState('idle');
    }
  };

  const declineCall = () => {
    if (!incomingCall) return;
    const socket = getSocket();
    try {
      if (socket) socket.emit('call:decline', { to: incomingCall.fromUserId });
    } catch (err) { console.error('decline emit error', err); }
    setIncomingCall(null);
    setCallState('idle');
  };

  const endCall = () => {
    try {
      const socket = getSocket();
      if (remoteUser && socket) socket.emit('call:end', { to: remoteUser.id });
    } catch (err) { console.error('endCall emit error', err); }
    cleanup();
    setCallState('idle');
    setRemoteUser(null);
  };

  useEffect(() => {
    let socket = getSocket();

    const handleIncoming = (data) => {
      setIncomingCall(data);
      setCallState('incoming');
    };

    const handleAnswered = async (data) => {
      try {
        if (pcRef.current && data.answer) {
          await pcRef.current.setRemoteDescription(data.answer);
          setCallState('connected');
        }
      } catch (err) { console.error('handleAnswered error', err); }
    };

    const handleIce = async (data) => {
      try {
        if (pcRef.current && data.candidate) {
          await pcRef.current.addIceCandidate(data.candidate);
        }
      } catch (err) { console.error('handleIce error', err); }
    };

    const handleDeclined = () => {
      cleanup();
      setCallState('ended');
      setTimeout(() => setCallState('idle'), 3000);
    };

    const handleEnded = () => {
      cleanup();
      setCallState('ended');
      setTimeout(() => {
        setCallState('idle');
        setRemoteUser(null);
      }, 3000);
    };

    const bind = (s) => {
      if (!s) return;
      s.on('call:incoming', handleIncoming);
      s.on('call:answered', handleAnswered);
      s.on('call:ice', handleIce);
      s.on('call:declined', handleDeclined);
      s.on('call:ended', handleEnded);
    };

    const unbind = (s) => {
      if (!s) return;
      s.off('call:incoming', handleIncoming);
      s.off('call:answered', handleAnswered);
      s.off('call:ice', handleIce);
      s.off('call:declined', handleDeclined);
      s.off('call:ended', handleEnded);
    };

    bind(socket);

    const resetHandler = (newSocket) => {
      unbind(socket);
      socket = newSocket;
      bind(socket);
    };

    onSocketReset(resetHandler);

    return () => {
      unbind(socket);
      offSocketReset(resetHandler);
    };
  }, []);

  return {
    callState,
    callType,
    remoteUser,
    incomingCall,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    localVideoRef,
    remoteVideoRef,
  };
}
