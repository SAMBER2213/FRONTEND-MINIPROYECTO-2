/**
 * useWebRTC.js
 * Screen share: stream separado mostrado localmente + enviado via PeerJS
 * con metadata isScreen:true para que los remotos lo identifiquen.
 * Fix iconos: isMuted/isCameraOff desde peer_registered.
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
  const [localStream,     setLocalStream]     = useState(null)
  const [screenStream,    setScreenStream]    = useState(null)   // mi pantalla local
  const [remoteStreams,   setRemoteStreams]    = useState([])
  const [isMuted,         setIsMuted]         = useState(initialMuted)
  const [isCameraOff,     setIsCameraOff]     = useState(initialCameraOff)
  const [mediaError,      setMediaError]      = useState('')
  const [peerReady,       setPeerReady]       = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const peerRef          = useRef(null)
  const localStreamRef   = useRef(null)
  const screenStreamRef  = useRef(null)
  const callsRef         = useRef(new Map())   // peerId → call (video)
  const screenCallsRef   = useRef(new Map())   // peerId → call (screen)
  const mountedRef       = useRef(true)
  const isMutedRef       = useRef(initialMuted)
  const isCameraOffRef   = useRef(initialCameraOff)

  // ─── Add/remove remote streams ────────────────────────────────
  const addRemoteStream = useCallback((peerId, uid, displayName, stream, photoURL, isScreen, rMuted, rCamOff) => {
    if (!mountedRef.current) return
    setRemoteStreams((prev) => {
      const key = isScreen ? `${peerId}-screen` : peerId
      if (prev.find((s) => s.key === key)) return prev
      return [...prev, {
        key, peerId, uid, displayName, stream,
        isMuted:    isScreen ? false : (rMuted   ?? false),
        isCameraOff:isScreen ? false : (rCamOff  ?? false),
        photoURL:   photoURL || null,
        isScreen,
      }]
    })
  }, [])

  const removeRemoteStream = useCallback((peerId, isScreen) => {
    if (!mountedRef.current) return
    const key = isScreen ? `${peerId}-screen` : peerId
    setRemoteStreams((prev) => prev.filter((s) => s.key !== key))
    if (isScreen) screenCallsRef.current.delete(peerId)
    else callsRef.current.delete(peerId)
  }, [])

  // ─── Call peer for video ──────────────────────────────────────
  const callPeer = useCallback((peerId, uid, displayName, photoURL, rMuted, rCamOff) => {
    const peer   = peerRef.current
    const stream = localStreamRef.current
    if (!peer || !stream || callsRef.current.has(peerId) || peerId === peer.id) return
    const call = peer.call(peerId, stream, {
      metadata: { uid: myUid, displayName: myDisplayName, photoURL: myPhotoURL, isScreen: false },
    })
    if (!call) return
    callsRef.current.set(peerId, call)
    call.on('stream', (s) => addRemoteStream(peerId, uid, displayName, s, photoURL, false, rMuted, rCamOff))
    call.on('close',  () => removeRemoteStream(peerId, false))
    call.on('error',  () => removeRemoteStream(peerId, false))
  }, [myUid, myDisplayName, myPhotoURL, addRemoteStream, removeRemoteStream])

  // ─── Call peer for screen ─────────────────────────────────────
  const callPeerScreen = useCallback((peerId) => {
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

  // ─── Init ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !socket || !roomId || !myUid) return
    mountedRef.current = true

    const init = async () => {
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          if (mountedRef.current) setMediaError('Cámara no disponible. Solo audio.')
        } catch {
          if (mountedRef.current) setMediaError('No se pudo acceder a cámara ni micrófono.')
          return
        }
      }
      if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return }

      stream.getAudioTracks().forEach((t) => { t.enabled = !initialMuted })
      stream.getVideoTracks().forEach((t) => { t.enabled = !initialCameraOff })
      localStreamRef.current = stream
      setLocalStream(stream)
      isMutedRef.current     = initialMuted
      isCameraOffRef.current = initialCameraOff

      const peer = new Peer(undefined, { config: { iceServers: ICE_SERVERS }, debug: 1 })
      peerRef.current = peer

      peer.on('open', (peerId) => {
        if (!mountedRef.current) return
        registerPeer(socket, roomId, peerId, myDisplayName, myPhotoURL)
        socket.emit('media_state_change', { roomId, isMuted: initialMuted, isCameraOff: initialCameraOff })
        setPeerReady(true)
      })

      peer.on('call', (call) => {
        if (!localStreamRef.current) return
        // Always answer with localStream regardless of call type
        call.answer(localStreamRef.current)
        const isScreen   = call.metadata?.isScreen    || false
        const callerUid  = call.metadata?.uid         || call.peer
        const callerName = call.metadata?.displayName || callerUid
        const callerPhoto= call.metadata?.photoURL    || null
        call.on('stream', (s) => addRemoteStream(call.peer, callerUid, callerName, s, callerPhoto, isScreen, false, false))
        call.on('close',  () => removeRemoteStream(call.peer, isScreen))
        call.on('error',  () => removeRemoteStream(call.peer, isScreen))
        if (isScreen) screenCallsRef.current.set(call.peer, call)
        else callsRef.current.set(call.peer, call)
      })

      peer.on('error', (err) => {
        if (!mountedRef.current) return
        if (err.type !== 'peer-unavailable') setMediaError(`Error P2P: ${err.type}`)
      })
      peer.on('disconnected', () => { peer?.reconnect() })
    }

    init()

    return () => {
      mountedRef.current = false
      callsRef.current.forEach((c) => c.close()); callsRef.current.clear()
      screenCallsRef.current.forEach((c) => c.close()); screenCallsRef.current.clear()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      peerRef.current?.destroy(); peerRef.current = null
      setLocalStream(null); setScreenStream(null)
      setRemoteStreams([]); setIsScreenSharing(false); setPeerReady(false)
    }
  }, [enabled, socket, roomId, myUid, initialCameraOff, initialMuted, addRemoteStream, removeRemoteStream]) // eslint-disable-line

  // ─── Socket events ────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !peerReady) return

    const onPeerRegistered = ({ uid, peerId, displayName, photoURL, isMuted: rM, isCameraOff: rC }) => {
      if (uid === myUid) return
      callPeer(peerId, uid, displayName, photoURL, rM ?? false, rC ?? false)
      // If I'm sharing screen, send it to the new peer
      if (screenStreamRef.current) callPeerScreen(peerId)
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
        prev.map((s) => (s.uid === uid && !s.isScreen) ? { ...s, isMuted: muted, isCameraOff: camOff } : s)
      )
    }

    socket.on('peer_registered',    onPeerRegistered)
    socket.on('participant_left',   onParticipantLeft)
    socket.on('media_state_update', onMediaStateUpdate)
    return () => {
      socket.off('peer_registered',    onPeerRegistered)
      socket.off('participant_left',   onParticipantLeft)
      socket.off('media_state_update', onMediaStateUpdate)
    }
  }, [socket, peerReady, myUid, callPeer, callPeerScreen, removeRemoteStream])

  const callExistingPeers = useCallback((participants) => {
    participants.forEach(({ uid, peerId, displayName, photoURL, isMuted: rM, isCameraOff: rC }) => {
      if (uid === myUid || !peerId) return
      callPeer(peerId, uid, displayName, photoURL, rM ?? false, rC ?? false)
    })
  }, [myUid, callPeer])

  // ─── Toggles ──────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newMuted = !isMutedRef.current
    stream.getAudioTracks().forEach((t) => { t.enabled = !newMuted })
    isMutedRef.current = newMuted
    setIsMuted(newMuted)
    socket?.emit('media_state_change', { roomId, isMuted: newMuted, isCameraOff: isCameraOffRef.current })
  }, [socket, roomId])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newCamOff = !isCameraOffRef.current
    stream.getVideoTracks().forEach((t) => { t.enabled = !newCamOff })
    isCameraOffRef.current = newCamOff
    setIsCameraOff(newCamOff)
    socket?.emit('media_state_change', { roomId, isMuted: isMutedRef.current, isCameraOff: newCamOff })
  }, [socket, roomId])

  // ─── Screen share ─────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    try {
      const sStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' }, audio: false,
      })
      screenStreamRef.current = sStream
      setScreenStream(sStream)
      setIsScreenSharing(true)
      socket?.emit('screen_share_change', { roomId, isSharingScreen: true })

      // Send screen to all currently connected peers
      callsRef.current.forEach((_, peerId) => callPeerScreen(peerId))

      sStream.getVideoTracks()[0].addEventListener('ended', () => stopScreenShare())
    } catch (err) {
      if (err.name !== 'NotAllowedError') setMediaError('No se pudo compartir pantalla.')
    }
  }, [socket, roomId, callPeerScreen]) // eslint-disable-line

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    screenCallsRef.current.forEach((c) => c.close())
    screenCallsRef.current.clear()
    setScreenStream(null)
    setIsScreenSharing(false)
    socket?.emit('screen_share_change', { roomId, isSharingScreen: false })
  }, [socket, roomId])

  return {
    localStream, screenStream, remoteStreams,
    isMuted, isCameraOff, mediaError, peerReady,
    toggleMute, toggleCamera, callExistingPeers,
    isScreenSharing, startScreenShare, stopScreenShare,
  }
}
