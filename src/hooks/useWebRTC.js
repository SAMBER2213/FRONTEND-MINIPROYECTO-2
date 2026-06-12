/**
 * useWebRTC.js — con Screen Share, fix inicial de media state,
 * y notificaciones de join/leave.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import { registerPeer } from '../services/realtime'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export function useWebRTC({
  socket, roomId, myUid, enabled,
  initialCameraOff = false, initialMuted = false,
  myDisplayName, myPhotoURL,
}) {
  const [localStream,       setLocalStream]       = useState(null)
  const [remoteStreams,     setRemoteStreams]      = useState([])
  const [isMuted,           setIsMuted]           = useState(initialMuted)
  const [isCameraOff,       setIsCameraOff]       = useState(initialCameraOff)
  const [mediaError,        setMediaError]        = useState('')
  const [peerReady,         setPeerReady]         = useState(false)
  const [isScreenSharing,   setIsScreenSharing]   = useState(false)
  const [screenStream,      setScreenStream]      = useState(null)

  const peerRef           = useRef(null)
  const localStreamRef    = useRef(null)
  const screenStreamRef   = useRef(null)
  const callsRef          = useRef(new Map())
  const screenCallsRef    = useRef(new Map())  // peerId → screen call
  const mountedRef        = useRef(true)
  // refs for isMuted/isCameraOff to avoid stale closures in socket handler
  const isMutedRef        = useRef(initialMuted)
  const isCameraOffRef    = useRef(initialCameraOff)

  // Sync initial media state selected before joining the room
  useEffect(() => {
    setIsMuted(initialMuted)
    setIsCameraOff(initialCameraOff)
    isMutedRef.current = initialMuted
    isCameraOffRef.current = initialCameraOff
  }, [initialMuted, initialCameraOff])

  const addRemoteStream = useCallback((peerId, uid, displayName, stream, photoURL, isScreen = false) => {
    if (!mountedRef.current) return
    setRemoteStreams((prev) => {
      if (isScreen) {
        const existing = prev.find((s) => s.peerId === peerId && s.isScreen)
        if (existing) return prev
        return [...prev, { peerId, uid, displayName, stream, isMuted: false, isCameraOff: false, photoURL: photoURL || null, isScreen: true }]
      }
      const exists = prev.find((s) => s.peerId === peerId && !s.isScreen)
      if (exists) return prev
      return [...prev, { peerId, uid, displayName, stream, isMuted: false, isCameraOff: false, photoURL: photoURL || null, isScreen: false }]
    })
  }, [])

  const removeRemoteStream = useCallback((peerId, isScreen = false) => {
    if (!mountedRef.current) return
    setRemoteStreams((prev) => prev.filter((s) => !(s.peerId === peerId && s.isScreen === isScreen)))
    if (isScreen) screenCallsRef.current.delete(peerId)
    else callsRef.current.delete(peerId)
  }, [])

  const callPeer = useCallback((peerId, uid, displayName, photoURL) => {
    const peer   = peerRef.current
    const stream = localStreamRef.current
    if (!peer || !stream || callsRef.current.has(peerId) || peerId === peer.id) return

    const call = peer.call(peerId, stream, {
      metadata: { uid: myUid, displayName: myDisplayName, photoURL: myPhotoURL, isScreen: false },
    })
    if (!call) return
    callsRef.current.set(peerId, call)
    call.on('stream', (remoteStream) => addRemoteStream(peerId, uid, displayName, remoteStream, photoURL, false))
    call.on('close',  () => removeRemoteStream(peerId, false))
    call.on('error',  () => removeRemoteStream(peerId, false))
  }, [myUid, myDisplayName, myPhotoURL, addRemoteStream, removeRemoteStream])

  // Share screen with a single existing peer
  const callPeerWithScreen = useCallback((peerId, uid, displayName, photoURL) => {
    const peer   = peerRef.current
    const stream = screenStreamRef.current
    if (!peer || !stream || screenCallsRef.current.has(peerId) || peerId === peer.id) return

    const call = peer.call(peerId, stream, {
      metadata: { uid: myUid, displayName: myDisplayName, photoURL: myPhotoURL, isScreen: true },
    })
    if (!call) return
    screenCallsRef.current.set(peerId, call)
    call.on('close',  () => screenCallsRef.current.delete(peerId))
    call.on('error',  () => screenCallsRef.current.delete(peerId))
  }, [myUid, myDisplayName, myPhotoURL])

  /* ── Init ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!enabled || !socket || !roomId || !myUid) return
    mountedRef.current = true
    let peer = null

    const init = async () => {
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          if (mountedRef.current) setMediaError('Cámara no disponible. Conectado solo con audio.')
        } catch {
          if (mountedRef.current) {
            setMediaError('No se pudo acceder a cámara ni micrófono.')
            // Reflejar visualmente que no hay mic ni cámara disponibles
            setIsMuted(true)
            setIsCameraOff(true)
            isMutedRef.current = true
            isCameraOffRef.current = true
            socket?.emit('media_state_change', { roomId, isMuted: true, isCameraOff: true })
          }
          return
        }
      }

      if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return }

      stream.getAudioTracks().forEach((t) => { t.enabled = !initialMuted })
      stream.getVideoTracks().forEach((t) => { t.enabled = !initialCameraOff })

      localStreamRef.current = stream
      setLocalStream(stream)
      setIsMuted(initialMuted)
      setIsCameraOff(initialCameraOff)
      isMutedRef.current    = initialMuted
      isCameraOffRef.current = initialCameraOff

      peer = new Peer(undefined, { config: { iceServers: ICE_SERVERS }, debug: 1 })
      peerRef.current = peer

      peer.on('open', (peerId) => {
        if (!mountedRef.current) return
        registerPeer(socket, roomId, peerId, myDisplayName, myPhotoURL)
        // Emit initial media state so others see correct icons
        socket.emit('media_state_change', {
          roomId,
          isMuted: initialMuted,
          isCameraOff: initialCameraOff,
        })
        setPeerReady(true)
      })

      peer.on('call', (call) => {
        if (!localStreamRef.current) return
        const callerUid         = call.metadata?.uid         || call.peer
        const callerDisplayName = call.metadata?.displayName || callerUid
        const callerPhotoURL    = call.metadata?.photoURL    || null
        const callerIsScreen    = call.metadata?.isScreen    || false

        // Answer with appropriate stream
        if (callerIsScreen) {
          call.answer(new MediaStream()) // dummy answer for screen stream
        } else {
          call.answer(localStreamRef.current)
        }

        call.on('stream', (remoteStream) =>
          addRemoteStream(call.peer, callerUid, callerDisplayName, remoteStream, callerPhotoURL, callerIsScreen)
        )
        call.on('close',  () => removeRemoteStream(call.peer, callerIsScreen))
        call.on('error',  () => removeRemoteStream(call.peer, callerIsScreen))

        if (callerIsScreen) screenCallsRef.current.set(call.peer, call)
        else callsRef.current.set(call.peer, call)
      })

      peer.on('error', (err) => {
        if (!mountedRef.current) return
        if (err.type === 'peer-unavailable') console.warn('[PeerJS] Peer no disponible.')
        else setMediaError(`Error P2P: ${err.type}`)
      })
      peer.on('disconnected', () => { peer?.reconnect() })
    }

    init()

    return () => {
      mountedRef.current = false
      callsRef.current.forEach((c) => c.close())
      callsRef.current.clear()
      screenCallsRef.current.forEach((c) => c.close())
      screenCallsRef.current.clear()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      peerRef.current?.destroy()
      peerRef.current = null
      setLocalStream(null)
      setRemoteStreams([])
      setScreenStream(null)
      setIsScreenSharing(false)
      setPeerReady(false)
    }
  }, [enabled, socket, roomId, myUid, initialCameraOff, initialMuted, addRemoteStream, removeRemoteStream]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Socket events ────────────────────────────────────────────── */
  useEffect(() => {
    if (!socket || !peerReady) return

    const onPeerRegistered = ({ uid, peerId, displayName, photoURL }) => {
      if (uid === myUid) return
      callPeer(peerId, uid, displayName, photoURL)
      // If we are sharing screen, also call the new peer with screen
      if (screenStreamRef.current && screenCallsRef.current && !screenCallsRef.current.has(peerId)) {
        callPeerWithScreen(peerId, uid, displayName, photoURL)
      }
    }

    const onParticipantLeft = ({ peerId }) => {
      if (!peerId) return
      callsRef.current.get(peerId)?.close()
      removeRemoteStream(peerId, false)
      screenCallsRef.current.get(peerId)?.close()
      removeRemoteStream(peerId, true)
    }

    const onMediaStateUpdate = ({ uid, isMuted: muted, isCameraOff: camOff }) => {
      setRemoteStreams((prev) =>
        prev.map((s) => s.uid === uid && !s.isScreen ? { ...s, isMuted: muted, isCameraOff: camOff } : s)
      )
    }

    const onScreenShareStarted = ({ uid, displayName }) => {
      // Visual notification handled in RoomDetail via socket event
    }

    socket.on('peer_registered',     onPeerRegistered)
    socket.on('participant_left',    onParticipantLeft)
    socket.on('media_state_update',  onMediaStateUpdate)
    socket.on('screen_share_started', onScreenShareStarted)

    return () => {
      socket.off('peer_registered',     onPeerRegistered)
      socket.off('participant_left',    onParticipantLeft)
      socket.off('media_state_update',  onMediaStateUpdate)
      socket.off('screen_share_started', onScreenShareStarted)
    }
  }, [socket, peerReady, myUid, callPeer, callPeerWithScreen, removeRemoteStream])

  const callExistingPeers = useCallback((participants) => {
    participants.forEach(({ uid, peerId, displayName, photoURL }) => {
      if (uid === myUid || !peerId) return
      callPeer(peerId, uid, displayName, photoURL)
    })
  }, [myUid, callPeer])

  /* ── Toggle mute ──────────────────────────────────────────────── */
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newMuted = !isMutedRef.current
    stream.getAudioTracks().forEach((t) => { t.enabled = !newMuted })
    isMutedRef.current = newMuted
    setIsMuted(newMuted)
    socket?.emit('media_state_change', { roomId, isMuted: newMuted, isCameraOff: isCameraOffRef.current })
  }, [socket, roomId])

  /* ── Toggle cámara ────────────────────────────────────────────── */
  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newCamOff = !isCameraOffRef.current
    stream.getVideoTracks().forEach((t) => { t.enabled = !newCamOff })
    isCameraOffRef.current = newCamOff
    setIsCameraOff(newCamOff)
    socket?.emit('media_state_change', { roomId, isMuted: isMutedRef.current, isCameraOff: newCamOff })
  }, [socket, roomId])

  /* ── Screen share ─────────────────────────────────────────────── */
  const startScreenShare = useCallback(async () => {
    try {
      const sStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      })

      screenStreamRef.current = sStream
      setScreenStream(sStream)
      setIsScreenSharing(true)

      socket?.emit('screen_share_started', { roomId, displayName: myDisplayName })

      // Call all existing peers with screen stream
      const peer = peerRef.current
      if (peer) {
        callsRef.current.forEach((_, peerId) => {
          // find uid/displayName from remoteStreams — we just need peerId
          if (!screenCallsRef.current.has(peerId)) {
            const call = peer.call(peerId, sStream, {
              metadata: { uid: myUid, displayName: myDisplayName, photoURL: myPhotoURL, isScreen: true },
            })
            if (call) {
              screenCallsRef.current.set(peerId, call)
              call.on('close',  () => screenCallsRef.current.delete(peerId))
              call.on('error',  () => screenCallsRef.current.delete(peerId))
            }
          }
        })
      }

      // When user stops sharing via browser UI
      sStream.getVideoTracks()[0].onended = () => {
        stopScreenShare()
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError') setMediaError('No se pudo compartir pantalla.')
    }
  }, [socket, roomId, myUid, myDisplayName, myPhotoURL]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null

    screenCallsRef.current.forEach((c) => c.close())
    screenCallsRef.current.clear()

    setScreenStream(null)
    setIsScreenSharing(false)
    setRemoteStreams((prev) => prev.filter((s) => !(s.uid === myUid && s.isScreen)))

    socket?.emit('screen_share_stopped', { roomId, displayName: myDisplayName })
  }, [socket, roomId, myUid, myDisplayName])

  console.log('[DEBUG]', { initialMuted, initialCameraOff, isMuted, isCameraOff, enabled, peerReady })

  return {
    localStream, remoteStreams,
    isMuted, isCameraOff,
    mediaError, peerReady,
    toggleMute, toggleCamera,
    callExistingPeers,
    isScreenSharing, screenStream,
    startScreenShare, stopScreenShare,
  }
}