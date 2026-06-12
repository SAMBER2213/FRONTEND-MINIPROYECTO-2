/**
 * useWebRTC.js
 * Screen share: usa replaceTrack en la conexión PeerJS existente
 * en lugar de crear una segunda llamada (que causa conflictos).
 * Fix iconos: lee isMuted/isCameraOff del evento peer_registered.
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
  const [remoteStreams,   setRemoteStreams]    = useState([])
  const [isMuted,         setIsMuted]         = useState(initialMuted)
  const [isCameraOff,     setIsCameraOff]     = useState(initialCameraOff)
  const [mediaError,      setMediaError]      = useState('')
  const [peerReady,       setPeerReady]       = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const peerRef         = useRef(null)
  const localStreamRef  = useRef(null)
  const screenStreamRef = useRef(null)
  const callsRef        = useRef(new Map())  // peerId → PeerJS call object
  const mountedRef      = useRef(true)
  const isMutedRef      = useRef(initialMuted)
  const isCameraOffRef  = useRef(initialCameraOff)

  // ─── Remote streams ───────────────────────────────────────────
  const addRemoteStream = useCallback((peerId, uid, displayName, stream, photoURL, remoteMuted, remoteCamOff) => {
    if (!mountedRef.current) return
    setRemoteStreams((prev) => {
      if (prev.find((s) => s.peerId === peerId)) return prev
      return [...prev, {
        peerId, uid, displayName, stream,
        isMuted: remoteMuted ?? false,
        isCameraOff: remoteCamOff ?? false,
        photoURL: photoURL || null,
      }]
    })
  }, [])

  const removeRemoteStream = useCallback((peerId) => {
    if (!mountedRef.current) return
    setRemoteStreams((prev) => prev.filter((s) => s.peerId !== peerId))
    callsRef.current.delete(peerId)
  }, [])

  // ─── Call a peer ──────────────────────────────────────────────
  const callPeer = useCallback((peerId, uid, displayName, photoURL, remoteMuted, remoteCamOff) => {
    const peer   = peerRef.current
    const stream = localStreamRef.current
    if (!peer || !stream || callsRef.current.has(peerId) || peerId === peer.id) return

    const call = peer.call(peerId, stream, {
      metadata: { uid: myUid, displayName: myDisplayName, photoURL: myPhotoURL },
    })
    if (!call) return
    callsRef.current.set(peerId, call)
    call.on('stream', (remoteStream) =>
      addRemoteStream(peerId, uid, displayName, remoteStream, photoURL, remoteMuted, remoteCamOff)
    )
    call.on('close',  () => removeRemoteStream(peerId))
    call.on('error',  () => removeRemoteStream(peerId))
  }, [myUid, myDisplayName, myPhotoURL, addRemoteStream, removeRemoteStream])

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
      setIsMuted(initialMuted)
      setIsCameraOff(initialCameraOff)
      isMutedRef.current     = initialMuted
      isCameraOffRef.current = initialCameraOff

      const peer = new Peer(undefined, { config: { iceServers: ICE_SERVERS }, debug: 1 })
      peerRef.current = peer

      peer.on('open', (peerId) => {
        if (!mountedRef.current) return
        registerPeer(socket, roomId, peerId, myDisplayName, myPhotoURL)
        socket.emit('media_state_change', {
          roomId,
          isMuted: initialMuted,
          isCameraOff: initialCameraOff,
        })
        setPeerReady(true)
      })

      peer.on('call', (call) => {
        if (!localStreamRef.current) return
        call.answer(localStreamRef.current)
        const callerUid  = call.metadata?.uid         || call.peer
        const callerName = call.metadata?.displayName || callerUid
        const callerPhoto= call.metadata?.photoURL    || null
        call.on('stream', (remoteStream) =>
          addRemoteStream(call.peer, callerUid, callerName, remoteStream, callerPhoto, false, false)
        )
        call.on('close',  () => removeRemoteStream(call.peer))
        call.on('error',  () => removeRemoteStream(call.peer))
        callsRef.current.set(call.peer, call)
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
      callsRef.current.forEach((c) => c.close())
      callsRef.current.clear()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop())
        screenStreamRef.current = null
      }
      peerRef.current?.destroy()
      peerRef.current = null
      setLocalStream(null)
      setRemoteStreams([])
      setIsScreenSharing(false)
      setPeerReady(false)
    }
  }, [enabled, socket, roomId, myUid, initialCameraOff, initialMuted, addRemoteStream, removeRemoteStream]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Socket events ────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !peerReady) return

    const onPeerRegistered = ({ uid, peerId, displayName, photoURL, isMuted: rMuted, isCameraOff: rCamOff }) => {
      if (uid === myUid) return
      callPeer(peerId, uid, displayName, photoURL, rMuted ?? false, rCamOff ?? false)
    }

    const onParticipantLeft = ({ peerId }) => {
      if (!peerId) return
      callsRef.current.get(peerId)?.close()
      removeRemoteStream(peerId)
    }

    const onMediaStateUpdate = ({ uid, isMuted: muted, isCameraOff: camOff }) => {
      setRemoteStreams((prev) =>
        prev.map((s) => s.uid === uid ? { ...s, isMuted: muted, isCameraOff: camOff } : s)
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
  }, [socket, peerReady, myUid, callPeer, removeRemoteStream])

  const callExistingPeers = useCallback((participants) => {
    participants.forEach(({ uid, peerId, displayName, photoURL, isMuted: rMuted, isCameraOff: rCamOff }) => {
      if (uid === myUid || !peerId) return
      callPeer(peerId, uid, displayName, photoURL, rMuted ?? false, rCamOff ?? false)
    })
  }, [myUid, callPeer])

  // ─── Toggle mute ──────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newMuted = !isMutedRef.current
    stream.getAudioTracks().forEach((t) => { t.enabled = !newMuted })
    isMutedRef.current = newMuted
    setIsMuted(newMuted)
    socket?.emit('media_state_change', { roomId, isMuted: newMuted, isCameraOff: isCameraOffRef.current })
  }, [socket, roomId])

  // ─── Toggle camera ────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newCamOff = !isCameraOffRef.current
    stream.getVideoTracks().forEach((t) => { t.enabled = !newCamOff })
    isCameraOffRef.current = newCamOff
    setIsCameraOff(newCamOff)
    socket?.emit('media_state_change', { roomId, isMuted: isMutedRef.current, isCameraOff: newCamOff })
  }, [socket, roomId])

  // ─── Screen share via replaceTrack ────────────────────────────
  // En lugar de hacer una segunda llamada PeerJS (que causa conflictos),
  // reemplazamos el video track en TODAS las conexiones existentes.
  // Los remotos ven el stream de pantalla en el mismo tile de video.
  const startScreenShare = useCallback(async () => {
    try {
      const sStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      })

      const screenTrack = sStream.getVideoTracks()[0]
      screenStreamRef.current = sStream
      setIsScreenSharing(true)

      // Reemplazar el video track en todas las conexiones activas
      callsRef.current.forEach((call) => {
        const pc = call.peerConnection
        if (!pc) return
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video')
        if (sender) sender.replaceTrack(screenTrack).catch(() => {})
      })

      socket?.emit('screen_share_change', { roomId, isSharingScreen: true })

      // Cuando el usuario para desde el botón del navegador
      screenTrack.addEventListener('ended', () => stopScreenShare())
    } catch (err) {
      if (err.name !== 'NotAllowedError') setMediaError('No se pudo compartir pantalla.')
    }
  }, [socket, roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    setIsScreenSharing(false)

    // Restaurar el video track original de la cámara
    const camTrack = localStreamRef.current?.getVideoTracks()[0]
    if (camTrack) {
      callsRef.current.forEach((call) => {
        const pc = call.peerConnection
        if (!pc) return
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video')
        if (sender) sender.replaceTrack(camTrack).catch(() => {})
      })
    }

    socket?.emit('screen_share_change', { roomId, isSharingScreen: false })
  }, [socket, roomId])

  return {
    localStream, remoteStreams,
    isMuted, isCameraOff,
    mediaError, peerReady,
    toggleMute, toggleCamera,
    callExistingPeers,
    isScreenSharing,
    startScreenShare, stopScreenShare,
  }
}
