import { useEffect, useRef, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import { onAuthStateChanged } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query as firestoreQuery, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { Bell, ChevronRight, Clapperboard, Flame, Heart, Home, LogIn, LogOut, MessageCircle, Mic, MoreHorizontal, ScreenShare, Search, Send, Settings, Share2, Sparkles, Star, Users, Video, X, Zap } from 'lucide-react'
import { auth, db, firebaseAuth } from './firebase'
import { publishLiveStream, watchLiveStream } from './live'
import './styles.css'
import './live-stream.css'
import './screen-broadcast.css'

const screenStreamer = registerPlugin('ScreenStreamer')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}))
}

function Avatar({ initials, color = '#d7f04a', small = false }) {
  return <span className={`avatar ${small ? 'avatar--small' : ''}`} style={{ '--avatar-color': color }}>{initials}</span>
}

function App() {
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [activeTab, setActiveTab] = useState('For you')
  const [query, setQuery] = useState('')
  const [showHost, setShowHost] = useState(false)
  const [showScreenBroadcast, setShowScreenBroadcast] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)
  const [hostNotice, setHostNotice] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [mobileRoomOpen, setMobileRoomOpen] = useState(false)
  const [chat, setChat] = useState([])

  useEffect(() => {
    if (!db) return undefined
    return onSnapshot(collection(db, 'liveStreams'), (snapshot) => {
      const nextRooms = snapshot.docs.map((stream) => {
        const data = stream.data()
        return {
          id: stream.id,
          title: data.title,
          host: data.hostName || 'Live host',
          handle: `@${(data.hostName || 'host').toLowerCase().replaceAll(' ', '')}`,
          hostUid: data.hostUid,
          category: data.category || 'Live',
          status: data.status,
          viewers: data.viewerCount || 0,
          avatar: getInitials(data.hostName),
          accent: '#d7f04a',
          image: data.image || '',
          createdAt: data.createdAt,
        }
      }).filter((stream) => stream.status === 'live' && stream.title && stream.hostUid)
        .sort((left, right) => (right.createdAt?.seconds || 0) - (left.createdAt?.seconds || 0))
      setRooms(nextRooms)
      setActiveRoom((current) => nextRooms.find((room) => room.id === current?.id) || nextRooms[0] || null)
    }, (error) => setHostNotice(error.message || 'Could not load live rooms. Check Firestore rules.'))
  }, [])

  useEffect(() => {
    if (!auth) return undefined
    return onAuthStateChanged(auth, setUser)
  }, [])

  useEffect(() => {
    setChat([])
    if (!db || !activeRoom?.id) return undefined
    const messagesQuery = firestoreQuery(collection(db, 'liveStreams', activeRoom.id, 'messages'), orderBy('createdAt', 'asc'), limit(50))
    return onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map((message) => ({
        name: message.data().name || 'Viewer',
        text: message.data().text || '',
      })).filter((message) => message.text)
      if (messages.length) setChat(messages.map(({ name, text }) => [name, text]))
    }, () => {})
  }, [activeRoom?.id])

  const visibleRooms = rooms.filter((room) => `${room.title} ${room.host} ${room.category}`.toLowerCase().includes(query.toLowerCase()))
  const sendMessage = async (event) => {
    event.preventDefault()
    if (!message.trim()) return
    if (!user) {
      setShowAuth(true)
      return
    }
    if (!db || !activeRoom) return
    const text = message.trim()
    setMessage('')
    try {
      await addDoc(collection(db, 'liveStreams', activeRoom.id, 'messages'), {
        name: user.displayName || user.email?.split('@')[0] || 'Viewer',
        text,
        uid: user.uid,
        createdAt: serverTimestamp(),
      })
    } catch (error) {
      setHostNotice(error.message || 'Could not send chat message.')
    }
  }

  const openHost = () => {
    setHostNotice('')
    if (!user) {
      setShowAuth(true)
      return
    }
    setShowHost(true)
  }

  const openScreenBroadcast = () => {
    if (!user) {
      setShowAuth(true)
      return
    }
    setShowScreenBroadcast(true)
  }

  const selectRoom = (room) => {
    setActiveRoom(room)
    if (window.matchMedia('(max-width: 1120px)').matches) setMobileRoomOpen(true)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Zap size={15} fill="currentColor" /></span><span>PRAWIN</span></div>
        <nav className="main-nav">
          <p className="nav-label">Discover</p>
          {[['For you', Home], ['Following', Heart], ['Trending', Flame]].map(([label, Icon]) => <button key={label} className={activeTab === label ? 'nav-item is-active' : 'nav-item'} onClick={() => setActiveTab(label)}><Icon size={18} />{label}{label === 'Following' && <span className="nav-count">4</span>}</button>)}
          <p className="nav-label nav-label--spaced">Your space</p>
          <button className="nav-item" onClick={openHost}><Video size={18} />Go live</button>
          <button className="nav-item"><Star size={18} />Saved</button>
        </nav>
        <div className="sidebar-bottom"><div className="user-row"><Avatar initials={user ? getInitials(user.displayName || user.email) : '?'} color="#f2a66f" small /><span><strong>{user?.displayName || user?.email || 'Guest viewer'}</strong><small>{user ? (user.email || 'Signed in') : 'Sign in to host'}</small></span><MoreHorizontal size={17} /></div>{user ? <button className="nav-item" onClick={() => firebaseAuth.signOut()}><LogOut size={18} />Sign out</button> : <button className="nav-item" onClick={() => setShowAuth(true)}><LogIn size={18} />Sign in</button>}</div>
      </aside>

      <main className="content">
        <header className="topbar"><button className="mobile-brand"><span className="brand-mark"><Zap size={14} fill="currentColor" /></span>PRAWIN</button><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search live streams" /></div><div className="top-actions"><button className="icon-button notification-button" title="Notifications"><Bell size={19} /><i /></button><button className="icon-button screen-share-button" onClick={openScreenBroadcast} title="Share phone screen" aria-label="Share phone screen"><ScreenShare size={18} /></button><button className="host-button" onClick={openHost}><Clapperboard size={16} /> Go live</button><button className="profile-button" title={user ? 'Sign out' : 'Sign in'} onClick={() => user ? firebaseAuth.signOut() : setShowAuth(true)}><Avatar initials={user ? getInitials(user.displayName || user.email) : '?'} color="#f2a66f" small /></button></div></header>
        {hostNotice && <div className="host-notice" role="status">{hostNotice}<button onClick={() => setHostNotice('')} aria-label="Dismiss"><X size={16} /></button></div>}

        <div className="page-wrap">
          <section className="intro"><div><p className="eyebrow"><span className="pulse-dot" /> LIVE NOW <span className="eyebrow-divider" /> {rooms.reduce((sum, room) => sum + room.viewers, 0).toLocaleString()} watching</p><h1>PRAWIN <em>Gaming HUB</em></h1><p className="intro-copy">Real people, real time. Drop into something happening right now.</p></div><div className="tip"><Sparkles size={17} /><span><strong>New here?</strong><br />Start with a topic you love.</span></div></section>

          {rooms.length > 0 && (
            <section className="featured-layout"><button className="featured-card" onClick={() => selectRoom(rooms[0])}><img src={rooms[0]?.image} alt="Live stream" /><div className="featured-shade" /><span className="live-pill"><span className="pulse-dot" /> LIVE</span><span className="featured-viewers"><Users size={14} /> {rooms[0]?.viewers.toLocaleString()}</span><div className="featured-copy"><div className="category-tag">LIVE NOW</div><h2>{rooms[0]?.title}</h2><div className="host-line"><Avatar initials={rooms[0]?.avatar} color={rooms[0]?.accent} small /><span>{rooms[0]?.host} <small>{rooms[0]?.handle}</small></span><ChevronRight size={17} /></div></div></button><aside className="next-up"><div className="section-heading"><div><p className="eyebrow">UP NEXT</p><h3>Keep exploring</h3></div><button className="round-arrow" title="See all"><ChevronRight size={18} /></button></div>{rooms.slice(1, 3).map((room) => <button className="up-next-item" key={room.id} onClick={() => selectRoom(room)}><img src={room.image} alt="" /><div><span className="mini-live"><span className="pulse-dot" /> LIVE · {room.viewers}</span><strong>{room.title}</strong><small>{room.host} · {room.category}</small></div></button>)}</aside></section>
          )}
          {rooms.length === 0 && <section className="empty-live-state"><p className="eyebrow">LIVE CHANNELS</p><h2>No streams live right now</h2><p>Start a broadcast and viewers will see it appear here.</p><button className="primary-button" onClick={openHost}><Video size={16} /> Go live</button></section>}

          <section className="stream-section"><div className="section-heading"><div><p className="eyebrow">BROWSE ALL</p><h3>{activeTab === 'For you' ? 'Live now' : activeTab}</h3></div><span className="live-total">{rooms.length} live</span></div><div className="stream-grid">{visibleRooms.map((room) => <button className="stream-card" key={room.id} onClick={() => selectRoom(room)}><div className="card-image">{room.image && <img src={room.image} alt="" />}<span className="card-live"><span className="pulse-dot" /> LIVE</span><span className="card-viewers"><Users size={12} /> {room.viewers}</span></div><div className="card-info"><Avatar initials={room.avatar} color={room.accent} small /><div><strong>{room.title}</strong><span>{room.host} <b>·</b> {room.category}</span></div></div></button>)}</div></section>
        </div>
      </main>

      <aside className={mobileRoomOpen ? 'room-panel is-mobile-open' : 'room-panel'}><div className="room-header"><div><span className="room-live"><span className="pulse-dot" /> {activeRoom ? 'LIVE ROOM' : 'NO LIVE ROOM'}</span><h3>{activeRoom?.title || 'Choose a stream'}</h3></div><button className="icon-button mobile-room-close" onClick={() => setMobileRoomOpen(false)} title="Close room"><X size={19} /></button></div><div className="room-video">{activeRoom?.image && <img src={activeRoom.image} alt="Live stream cover" />}<StreamViewer room={activeRoom} user={user} onRequireAuth={() => setShowAuth(true)} onError={setHostNotice} /><div className="video-controls"><span><Users size={14} /> {activeRoom?.viewers?.toLocaleString() || 0}</span><button title="Share"><Share2 size={15} /></button></div></div>{activeRoom && <><div className="room-host"><Avatar initials={activeRoom.avatar} color={activeRoom.accent} /><div><strong>{activeRoom.host}</strong><span>{activeRoom.handle} · {activeRoom.category}</span></div><button className={isFollowing ? 'follow-button is-following' : 'follow-button'} onClick={() => setIsFollowing(!isFollowing)}>{isFollowing ? 'Following' : 'Follow'}</button></div><div className="room-tabs"><button className="room-tab is-active">Chat <span>{chat.length}</span></button><button className="room-tab">About</button></div><div className="chat-list">{chat.map(([name, text], index) => <div className="chat-line" key={`${name}-${index}`}><Avatar initials={getInitials(name)} color={name === 'You' ? '#f2a66f' : '#a8b09c'} small /><p><strong>{name}</strong>{text}</p></div>)}</div><form className="chat-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={user ? 'Say something...' : 'Sign in to chat'} /><button type="submit" title="Send message"><Send size={16} /></button></form></>}</aside>

      {showHost && <HostModal user={user} onClose={() => setShowHost(false)} />}
      {showScreenBroadcast && <ScreenBroadcastModal onClose={() => setShowScreenBroadcast(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}

function getInitials(value = '') { return value.split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?' }

function StreamViewer({ room, user, onRequireAuth, onError }) {
  const videoRef = useRef(null)
  const [state, setState] = useState('waiting')
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    setState('waiting')
    if (!room || room.hostUid === user?.uid) return undefined
    if (!user) return undefined
    if (!db) {
      setState('unavailable')
      return undefined
    }

    let stopWatching
    let cancelled = false
    watchLiveStream({
      db,
      streamId: room.id,
      userId: user.uid,
      videoElement: videoRef.current,
      onState: (nextState) => !cancelled && setState(nextState),
      onError: (error) => {
        if (!cancelled) {
          setState('unavailable')
          onError(error.message || 'Could not connect to this stream.')
        }
      },
    }).then((stop) => {
      if (cancelled) stop()
      else stopWatching = stop
    }).catch((error) => {
      if (!cancelled) {
        setState('unavailable')
        onError(error.message || 'Could not connect to this stream.')
      }
    })

    return () => {
      cancelled = true
      stopWatching?.()
    }
  }, [room?.id, room?.hostUid, user?.uid])

  if (room?.hostUid === user?.uid) return <div className="stream-state">Your broadcast is live in the host studio.</div>
  if (!user) return <button className="stream-state stream-state--action" onClick={onRequireAuth}>Sign in to watch live</button>

  return <>
    <video ref={videoRef} className="live-video" autoPlay muted={muted} playsInline />
    {state !== 'live' && <div className="stream-state">{state === 'unavailable' ? 'Stream unavailable' : state === 'reconnecting' ? 'Reconnecting...' : 'Connecting to live stream...'}</div>}
    {state === 'live' && muted && <button className="stream-sound" onClick={() => { setMuted(false); videoRef.current?.play().catch(() => {}) }}>Enable sound</button>}
  </>
}

function HostModal({ user, onClose }) {
  const [title, setTitle] = useState('')
  const [started, setStarted] = useState(false)
  const [mediaStream, setMediaStream] = useState(null)
  const [busy, setBusy] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [error, setError] = useState('')
  const publisherRef = useRef(null)
  const roomRef = useRef(null)
  const mediaRef = useRef(null)

  const cleanupBroadcast = async () => {
    await publisherRef.current?.()
    publisherRef.current = null
    mediaRef.current?.getTracks().forEach((track) => track.stop())
    const liveRoomRef = roomRef.current
    roomRef.current = null
    if (!liveRoomRef || !db) return
    const viewers = await getDocs(collection(db, 'liveStreams', liveRoomRef.id, 'viewers'))
    await Promise.all(viewers.docs.map((viewer) => deleteDoc(viewer.ref)))
    await deleteDoc(liveRoomRef)
  }

  useEffect(() => {
    mediaRef.current = mediaStream
  }, [mediaStream])

  useEffect(() => () => { cleanupBroadcast().catch(() => {}) }, [])

  const enableCamera = async () => {
    setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or localhost and a supported browser.')
      setMediaStream(await navigator.mediaDevices.getUserMedia({ video: true, audio: true }))
    } catch (mediaError) {
      setError(mediaError.message || 'Camera and microphone access was not granted.')
    }
  }

  const startStream = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (!db) throw new Error('Firebase Firestore is not configured.')
      if (!mediaStream) throw new Error('Enable your camera and microphone first.')
      const liveRoomRef = doc(collection(db, 'liveStreams'))
      await setDoc(liveRoomRef, {
        title: title.trim(),
        hostUid: user.uid,
        hostName: user.displayName || user.email?.split('@')[0] || 'Live host',
        category: 'Live',
        status: 'live',
        viewerCount: 0,
        createdAt: serverTimestamp(),
      })
      roomRef.current = liveRoomRef
      publisherRef.current = publishLiveStream({
        db,
        streamId: liveRoomRef.id,
        mediaStream,
        onViewerCount: (count) => {
          setViewerCount(count)
          updateDoc(liveRoomRef, { viewerCount: count }).catch((updateError) => setError(updateError.message))
        },
        onError: (publishError) => setError(publishError.message || 'A viewer connection failed.'),
      })
      setStarted(true)
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the streaming server.')
    } finally {
      setBusy(false)
    }
  }

  const endBroadcast = async () => {
    setBusy(true)
    try {
      await cleanupBroadcast()
      onClose()
    } catch (cleanupError) {
      setError(cleanupError.message || 'Could not end the broadcast cleanly.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && (started ? endBroadcast() : onClose())}><div className="modal"><button className="modal-close" onClick={started ? endBroadcast : onClose} title={started ? 'End broadcast' : 'Close'}><X size={18} /></button>{started ? <div className="success-state"><span className="success-icon"><Video size={22} /></span><h2>You are live.</h2><p>{title} · {viewerCount} watching</p><video className="host-preview" ref={(element) => { if (element && mediaStream && element.srcObject !== mediaStream) element.srcObject = mediaStream }} autoPlay muted playsInline />{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button" onClick={endBroadcast} disabled={busy}>{busy ? 'Ending broadcast...' : 'End broadcast'}</button></div> : <form onSubmit={startStream}><p className="eyebrow">CREATE A ROOM</p><h2>What are you sharing?</h2><p className="modal-copy">Set a title and check your camera before creating the live room.</p><label>Stream title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Sunday studio session" required /></label>{mediaStream ? <video ref={(element) => { if (element && element.srcObject !== mediaStream) element.srcObject = mediaStream }} className="host-preview" autoPlay muted playsInline /> : <button className="secondary-button camera-button" type="button" onClick={enableCamera}><Video size={16} /> Enable camera and mic</button>}{error && <p className="auth-error" role="alert">{error}</p>}<div className="modal-options"><span><Mic size={16} /> {mediaStream ? 'Camera & mic connected' : 'Camera & mic required'}</span><span><MessageCircle size={16} /> Real-time chat</span></div><button className="primary-button" type="submit" disabled={busy || !mediaStream}>{busy ? 'Starting broadcast...' : 'Go live'} <ChevronRight size={17} /></button></form>}</div></div>
}

const streamTargets = {
  youtube: {
    label: 'YouTube Live · landscape',
    server: 'rtmps://a.rtmps.youtube.com:443/live2',
    width: 1920,
    height: 1080,
    bitrate: 4500000,
    note: 'Create or schedule an encoder stream in YouTube Live Control Room, then paste its stream key.',
  },
  shorts: {
    label: 'YouTube vertical live · Shorts feed',
    server: 'rtmps://a.rtmps.youtube.com:443/live2',
    width: 1080,
    height: 1920,
    bitrate: 4500000,
    note: 'Schedule a vertical live in YouTube Live Control Room. Eligible vertical live streams may appear in the Shorts feed.',
  },
  instagram: {
    label: 'Instagram Live Producer',
    server: '',
    width: 720,
    height: 1280,
    bitrate: 3000000,
    note: 'Copy the server URL and stream key from Instagram Live Producer. Live Producer access depends on account eligibility.',
  },
}

function ScreenBroadcastModal({ onClose }) {
  const [target, setTarget] = useState('youtube')
  const [server, setServer] = useState(streamTargets.youtube.server)
  const [streamKey, setStreamKey] = useState('')
  const [audioMode, setAudioMode] = useState('device')
  const [broadcastState, setBroadcastState] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activeRef = useRef(false)
  const profile = streamTargets[target]

  useEffect(() => {
    let listener
    let disposed = false
    screenStreamer.addListener('broadcastStatus', (event) => {
      setBroadcastState(event.state)
      setStatusMessage(event.message || '')
      if (event.state === 'stopped' || event.state === 'error') activeRef.current = false
    }).then((nextListener) => {
      if (disposed) nextListener.remove()
      else listener = nextListener
    }).catch(() => {})
    return () => {
      disposed = true
      listener?.remove()
      if (activeRef.current && Capacitor.getPlatform() === 'android') screenStreamer.stopStream().catch(() => {})
    }
  }, [])

  const startBroadcast = async (event) => {
    event.preventDefault()
    setError('')
    if (Capacitor.getPlatform() !== 'android') {
      setError('Screen broadcasting is available in the Android app.')
      return
    }
    const cleanServer = server.trim().replace(/\/+$/, '')
    const cleanKey = streamKey.trim()
    if (!/^rtmps?:\/\//i.test(cleanServer) || !cleanKey) {
      setError('Enter the RTMP server URL and stream key supplied by your platform.')
      return
    }
    setBusy(true)
    setBroadcastState('permission')
    setStatusMessage('Waiting for Android screen-capture permission...')
    try {
      await screenStreamer.startStream({
        endpoint: `${cleanServer}/${cleanKey}`,
        audioMode,
        width: profile.width,
        height: profile.height,
        bitrate: profile.bitrate,
      })
      activeRef.current = true
      setBroadcastState('connecting')
      setStatusMessage('Screen capture approved. Connecting to the platform...')
      setStreamKey('')
    } catch (startError) {
      setBroadcastState('error')
      setStatusMessage('')
      setError(startError.message || 'Could not start screen broadcast.')
    } finally {
      setBusy(false)
    }
  }

  const stopBroadcast = async () => {
    setBusy(true)
    try {
      await screenStreamer.stopStream()
      activeRef.current = false
      setBroadcastState('stopped')
      setStatusMessage('Broadcast ended.')
    } catch (stopError) {
      setError(stopError.message || 'Could not stop the screen broadcast.')
    } finally {
      setBusy(false)
    }
  }

  const isActive = ['permission', 'connecting', 'live'].includes(broadcastState)
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && (isActive ? stopBroadcast() : onClose())}>
    <div className="modal screen-broadcast-modal">
      <button className="modal-close" onClick={isActive ? stopBroadcast : onClose} title={isActive ? 'Stop and close' : 'Close'}><X size={18} /></button>
      <p className="eyebrow">ANDROID SCREEN BROADCAST</p>
      <h2>{isActive ? 'Screen is being shared' : 'Stream your screen'}</h2>
      <p className="modal-copy">Choose one destination, enter its RTMP credentials, then approve Android’s screen-capture prompt.</p>
      <form onSubmit={startBroadcast}>
        <label>Destination<select value={target} disabled={isActive || busy} onChange={(event) => { setTarget(event.target.value); setServer(streamTargets[event.target.value].server) }}>{Object.entries(streamTargets).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select></label>
        <p className="screen-target-note">{profile.note}</p>
        <label>RTMP server URL<input type="url" value={server} disabled={isActive || busy} onChange={(event) => setServer(event.target.value)} placeholder="rtmps://server.example/live" autoCapitalize="none" autoCorrect="off" required /></label>
        <label>Stream key<input type="password" value={streamKey} disabled={isActive || busy} onChange={(event) => setStreamKey(event.target.value)} placeholder={isActive ? 'Key cleared after start' : 'Paste stream key'} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" required={!isActive} /></label>
        <label>Audio source<select value={audioMode} disabled={isActive || busy} onChange={(event) => setAudioMode(event.target.value)}><option value="device">Device audio (Android 10+)</option><option value="microphone">Microphone</option></select></label>
        <p className="screen-stream-status" role="status">{statusMessage || `${profile.width} × ${profile.height} · ${(profile.bitrate / 1000000).toFixed(1)} Mbps`}</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {isActive ? <button className="primary-button stop-broadcast-button" type="button" onClick={stopBroadcast} disabled={busy}>{busy ? 'Stopping...' : 'Stop broadcast'}</button> : <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Preparing screen capture...' : 'Start screen broadcast'} <ScreenShare size={16} /></button>}
      </form>
      <p className="screen-key-warning">Stream keys are sensitive. They are not saved and are cleared from this form when streaming starts.</p>
    </div>
  </div>
}

function AuthModal({ onClose }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      if (mode === 'reset') await firebaseAuth.resetPassword(email)
      else if (mode === 'signup') await firebaseAuth.signUpWithEmail(email, password)
      else await firebaseAuth.signInWithEmail(email, password)
      if (mode !== 'reset') onClose()
    } catch (authError) { setError(authError.code?.replace('auth/', '').replaceAll('-', ' ') || 'Authentication failed') }
  }
  const signInGoogle = async () => { try { await firebaseAuth.signInWithGoogle(); onClose() } catch (authError) { setError(authError.code?.replace('auth/', '').replaceAll('-', ' ') || 'Google sign-in failed') } }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><p className="eyebrow">YOUR ACCOUNT</p><h2>{mode === 'reset' ? 'Reset your password' : mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2><p className="modal-copy">Sign in to host streams and keep your live-world preferences with you.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{mode !== 'reset' && <label>Password<input type="password" minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>}{error && <p className="auth-error">{error}</p>}<button className="primary-button" type="submit">{mode === 'reset' ? 'Send reset email' : mode === 'signup' ? 'Create account' : 'Sign in'}</button></form>{mode !== 'reset' && <><button className="secondary-button" onClick={signInGoogle}><LogIn size={15} /> Continue with Google</button><button className="auth-link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Already have an account? Sign in'}</button><button className="auth-link" onClick={() => setMode('reset')}>Forgot password?</button></>}{mode === 'reset' && <button className="auth-link" onClick={() => setMode('signin')}>Back to sign in</button>}</div></div>
}

export default App

createRoot(document.getElementById('root')).render(<App />)
