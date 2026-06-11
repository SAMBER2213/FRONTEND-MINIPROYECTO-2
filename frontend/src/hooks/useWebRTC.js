/**
 * useWebRTC.js — Sprint 4 (TS-03, US-12)
 *
 * Hook que maneja toda la lógica WebRTC + PeerJS.
 * Recibe initialCameraOff / initialMuted desde el PreJoinModal
 * y aplica esos valores al stream en cuanto lo obtiene.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import { registerPeer } from '../services/realtime'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export function useWebRTC({ socket, roomId, myUid, enabled, initialCameraOff = false, initialMuted = false }) {
  const [localStream,   setLocalStream]   = useState(null)
  const [remoteStreams, setRemoteStreams]  = useState([])
  // Inicializar desde las preferencias del modal
  const [isMuted,      setIsMuted]        = useState(initialMuted)
  const [isCameraOff,  setIsCameraOff]    = useState(initialCameraOff)
  const [mediaError,   setMediaError]     = useState('')
  const [peerReady,    setPeerReady]      = useState(false)

  const peerRef        = useRef(null)
  const localStreamRef = useRef(null)
  const callsRef       = useRef(new Map())
  const mountedRef     = useRef(true)

  // ─── Agregar stream remoto ──────────────────────────────────────
  const addRemoteStream = useCallback((peerId, uid, displayName, stream) => {
    if (!mountedRef.current) return
    setRemoteStreams((prev) => {
      const exists = prev.find((s) => s.peerId === peerId)
      if (exists) return prev
      return [...prev, { peerId, uid, displayName, stream, isMuted: false, isCameraOff: false }]
    })
  }, [])

  const removeRemoteStream = useCallback((peerId) => {
    if (!mountedRef.current) return
    setRemoteStreams((prev) => prev.filter((s) => s.peerId !== peerId))
    callsRef.current.delete(peerId)
  }, [])

  // ─── Llamar a un peer ──────────────────────────────────────────
  const callPeer = useCallback((peerId, uid, displayName) => {
    const peer   = peerRef.current
    const stream = localStreamRef.current
    if (!peer || !stream || callsRef.current.has(peerId) || peerId === peer.id) return

    const call = peer.call(peerId, stream, { metadata: { uid: myUid, displayName } })
    if (!call) return
    callsRef.current.set(peerId, call)

    call.on('stream', (remoteStream) => addRemoteStream(peerId, uid, displayName, remoteStream))
    call.on('close',  () => removeRemoteStream(peerId))
    call.on('error',  () => removeRemoteStream(peerId))
  }, [myUid, addRemoteStream, removeRemoteStream])

  // ─── Inicializar cuando enabled=true ─────────────────────────
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
          if (mountedRef.current) setMediaError('No se pudo acceder a cámara ni micrófono. Verifica los permisos.')
          return
        }
      }

      if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return }

      // ── Aplicar preferencias del modal de pre-entrada ──────────
      stream.getAudioTracks().forEach((t) => { t.enabled = !initialMuted })
      stream.getVideoTracks().forEach((t) => { t.enabled = !initialCameraOff })

      localStreamRef.current = stream
      setLocalStream(stream)
      // Reflejar estado inicial en el hook
      setIsMuted(initialMuted)
      setIsCameraOff(initialCameraOff)

      peer = new Peer(undefined, {
        config: { iceServers: ICE_SERVERS },
        debug: 1,
      })
      peerRef.current = peer

      peer.on('open', (peerId) => {
        if (!mountedRef.current) return
        registerPeer(socket, roomId, peerId)
        setPeerReady(true)
      })

      peer.on('call', (call) => {
        if (!localStreamRef.current) return
        call.answer(localStreamRef.current)
        const callerUid         = call.metadata?.uid         || call.peer
        const callerDisplayName = call.metadata?.displayName || callerUid

        call.on('stream', (remoteStream) => addRemoteStream(call.peer, callerUid, callerDisplayName, remoteStream))
        call.on('close',  () => removeRemoteStream(call.peer))
        call.on('error',  () => removeRemoteStream(call.peer))
        callsRef.current.set(call.peer, call)
      })

      peer.on('error', (err) => {
        if (mountedRef.current) {
          if (err.type === 'network' || err.type === 'server-error') {
            setMediaError('Error conectando con el servidor P2P. Verifica tu conexión.')
          } else if (err.type === 'peer-unavailable') {
            console.warn('[PeerJS] Peer no disponible.')
          } else {
            setMediaError(`Error P2P: ${err.type}`)
          }
        }
      })

      peer.on('disconnected', () => { peer?.reconnect() })
    }

    init()

    return () => {
      mountedRef.current = false
      callsRef.current.forEach((call) => call.close())
      callsRef.current.clear()
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      peerRef.current?.destroy()
      peerRef.current = null
      setLocalStream(null)
      setRemoteStreams([])
      setPeerReady(false)
    }
  }, [enabled, socket, roomId, myUid, initialCameraOff, initialMuted, addRemoteStream, removeRemoteStream]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Escuchar eventos Socket.io ───────────────────────────────
  useEffect(() => {
    if (!socket || !peerReady) return

    const onPeerRegistered = ({ uid, peerId, displayName }) => {
      if (uid === myUid) return
      callPeer(peerId, uid, displayName)
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

  // ─── Llamar peers existentes ──────────────────────────────────
  const callExistingPeers = useCallback((participants) => {
    participants.forEach(({ uid, peerId, displayName }) => {
      if (uid === myUid || !peerId) return
      callPeer(peerId, uid, displayName)
    })
  }, [myUid, callPeer])

  // ─── Toggle mute ──────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newMuted = !isMuted
    stream.getAudioTracks().forEach((t) => { t.enabled = !newMuted })
    setIsMuted(newMuted)
    socket?.emit('media_state_change', { roomId, isMuted: newMuted, isCameraOff })
  }, [isMuted, isCameraOff, socket, roomId])

  // ─── Toggle cámara ────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newCamOff = !isCameraOff
    stream.getVideoTracks().forEach((t) => { t.enabled = !newCamOff })
    setIsCameraOff(newCamOff)
    socket?.emit('media_state_change', { roomId, isMuted, isCameraOff: newCamOff })
  }, [isCameraOff, isMuted, socket, roomId])

  return {
    localStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    mediaError,
    peerReady,
    toggleMute,
    toggleCamera,
    callExistingPeers,
  }
}
