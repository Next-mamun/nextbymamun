import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tv, Play, Pause, Volume2, VolumeX, Maximize, Lock, LockOpen, Mic, MicOff, Video as VideoIcon, VideoOff, MessageSquare, Send, Heart, Flame, Laugh, LogOut, ShieldAlert, Check, X } from 'lucide-react';
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube';
import Peer, { DataConnection } from 'peerjs';
import { toast } from 'sonner';

type PeerInfo = {
  peerId: string;
  name: string;
  username: string;
  avatar: string;
  isHost: boolean;
  isMuted: boolean;
};

type ChatMessage = {
  id: string;
  senderName: string;
  text: string;
  time: number;
};

type Reaction = {
  id: string;
  emoji: string;
  x: number;
};

type VideoItem = {
  id: string;
  url: string;
  addedBy: string;
};

const extractVideoId = (url: string) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

const Theatre = () => {
  const { currentUser } = useAuth();
  const [phase, setPhase] = useState<'entry' | 'lobby' | 'room'>('entry');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoErrorMsg, setVideoErrorMsg] = useState('');
  
  // WebRTC & State
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: DataConnection }>({});
  const mediaConnectionsRef = useRef<{ [key: string]: any }>({});
  
  const [peersList, setPeersList] = useState<PeerInfo[]>([]);
  const [peerQueue, setPeerQueue] = useState<string[]>([]); // Ordered list of peerIds
  
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState('');
  
  const [isLocked, setIsLocked] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<{ [key: string]: MediaStream }>({});
  
  // Cinema State
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [videoQueue, setVideoQueue] = useState<VideoItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Sync
  const baseStartTimeRef = useRef<number>(0);
  const isBufferingRef = useRef(false);
  
  // Chat & Reactions
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  // Local Media
  const localStreamRef = useRef<MediaStream | null>(null);

  // --- WebRTC Setup ---
  const initializePeer = (id?: string, isCreatingHost: boolean = false, targetHostId?: string) => {
    const peer = new Peer(id || undefined);
    peerRef.current = peer;

    peer.on('open', (assignedId) => {
      console.log('My peer ID is: ' + assignedId);
      if (isCreatingHost) {
        // I created the room
        setIsHost(true);
        setHostId(assignedId);
        setRoomCode(assignedId);
        setPeerQueue([assignedId]);
        addMeToPeersList(assignedId, true);
        setPhase('lobby');
      } else if (targetHostId) {
        // Attempting to join
        setIsHost(false);
        setHostId(targetHostId);
        setRoomCode(targetHostId);
        addMeToPeersList(assignedId, false);
        connectToHost(targetHostId);
        setPhase('lobby');
      }
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('call', (call) => {
      // Receiving voice call
      call.answer(localStreamRef.current || undefined);
      call.on('stream', (remoteStream) => {
        setRemoteAudioStreams(prev => ({ ...prev, [call.peer]: remoteStream }));
      });
    });

    peer.on('disconnected', () => {
      peer.reconnect();
    });

    peer.on('error', (err) => {
      console.error(err);
      toast.error('PeerJS Error: ' + err.message);
    });
  };

  const addMeToPeersList = (myId: string, amIHost: boolean) => {
    if (!currentUser) return;
    setPeersList([{
      peerId: myId,
      name: currentUser.display_name,
      username: currentUser.username,
      avatar: currentUser.avatar_url,
      isHost: amIHost,
      isMuted: isMicMuted
    }]);
  };

  // Connect to Host
  const connectToHost = (hId: string) => {
    if (!peerRef.current) return;
    const conn = peerRef.current.connect(hId, { reliable: true });
    setupConnection(conn);
  };

  const broadcastToAll = (data: any) => {
    Object.values(connectionsRef.current).forEach(conn => {
      if (conn.open) conn.send(data);
    });
  };

  const setupConnection = (conn: DataConnection) => {
    conn.on('open', () => {
      connectionsRef.current[conn.peer] = conn;
      
      // Send Identity
      if (currentUser) {
        conn.send({
          type: 'PEER_IDENTITY',
          user: {
            peerId: peerRef.current?.id,
            name: currentUser.display_name,
            username: currentUser.username,
            avatar: currentUser.avatar_url,
            isHost: isHost,
            isMuted: isMicMuted
          }
        });
      }

      // If I am host, send current state to the new peer
      if (isHost) {
        conn.send({
          type: 'SYNC_STATE',
          state: {
            videoId: currentVideoId,
            isPlaying,
            baseStartTime: baseStartTimeRef.current,
            queue: videoQueue,
            locked: isLocked,
            peerQueue: peerQueue,
            peersList: peersList
          }
        });
      }
    });

    conn.on('data', (data: any) => {
      handlePeerData(conn.peer, data);
    });

    conn.on('close', () => {
      handlePeerDisconnect(conn.peer);
    });
  };

  const handlePeerDisconnect = (peerId: string) => {
    delete connectionsRef.current[peerId];
    setPeersList(prev => prev.filter(p => p.peerId !== peerId));
    
    // Failover check
    setPeerQueue(prev => {
      const newQueue = prev.filter(id => id !== peerId);
      if (peerId === hostId) {
        // Host left! Who is next?
        const nextHostId = newQueue[0];
        setHostId(nextHostId);
        if (nextHostId === peerRef.current?.id) {
          setIsHost(true);
          toast.success("You are now the Host!");
        } else {
          toast.info("Host left. Migrating host to someone else...");
        }
      }
      return newQueue;
    });
  };

  const handlePeerData = (peerId: string, data: any) => {
    switch (data.type) {
      case 'PEER_IDENTITY':
        setPeersList(prev => {
          if (prev.find(p => p.peerId === data.user.peerId)) return prev;
          return [...prev, data.user];
        });
        setPeerQueue(prev => prev.includes(data.user.peerId) ? prev : [...prev, data.user.peerId]);
        break;
      case 'SYNC_STATE':
        setCurrentVideoId(data.state.videoId);
        setIsPlaying(data.state.isPlaying);
        baseStartTimeRef.current = data.state.baseStartTime;
        setVideoQueue(data.state.queue);
        setIsLocked(data.state.locked);
        setPeerQueue(data.state.peerQueue);
        
        // Sync player
        if (playerRef.current && data.state.isPlaying) {
          const targetTime = (Date.now() - data.state.baseStartTime) / 1000;
          playerRef.current.seekTo(targetTime, true);
          playerRef.current.playVideo();
        }
        break;
      case 'PLAY':
        if (!isHost && !isLocked) {
          setIsPlaying(true);
          baseStartTimeRef.current = data.baseStartTime;
          if (playerRef.current) {
            playerRef.current.seekTo((Date.now() - data.baseStartTime) / 1000, true);
            playerRef.current.playVideo();
          }
        }
        break;
      case 'PAUSE':
        if (!isHost && !isLocked) {
          setIsPlaying(false);
          if (playerRef.current) playerRef.current.pauseVideo();
        }
        break;
      case 'STATE_BUFFERING':
        if (isHost) {
          isBufferingRef.current = true;
          if (playerRef.current) playerRef.current.pauseVideo();
          toast('Someone is buffering, pausing temporarily...');
          setTimeout(() => {
            isBufferingRef.current = false;
            if (playerRef.current) playerRef.current.playVideo();
          }, 2000);
        }
        break;
      case 'CHAT_MSG':
        setChatMessages(prev => [...prev, data.msg]);
        break;
      case 'REACTION':
        triggerReaction(data.emoji);
        break;
      case 'ADMIN_MUTE_ALL':
        setIsMicMuted(true);
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
        }
        toast('Admin muted everyone.');
        break;
      case 'KICK':
        if (data.targetId === peerRef.current?.id) {
          toast.error("You have been kicked from the room.");
          leaveRoom();
        }
        break;
      case 'SYNC_REQUEST':
        if (isHost && playerRef.current) {
          const time = playerRef.current.getCurrentTime();
          baseStartTimeRef.current = Date.now() - (time * 1000);
          broadcastToAll({
            type: 'SYNC_STATE',
            state: {
              videoId: currentVideoId,
              isPlaying,
              baseStartTime: baseStartTimeRef.current,
              queue: videoQueue,
              locked: isLocked,
              peerQueue,
              peersList
            }
          });
        }
        break;
      case 'UPDATE_QUEUE':
        setVideoQueue(data.queue);
        break;
      case 'LOAD_VIDEO':
        setCurrentVideoId(data.videoId);
        break;
    }
  };

  // --- Core Methods ---
  const createTheatre = () => {
    const code = "NXT-" + (Date.now().toString(36).slice(-3) + Math.random().toString(36).slice(2, 5)).toUpperCase();
    initializePeer(code, true);
  };

  const joinTheatre = () => {
    if (!joinCode.startsWith('NXT-')) {
      toast.error("Invalid passcode");
      return;
    }
    initializePeer(undefined, false, joinCode);
  };

  const enterRoom = () => {
    setPhase('room');
    if (isHost && videoUrlInput) {
      const vId = extractVideoId(videoUrlInput);
      if (vId) {
         setCurrentVideoId(vId);
         broadcastToAll({ type: 'LOAD_VIDEO', videoId: vId });
      } else {
         setVideoErrorMsg("Invalid YouTube URL");
      }
    }
    // Setup Audio
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(t => t.enabled = !isMicMuted);
      
      // Call others
      Object.keys(connectionsRef.current).forEach(peerId => {
        const call = peerRef.current?.call(peerId, stream);
        if (call) {
          call.on('stream', remoteStream => {
            setRemoteAudioStreams(prev => ({ ...prev, [peerId]: remoteStream }));
          });
        }
      });
    }).catch(err => console.error("Mic access denied", err));
  };

  const leaveRoom = () => {
    Object.values(connectionsRef.current).forEach(c => c.close());
    peerRef.current?.destroy();
    setPhase('entry');
    setRoomCode('');
    setCurrentVideoId(null);
    setPeersList([]);
    setChatMessages([]);
  };

  // --- YouTube Handlers ---
  const onReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
    if (isPlaying) {
       event.target.playVideo();
    }
  };

  const onStateChange = (event: YouTubeEvent) => {
    // 1=playing, 2=paused, 3=buffering
    if (event.data === 1 && isHost && !isBufferingRef.current) {
       setIsPlaying(true);
       baseStartTimeRef.current = Date.now() - (event.target.getCurrentTime() * 1000);
       broadcastToAll({ type: 'PLAY', baseStartTime: baseStartTimeRef.current });
    } else if (event.data === 2 && isHost && !isBufferingRef.current) {
       setIsPlaying(false);
       broadcastToAll({ type: 'PAUSE' });
    } else if (event.data === 3 && !isHost) {
       broadcastToAll({ type: 'STATE_BUFFERING' });
    }
  };

  const onError = (event: YouTubeEvent) => {
    const errCode = event.data;
    if (errCode === 101 || errCode === 150) {
      setVideoErrorMsg("কপিরাইট বা এমবেড রেস্ট্রিকশনের কারণে এই ভিডিওটি সিনেমা হলে প্লে করা যাবে না। অন্য কোনো ইউটিউব লিংক দিন।");
    } else if (errCode === 2 || errCode === 5) {
      toast.error("ভিডিও না পাওয়া গেলে বা ডিলেট হয়ে গেছে।");
    }
  };

  // Auto-Sync Loop
  useEffect(() => {
    if (phase !== 'room' || !isPlaying || !playerRef.current) return;
    const interval = setInterval(() => {
      const time = playerRef.current!.getCurrentTime();
      const expectedTime = (Date.now() - baseStartTimeRef.current) / 1000;
      if (Math.abs(time - expectedTime) > 2) {
        console.log("Drift detected. Auto-correcting...");
        playerRef.current!.seekTo(expectedTime, true);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [phase, isPlaying]);

  // Document Visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && phase === 'room' && !isHost) {
        if (peerRef.current) {
          connectionsRef.current[hostId]?.send({ type: 'SYNC_REQUEST' });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase, isHost, hostId]);

  // Audio Ducking Logic
  useEffect(() => {
    if (playerRef.current) {
      const anyoneTalking = Object.values(remoteAudioStreams).length > 0; // simplistic check, ideally check volume levels
      // For now, if local mic is unmuted or there are remote streams, duck volume
      const isAudioActive = !isMicMuted; 
      playerRef.current.setVolume(isAudioActive ? 20 : 100);
    }
  }, [isMicMuted, remoteAudioStreams]);

  // --- Actions ---
  const sendReaction = (emoji: string) => {
    triggerReaction(emoji);
    broadcastToAll({ type: 'REACTION', emoji });
  };

  const triggerReaction = (emoji: string) => {
    const id = Math.random().toString();
    const x = Math.random() * 80 + 10; // 10% to 90%
    setReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = {
      id: Math.random().toString(),
      senderName: currentUser?.display_name || 'Anonymous',
      text: chatInput,
      time: Date.now()
    };
    setChatMessages(prev => [...prev, msg]);
    broadcastToAll({ type: 'CHAT_MSG', msg });
    setChatInput('');
  };

  const addVideoToQueue = () => {
    if (!videoUrlInput) return;
    const vId = extractVideoId(videoUrlInput);
    if (!vId) {
      toast.error('Invalid link'); return;
    }
    const newItem = { id: vId, url: videoUrlInput, addedBy: currentUser?.display_name || '' };
    const newQueue = [...videoQueue, newItem];
    setVideoQueue(newQueue);
    broadcastToAll({ type: 'UPDATE_QUEUE', queue: newQueue });
    setVideoUrlInput('');
  };

  const adminToggleMuteAll = () => {
    broadcastToAll({ type: 'ADMIN_MUTE_ALL' });
    toast.success('Muted everyone');
  };

  const adminKick = (pId: string) => {
    broadcastToAll({ type: 'KICK', targetId: pId });
  };

  // --- Render ---
  if (phase === 'entry') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f0f2f5] dark:bg-[#000000] p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 w-full max-w-md shadow-xl flex flex-col gap-6">
          <div className="flex justify-center mb-4 text-[#1877F2]">
            <Tv size={64} />
          </div>
          <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white">Cinema Hall</h1>
          <p className="text-center text-gray-500 mb-4">Watch videos together in perfect sync.</p>
          
          <button onClick={createTheatre} className="w-full bg-[#1877F2] text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors">
            Create Theatre
          </button>
          
          <div className="flex items-center gap-4 text-gray-400">
            <div className="h-px bg-gray-300 dark:bg-gray-700 flex-1"></div>
            <span>OR</span>
            <div className="h-px bg-gray-300 dark:bg-gray-700 flex-1"></div>
          </div>

          <div className="flex flex-col gap-2">
            <input 
              type="text" 
              placeholder="Enter Passcode (NXT-...)" 
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
            />
            <button onClick={joinTheatre} disabled={!joinCode} className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold text-lg disabled:opacity-50">
              Join with Passcode
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#000000] p-4 animate-in fade-in zoom-in duration-300">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 w-full max-w-xl shadow-xl flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Lobby</h2>
          
          {isHost && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex flex-col items-center gap-4">
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Your Invite Passcode</span>
              <div className="text-4xl font-black tracking-widest text-gray-900 dark:text-white">{roomCode}</div>
              <p className="text-xs text-gray-500">Share this code with friends to join.</p>
              
              <div className="w-full mt-4">
                <input 
                  type="text" 
                  placeholder="Paste YouTube Link to Start..." 
                  value={videoUrlInput}
                  onChange={e => {
                     setVideoUrlInput(e.target.value);
                     setVideoErrorMsg('');
                  }}
                  className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
                />
                {videoErrorMsg && <p className="text-red-500 text-sm mt-2 font-medium">{videoErrorMsg}</p>}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Participants ({peersList.length})</h3>
            <div className="flex flex-wrap gap-2">
              {peersList.map(p => (
                <div key={p.peerId} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
                  <img src={p.avatar} alt="a" className="w-6 h-6 rounded-full object-cover" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.name} {p.isHost && '(Host)'}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={enterRoom} className="w-full bg-[#1877F2] text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
            <Play size={20} /> Enter Cinema Hall
          </button>
        </div>
      </div>
    );
  }

  // Phase: Room
  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-black relative overflow-hidden">
      
      {/* Background Audio streams */}
      {Object.entries(remoteAudioStreams).map(([peerId, stream]) => (
         <audio key={peerId} autoPlay ref={audio => { if(audio) audio.srcObject = stream }} className="hidden" />
      ))}

      {/* Main Left: Video Area */}
      <div className="flex-1 flex flex-col relative h-[50vh] md:h-full">
        {currentVideoId ? (
          <div className="flex-1 relative w-full h-full pointer-events-none">
            <YouTube 
              videoId={currentVideoId} 
              opts={{
                width: '100%',
                height: '100%',
                playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0 }
              }}
              onReady={onReady}
              onStateChange={onStateChange}
              onError={onError}
              className="absolute inset-0 w-full h-full object-cover"
              iframeClassName="w-full h-full"
            />
            {/* Transparent overlay to block user clicks if locked */}
            <div className={`absolute inset-0 z-10 ${(!isHost && isLocked) ? 'block' : 'hidden'}`} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-4">
            <Tv size={64} className="opacity-20" />
            <p>Waiting for video...</p>
          </div>
        )}

        {/* Video Error Banner */}
        {videoErrorMsg && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white p-3 text-center text-sm font-medium z-50">
            {videoErrorMsg}
          </div>
        )}

        {/* Floating Reactions */}
        {reactions.map(r => (
          <div key={r.id} className="absolute bottom-20 animate-float-up text-4xl z-40 pointer-events-none" style={{ left: `${r.x}%` }}>
            {r.emoji}
          </div>
        ))}

        {/* Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent flex items-center justify-between z-20">
          <div className="flex gap-4">
            {(isHost || !isLocked) && (
              <button 
                onClick={() => {
                  if (isPlaying) { playerRef.current?.pauseVideo(); setIsPlaying(false); }
                  else { playerRef.current?.playVideo(); setIsPlaying(true); }
                }}
                className="text-white hover:text-blue-400 p-2"
              >
                {isPlaying ? <Pause size={28} /> : <Play size={28} />}
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
             <button onClick={() => sendReaction('❤️')} className="text-2xl hover:scale-125 transition-transform">❤️</button>
             <button onClick={() => sendReaction('😂')} className="text-2xl hover:scale-125 transition-transform">😂</button>
             <button onClick={() => sendReaction('🔥')} className="text-2xl hover:scale-125 transition-transform">🔥</button>
          </div>
        </div>
      </div>

      {/* Main Right: Sidebar (Chat & Admin) */}
      <div className="w-full md:w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-[50vh] md:h-full shrink-0">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h3 className="text-white font-bold text-lg">Cinema Hall</h3>
            <p className="text-xs text-gray-400">Passcode: {roomCode || hostId}</p>
          </div>
          <button onClick={leaveRoom} className="text-red-500 p-2 hover:bg-red-500/10 rounded-full">
            <LogOut size={20} />
          </button>
        </div>

        {/* Admin Panel */}
        {isHost && (
          <div className="p-4 border-b border-gray-800 bg-gray-800/50">
            <h4 className="text-xs text-gray-400 font-bold uppercase mb-3 flex items-center gap-1"><ShieldAlert size={14}/> Admin Controls</h4>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setIsLocked(!isLocked);
                  broadcastToAll({ type: 'SYNC_STATE', state: { videoId: currentVideoId, isPlaying, baseStartTime: baseStartTimeRef.current, queue: videoQueue, locked: !isLocked, peerQueue, peersList } });
                }} 
                className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${isLocked ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-white'}`}
              >
                {isLocked ? <Lock size={16} /> : <LockOpen size={16} />} Lock Controls
              </button>
              <button onClick={adminToggleMuteAll} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white font-medium">Mute All</button>
            </div>
            <div className="mt-3 flex gap-2">
              <input 
                type="text" 
                placeholder="Queue Video URL" 
                value={videoUrlInput}
                onChange={e => setVideoUrlInput(e.target.value)}
                className="flex-1 bg-gray-900 text-white text-xs px-3 rounded-lg outline-none"
              />
              <button onClick={addVideoToQueue} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold">+</button>
            </div>
          </div>
        )}

        {/* Participants & Queue Tabs */}
        <div className="p-3 border-b border-gray-800 flex gap-2 overflow-x-auto hide-scrollbar">
          {peersList.map(p => (
            <div key={p.peerId} className="relative group shrink-0">
              <img src={p.avatar} alt="avatar" className="w-10 h-10 rounded-full border-2 border-gray-700" />
              {p.isHost && <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5"><ShieldAlert size={10} className="text-white" /></div>}
              {isHost && p.peerId !== peerRef.current?.id && (
                <div className="absolute top-0 right-0 hidden group-hover:flex bg-red-600 rounded-full p-1 cursor-pointer z-10" onClick={() => adminKick(p.peerId)}>
                  <X size={12} className="text-white" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Local Chat */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {chatMessages.map(msg => (
            <div key={msg.id} className="text-sm">
              <span className="font-bold text-blue-400">{msg.senderName}: </span>
              <span className="text-gray-300">{msg.text}</span>
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className="p-4 border-t border-gray-800 bg-gray-900">
          <form onSubmit={sendChat} className="flex gap-2">
            <button 
              type="button" 
              onClick={() => {
                setIsMicMuted(!isMicMuted);
                if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = isMicMuted);
              }} 
              className={`p-3 rounded-full shrink-0 ${isMicMuted ? 'bg-red-500/20 text-red-500' : 'bg-gray-800 text-white'}`}
            >
              {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <input 
              type="text" 
              placeholder="Chat..." 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              className="flex-1 bg-gray-800 text-white rounded-full px-4 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </form>
        </div>
      </div>
    </div>
  );
};

export default Theatre;
