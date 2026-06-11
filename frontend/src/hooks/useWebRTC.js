/**
 * useWebRTC.js — Sprint 4 (TS-03, US-12)
 *
 * Hook que maneja toda la lógica WebRTC + PeerJS:
 *   1. Usa PeerJS Cloud (peerjs.com) como servidor de señalización — gratis, sin configurar nada.
 *   2. Pide permiso de cámara/micrófono al navegador.
 *   3. Crea el Peer de PeerJS y lo registra via Socket.io en el backend.
 *   4. Llama a los peers existentes y responde llamadas entrantes.
 *   5. Expone streams remotos para que VideoGrid los muestre (US-09).
 *   6. Maneja mute/cámara y sincroniza el estado con el servidor.
 *
 * Signaling: Socket.io (backend Render) — solo para intercambiar peerIds.
 * Media P2P: PeerJS Cloud (0.peerjs.com) — directo entre navegadores.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import { registerPeer } from '../services/realtime'

// ICE servers: STUN de Google (gratuito, sin configurar)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export function useWebRTC({ socket, roomId, myUid, enabled, initialCameraOff = false, initialMuted = false }) {
  const [localStream, setLocalStream]    = useState(null)
  const [remoteStreams, setRemoteStreams] = useState([]) // [{ peerId, uid, displayName, stream, isMuted, isCameraOff }]
  const [isMuted, setIsMuted]            = useState(initialMuted)
  const [isCameraOff, setIsCameraOff]    = useState(initialCameraOff)
  const [mediaError, setMediaError]      = useState('')
  const [peerReady, setPeerReady]        = useState(false)

  const peerRef        = useRef(null)
  const localStreamRef = useRef(null)
  const callsRef       = useRef(new Map()) // peerId → MediaConnection
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

    console.log(`[WebRTC] Llamando a ${displayName} (${peerId})`)
    const call = peer.call(peerId, stream, { metadata: { uid: myUid, displayName } })
    if (!call) return
    callsRef.current.set(peerId, call)

    call.on('stream', (remoteStream) => {
      addRemoteStream(peerId, uid, displayName, remoteStream)
    })
    call.on('close', () => removeRemoteStream(peerId))
    call.on('error', () => removeRemoteStream(peerId))
  }, [myUid, addRemoteStream, removeRemoteStream])

  // ─── Inicializar PeerJS con PeerJS Cloud ──────────────────────
  useEffect(() => {
    if (!enabled || !socket || !roomId || !myUid) return

    mountedRef.current = true
    let peer = null

    const init = async () => {
      // 1. Pedir acceso a cámara y micrófono
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          if (mountedRef.current) setMediaError('Cámara no disponible. Conectado solo con audio.')
        } catch {
          if (mountedRef.current) setMediaError('No se pudo acceder a cámara ni micrófono. Verifica los permisos del navegador.')
          return
        }
      }

      if (!mountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return }

      // Aplicar preferencias iniciales del modal de pre-entrada
      stream.getAudioTracks().forEach((t) => { t.enabled = !initialMuted })
      stream.getVideoTracks().forEach((t) => { t.enabled = !initialCameraOff })

      localStreamRef.current = stream
      setLocalStream(stream)

      // 2. Crear Peer usando PeerJS Cloud (0.peerjs.com) — gratis, sin configurar
      peer = new Peer(undefined, {
        config: { iceServers: ICE_SERVERS },
        debug: 1,
        // Sin host/port/path → usa PeerJS Cloud por defecto
      })
      peerRef.current = peer

      // 3. Cuando PeerJS Cloud asigna un ID, registrarlo via Socket.io
      peer.on('open', (peerId) => {
        if (!mountedRef.current) return
        console.log(`[PeerJS] Peer listo con ID: ${peerId}`)
        registerPeer(socket, roomId, peerId)
        setPeerReady(true)
      })

      // 4. Responder llamadas entrantes
      peer.on('call', (call) => {
        if (!localStreamRef.current) return
        call.answer(localStreamRef.current)
        const callerUid         = call.metadata?.uid         || call.peer
        const callerDisplayName = call.metadata?.displayName || callerUid

        call.on('stream', (remoteStream) => {
          addRemoteStream(call.peer, callerUid, callerDisplayName, remoteStream)
        })
        call.on('close', () => removeRemoteStream(call.peer))
        call.on('error', () => removeRemoteStream(call.peer))
        callsRef.current.set(call.peer, call)
      })

      peer.on('error', (err) => {
        console.error('[PeerJS] Error:', err.type, err)
        if (mountedRef.current) {
          if (err.type === 'network' || err.type === 'server-error') {
            setMediaError('Error conectando con el servidor P2P. Verifica tu conexión.')
          } else if (err.type === 'peer-unavailable') {
            console.warn('[PeerJS] Peer no disponible, puede que ya se desconectó.')
          } else {
            setMediaError(`Error P2P: ${err.type}`)
          }
        }
      })

      peer.on('disconnected', () => {
        console.warn('[PeerJS] Desconectado del servidor de señalización. Reconectando...')
        peer?.reconnect()
      })
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
  }, [enabled, socket, roomId, myUid, addRemoteStream, removeRemoteStream]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Escuchar eventos Socket.io ───────────────────────────────
  useEffect(() => {
    if (!socket || !peerReady) return

    // Nuevo participante registró su peer → llamarlo
    const onPeerRegistered = ({ uid, peerId, displayName }) => {
      if (uid === myUid) return
      callPeer(peerId, uid, displayName)
    }

    // Participante salió → cerrar su stream
    const onParticipantLeft = ({ peerId }) => {
      if (!peerId) return
      callsRef.current.get(peerId)?.close()
      removeRemoteStream(peerId)
    }

    // Actualización de estado de media (mute/cámara)
    const onMediaStateUpdate = ({ uid, isMuted: muted, isCameraOff: camOff }) => {
      setRemoteStreams((prev) =>
        prev.map((s) => s.uid === uid ? { ...s, isMuted: muted, isCameraOff: camOff } : s)
      )
    }

    socket.on('peer_registered', onPeerRegistered)
    socket.on('participant_left', onParticipantLeft)
    socket.on('media_state_update', onMediaStateUpdate)

    return () => {
      socket.off('peer_registered', onPeerRegistered)
      socket.off('participant_left', onParticipantLeft)
      socket.off('media_state_update', onMediaStateUpdate)
    }
  }, [socket, peerReady, myUid, callPeer, removeRemoteStream])

  // ─── Llamar a participantes que ya estaban en la sala ─────────
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
