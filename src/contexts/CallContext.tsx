import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { collection, doc, setDoc, onSnapshot, updateDoc, query, where, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected';
type CallType = 'audio' | 'video';

interface CallData {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  type: CallType;
  status: 'calling' | 'answered' | 'rejected' | 'ended';
  offer?: any;
  answer?: any;
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

const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
  ]
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<CallStatus>('idle');
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<{ name: string, url: string }[]>([]);

  const pc = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Stop media tracks
  const stopMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  // Setup Peer Connection
  const setupPeerConnection = () => {
    if (pc.current) pc.current.close();
    pc.current = new RTCPeerConnection(servers);

    pc.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.current?.addTrack(track, localStreamRef.current!);
      });
    }

    pc.current.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      receiveChannel.onmessage = handleReceiveMessage;
    };
  };

  let receiveBuffer: ArrayBuffer[] = [];
  let receivedSize = 0;
  let fileMeta: { name: string, size: number, type: string } | null = null;

  const handleReceiveMessage = (event: MessageEvent) => {
    if (typeof event.data === 'string') {
      try {
        const meta = JSON.parse(event.data);
        if (meta.type === 'file-meta') {
          fileMeta = meta;
          receiveBuffer = [];
          receivedSize = 0;
          toast.success(`Receiving file: ${meta.name}`);
        }
      } catch (e) {
        // Normal text message
      }
    } else {
      receiveBuffer.push(event.data);
      receivedSize += event.data.byteLength;
      if (fileMeta && receivedSize === fileMeta.size) {
        const blob = new Blob(receiveBuffer, { type: fileMeta.type });
        const url = URL.createObjectURL(blob);
        setReceivedFiles(prev => [...prev, { name: fileMeta!.name, url }]);
        toast.success(`Received file: ${fileMeta.name}`);
        fileMeta = null;
      }
    }
  };

  const sendFile = async (file: File) => {
    if (!dataChannel.current || dataChannel.current.readyState !== 'open') {
      toast.error('Data channel is not open. Cannot send file.');
      return;
    }

    const meta = { type: 'file-meta', name: file.name, size: file.size, fileType: file.type };
    dataChannel.current.send(JSON.stringify(meta));

    const chunkSize = 16384;
    let offset = 0;

    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          dataChannel.current!.send(e.target.result as ArrayBuffer);
          offset += (e.target.result as ArrayBuffer).byteLength;
          if (offset < file.size) {
            readSlice(offset);
          } else {
            toast.success(`Sent file: ${file.name}`);
            resolve();
          }
        }
      };
      reader.onerror = reject;

      const readSlice = (o: number) => {
        const slice = file.slice(offset, o + chunkSize);
        reader.readAsArrayBuffer(slice);
      };
      readSlice(0);
    });
  };

  // Listen for incoming calls
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', currentUser.id),
      where('status', '==', 'calling')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const callDoc = { id: change.doc.id, ...change.doc.data() } as CallData;
          setCurrentCall(callDoc);
          setStatus('ringing');
          toast(`Incoming ${callDoc.type} call from ${callDoc.callerName}`, { duration: 10000 });
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Handle Caller signaling changes
  useEffect(() => {
    if (status === 'calling' && currentCall) {
      const unsub = onSnapshot(doc(db, 'calls', currentCall.id), async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'answered' && data.answer) {
          const rtcSessionDescription = new RTCSessionDescription(data.answer);
          if (pc.current && pc.current.signalingState !== 'stable') {
            await pc.current.setRemoteDescription(rtcSessionDescription);
            setStatus('connected');
          }
        } else if (data.status === 'rejected' || data.status === 'ended') {
          cleanupCall();
          toast.error(data.status === 'rejected' ? 'Call rejected' : 'Call ended');
        }
      });

      // Listen for ICE candidates
      const answerCandidatesUnsub = onSnapshot(collection(db, 'calls', currentCall.id, 'answerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.current?.addIceCandidate(candidate);
          }
        });
      });

      return () => {
        unsub();
        answerCandidatesUnsub();
      };
    }
  }, [status, currentCall]);

  // Handle Callee signaling changes
  useEffect(() => {
    if (status === 'connected' && currentCall && currentCall.receiverId === currentUser?.id) {
      const unsub = onSnapshot(doc(db, 'calls', currentCall.id), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        if (data.status === 'ended') {
          cleanupCall();
          toast('Call ended by remote user');
        }
      });
      return () => unsub();
    }
  }, [status, currentCall, currentUser]);

  const cleanupCall = async () => {
    if (currentCall && status !== 'idle') {
      try {
        await updateDoc(doc(db, 'calls', currentCall.id), { status: 'ended' });
      } catch (e) {}
    }
    pc.current?.close();
    pc.current = null;
    stopMedia();
    setStatus('idle');
    setCurrentCall(null);
    setRemoteStream(null);
    setReceivedFiles([]);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const startCall = async (receiverId: string, receiverName: string, receiverAvatar: string, type: CallType) => {
    if (!currentUser) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      setLocalStream(stream);
      localStreamRef.current = stream;

      setupPeerConnection();

      // Create data channel
      dataChannel.current = pc.current!.createDataChannel('fileTransfer');
      dataChannel.current.onmessage = handleReceiveMessage;

      const callDocRef = doc(collection(db, 'calls'));
      const callData: any = {
        callerId: currentUser.id,
        callerName: currentUser.display_name,
        callerAvatar: currentUser.avatar_url || '',
        receiverId,
        type,
        status: 'calling',
        createdAt: new Date().toISOString()
      };
      
      setCurrentCall({ id: callDocRef.id, ...callData });
      setStatus('calling');

      pc.current!.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(collection(callDocRef, 'offerCandidates'), event.candidate.toJSON());
        }
      };

      const offerDescription = await pc.current!.createOffer();
      await pc.current!.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await setDoc(callDocRef, { ...callData, offer });

    } catch (err: any) {
      toast.error('Failed to start call: ' + err.message);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!currentCall || !currentUser) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: currentCall.type === 'video' });
      setLocalStream(stream);
      localStreamRef.current = stream;

      setupPeerConnection();

      pc.current!.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(collection(db, 'calls', currentCall.id, 'answerCandidates'), event.candidate.toJSON());
        }
      };

      const callDocRef = doc(db, 'calls', currentCall.id);
      
      const offerDescription = currentCall.offer;
      await pc.current!.setRemoteDescription(new RTCSessionDescription(offerDescription));

      const answerDescription = await pc.current!.createAnswer();
      await pc.current!.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      await updateDoc(callDocRef, { answer, status: 'answered' });

      // Listen for caller ICE candidates
      onSnapshot(collection(callDocRef, 'offerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.current?.addIceCandidate(candidate);
          }
        });
      });

      setStatus('connected');
    } catch (err: any) {
      toast.error('Failed to accept call: ' + err.message);
      rejectCall();
    }
  };

  const rejectCall = async () => {
    if (currentCall) {
      await updateDoc(doc(db, 'calls', currentCall.id), { status: 'rejected' });
    }
    cleanupCall();
  };

  const endCall = async () => {
    cleanupCall();
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
