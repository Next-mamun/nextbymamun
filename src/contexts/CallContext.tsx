import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useP2P } from './P2PContext';
import { toast } from 'sonner';
import { triggerNotification } from '@/services/notificationService';
import { MediaConnection, DataConnection } from 'peerjs';
import { playPhoneRing, stopPhoneRing } from '@/lib/ringtone';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';

type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected';
type CallType = 'audio' | 'video';

interface CallData {
  id: string; // we can use caller peer id
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  type: CallType;
  status: 'calling' | 'answered' | 'rejected' | 'ended';
}

interface CallContextType {
  status: CallStatus;
  currentCall: CallData | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (receiverId: string, receiverName: string, receiverAvatar: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  isMuted: boolean;
  isVideoOff: boolean;
  sendFile: (file: File) => Promise<void>;
  receivedFiles: { name: string, url: string }[];
}

const CallContext = createContext<CallContextType | null>(null);

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();
  const { peer } = useP2P();
  
  const [status, setStatus] = useState<CallStatus>('idle');
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<{ name: string, url: string }[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const callConnectionRef = useRef<MediaConnection | null>(null);
  const dataConnectionRef = useRef<DataConnection | null>(null);

  // Auto-answer logic from Notification click
  useEffect(() => {
    if (status === 'ringing' && currentCall) {
      playPhoneRing();
      const urlParams = new URLSearchParams(window.location.search);
      const action = urlParams.get('action');
      const callId = urlParams.get('call_id');

      if (callId === currentCall.id) {
        if (action === 'answer') {
          console.log('Auto-accepting call from notification');
          acceptCall();
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (action === 'reject') {
          console.log('Auto-rejecting call from notification');
          rejectCall();
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } else {
      stopPhoneRing();
    }
    return () => {
      stopPhoneRing();
    };
  }, [status, currentCall]);

  // Firestore signaling listener fallback for incoming calls
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = onSnapshot(doc(db, 'active_calls', currentUser.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'calling' && Date.now() - (data.timestamp || 0) < 45000) {
          if (status === 'idle') {
            const incoming: CallData = {
              id: data.callId || snap.id,
              callerId: data.callerId,
              callerName: data.callerName || 'Unknown Caller',
              callerAvatar: data.callerAvatar || '',
              receiverId: currentUser.id,
              type: data.type || 'audio',
              status: 'calling'
            };
            setCurrentCall(incoming);
            setStatus('ringing');
            playPhoneRing();
          }
        } else if (data.status === 'ended' || data.status === 'rejected') {
          if (status === 'ringing' || status === 'calling') {
            handleCallEnded();
          }
        }
      }
    });

    return () => unsub();
  }, [currentUser?.id, status]);

  useEffect(() => {
    if (!peer || !currentUser) return;

    peer.on('call', (call) => {
      // Incoming call
      callConnectionRef.current = call;
      
      // We parse caller metadata sent via options.metadata
      const metadata = call.metadata || {};
      
      const incomingCall: CallData = {
        id: metadata.callId || call.peer,
        callerId: metadata.callerId || call.peer.replace('nxt-peer-', ''),
        callerName: metadata.callerName || 'Unknown Caller',
        callerAvatar: metadata.callerAvatar || '',
        receiverId: currentUser.id,
        type: metadata.type || 'audio',
        status: 'calling'
      };
      
      setCurrentCall(incomingCall);
      setStatus('ringing');
      playPhoneRing();
      
      call.on('stream', (remoteStream) => {
        stopPhoneRing();
        setRemoteStream(remoteStream);
      });
      
      call.on('close', () => {
        handleCallEnded();
      });
    });

    peer.on('connection', (conn) => {
      // Incoming file transfer connection
      if (conn.label === 'fileTransfer') {
        dataConnectionRef.current = conn;
        conn.on('data', (data: any) => {
          handleReceiveMessage({ data });
        });
      }
    });

  }, [peer, currentUser]);

  const handleReceiveMessage = (event: any) => {
    try {
      const { type, fileName, fileData } = event.data;
      if (type === 'file') {
        const blob = new Blob([fileData]);
        const url = URL.createObjectURL(blob);
        setReceivedFiles(prev => [...prev, { name: fileName, url }]);
        toast.success(`Received file: ${fileName}`);
      } else if (type === 'call_rejected') {
        toast.error('Call rejected');
        handleCallEnded();
      } else if (type === 'call_ended') {
        toast('Call ended by remote user');
        handleCallEnded();
      }
    } catch (err) {}
  };

  const handleCallEnded = () => {
    stopPhoneRing();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    callConnectionRef.current?.close();
    dataConnectionRef.current?.close();
    callConnectionRef.current = null;
    dataConnectionRef.current = null;
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    if (currentCall && currentUser) {
      deleteDoc(doc(db, 'active_calls', currentCall.receiverId)).catch(() => {});
      deleteDoc(doc(db, 'active_calls', currentUser.id)).catch(() => {});
    }
    setCurrentCall(null);
    setStatus('idle');
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const startCall = async (receiverId: string, receiverName: string, receiverAvatar: string, type: CallType) => {
    if (!currentUser || !peer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const targetPeerId = `nxt-peer-${receiverId}`;
      const callId = Date.now().toString();
      
      const callData: CallData = {
        id: callId,
        callerId: currentUser.id,
        callerName: currentUser.display_name || currentUser.username || 'User',
        callerAvatar: currentUser.avatar_url || '',
        receiverId,
        type,
        status: 'calling'
      };
      
      setCurrentCall(callData);
      setStatus('calling');

      // Publish active call signal to Firestore fallback
      setDoc(doc(db, 'active_calls', receiverId), {
        callId,
        callerId: currentUser.id,
        callerName: currentUser.display_name || currentUser.username || 'User',
        callerAvatar: currentUser.avatar_url || '',
        receiverId,
        type,
        status: 'calling',
        timestamp: Date.now()
      }).catch(() => {});

      // Setup data channel for signaling rejection/end and files
      dataConnectionRef.current = peer.connect(targetPeerId, { label: 'fileTransfer', reliable: true });
      dataConnectionRef.current.on('data', (data: any) => {
        handleReceiveMessage({ data });
      });

      // Call
      const call = peer.call(targetPeerId, stream, {
        metadata: {
          callId,
          callerId: currentUser.id,
          callerName: currentUser.display_name || currentUser.username || 'User',
          callerAvatar: currentUser.avatar_url || '',
          type
        }
      });
      
      callConnectionRef.current = call;

      call.on('stream', (remoteStream) => {
        stopPhoneRing();
        setRemoteStream(remoteStream);
        setStatus('connected');
      });

      call.on('close', () => {
        handleCallEnded();
      });

      call.on('error', () => {
        toast.error('Peer connection issue, using network signaling...');
      });

      // FCM fallback if peer is offline / closed app
      triggerNotification(
        receiverId,
        `Incoming ${type} call`,
        `from ${currentUser.display_name || currentUser.username || 'Friend'}`,
        { type: 'call', callId, callerId: currentUser.id, callerName: currentUser.display_name }
      );
      
    } catch (err: any) {
      toast.error('Failed to start call: ' + err.message);
      handleCallEnded();
    }
  };

  const acceptCall = async () => {
    stopPhoneRing();
    if (!currentCall || !currentUser) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: currentCall.type === 'video' });
      setLocalStream(stream);
      localStreamRef.current = stream;

      if (callConnectionRef.current) {
        callConnectionRef.current.answer(stream);
      }
      setStatus('connected');
      deleteDoc(doc(db, 'active_calls', currentUser.id)).catch(() => {});
    } catch (err: any) {
      toast.error('Failed to accept call: ' + err.message);
      rejectCall();
    }
  };

  const rejectCall = async () => {
    stopPhoneRing();
    if (currentCall && peer) {
      const targetPeerId = `nxt-peer-${currentCall.callerId}`;
      const conn = peer.connect(targetPeerId, { label: 'fileTransfer' });
      conn.on('open', () => {
        conn.send({ type: 'call_rejected' });
        setTimeout(() => conn.close(), 1000);
      });
    }
    if (currentUser) {
      deleteDoc(doc(db, 'active_calls', currentUser.id)).catch(() => {});
    }
    handleCallEnded();
  };

  const endCall = async () => {
    stopPhoneRing();
    if (currentCall && peer) {
      const targetPeerId = `nxt-peer-${currentCall.callerId === currentUser?.id ? currentCall.receiverId : currentCall.callerId}`;
      if (dataConnectionRef.current && dataConnectionRef.current.open) {
        dataConnectionRef.current.send({ type: 'call_ended' });
      } else {
        const conn = peer.connect(targetPeerId, { label: 'fileTransfer' });
        conn.on('open', () => {
          conn.send({ type: 'call_ended' });
          setTimeout(() => conn.close(), 1000);
        });
      }
    }
    handleCallEnded();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setIsMuted(!audioTracks[0].enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setIsVideoOff(!videoTracks[0].enabled);
      }
    }
  };

  const sendFile = async (file: File) => {
    if (!dataConnectionRef.current) {
      toast.error('Data channel not open');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      // Note: PeerJS handles ArrayBuffer directly, chunking might be needed for large files
      // For simplicity in this demo, sending directly.
      dataConnectionRef.current?.send({
        type: 'file',
        fileName: file.name,
        fileData: arrayBuffer
      });
      toast.success(`Sent file: ${file.name}`);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <CallContext.Provider value={{
      status, currentCall, localStream, remoteStream, startCall, acceptCall, rejectCall, endCall, toggleMute, toggleVideo, isMuted, isVideoOff, sendFile, receivedFiles
    }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
