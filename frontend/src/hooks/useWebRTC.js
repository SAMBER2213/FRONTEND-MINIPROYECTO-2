/**
 * useWebRTC.js — Sprint 4 (TS-03, US-12)
 *
 * Hook que maneja toda la lógica WebRTC + PeerJS:
 *   1. Obtiene la config ICE (STUN + ExpressTURN) del servidor.
 *   2. Pide permiso de cámara/micrófono al navegador.
 *   3. Crea el Peer de PeerJS y lo registra en el servidor.
 *   4. Llama a los peers existentes y responde llamadas entrantes.
 *   5. Expone streams remotos para que VideoGrid los muestre (US-09).
 *   6. Maneja mute/cámara y sincroniza el estado con el servidor.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'
import { getIceServers, registerPeer } from '../services/realtime'
import { REALTIME_URL } from '../services/realtime'

// Extrae host y puerto del REALTIME_URL para configurar PeerJS
function parsePeerConfig(url) {
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 3002),
      secure: parsed.protocol === 'https:',
    }
  } catch {
    return { host: 'localhost', port: 3002, secure: false }
  }
}

export function useWebRTC({ socket, roomId, myUid, enabled }) {
  const [localStream, setLocalStream]     = useState(null)
  const [remoteStreams, setRemoteStreams]  = useState([]) // [{ peerId, uid, displayName, stream }]
  const [isMuted, setIsMuted]             = useState(false)
  const [isCameraOff, setIsCameraOff]     = useState(false)
  const [mediaError, setMediaError]       = useState('')
  const [peerReady, setPeerReady]         = useState(false)

  const peerRef        = useRef(null)
  const localStreamRef = useRef(null)
  const callsRef       = useRef(new Map()) // peerId → MediaConnection
  const mountedRef     = useRef(true)

  // ─── Agregar stream remoto ────────────────────────────────────────
  const addRemoteStream = useCallback((peerId, uid, displayName, stream) => {
    if (!mountedRef.current) return
    setRemoteStreams((prev) => {
      const exists = prev.find((s) => s.peerId === peerId)
      if (exists) return prev
      return [...prev, { peerId, uid, displayName, stream }]
    })
  }, [])

  const removeRemoteStream = useCallback((peerId) => {
    if (!mountedRef.current) return
    setRemoteStreams((prev) => prev.filter((s) => s.peerId !== peerId))
    callsRef.current.delete(peerId)
  }, [])

  // ─── Llamar a un peer ─────────────────────────────────────────────
  const callPeer = useCallback((peerId, uid, displayName) => {
    const peer   = peerRef.current
    const stream = localStreamRef.current
    if (!peer || !stream || callsRef.current.has(peerId)) return

    console.log(`[WebRTC] Llamando a ${displayName} (${peerId})`)
    const call = peer.call(peerId, stream, { metadata: { uid: myUid } })
    callsRef.current.set(peerId, call)

    call.on('stream', (remoteStream) => {
      addRemoteStream(peerId, uid, displayName, remoteStream)
    })
    call.on('close', () => removeRemoteStream(peerId))
    call.on('error', () => removeRemoteStream(peerId))
  }, [myUid, addRemoteStream, removeRemoteStream])

  // ─── Inicializar PeerJS ───────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !socket || !roomId || !myUid) return

    mountedRef.current = true
    let peer = null

    const init = async () => {
      // 1. Obtener ICE servers del backend (STUN + ExpressTURN)
      let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
      try {
        iceServers = await getIceServers(socket)
        console.log('[WebRTC] ICE servers recibidos:', iceServers)
      } catch {
        console.warn('[WebRTC] No se pudo obtener ICE servers, usando STUN por defecto')
      }

      // 2. Pedir acceso a cámara y micrófono
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch (err) {
        // Si el navegador deniega, intentar solo audio
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          if (mountedRef.current) setMediaError('Cámara no disponible. Conectado solo con audio.')
        } catch {
          if (mountedRef.current) setMediaError('No se pudo acceder a cámara ni micrófono. Verifica los permisos.')
          return
        }
      }

      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return }

      localStreamRef.current = stream
      setLocalStream(stream)

      // 3. Crear Peer PeerJS apuntando al servidor propio
      const { host, port, secure } = parsePeerConfig(REALTIME_URL)
      peer = new Peer(undefined, {
        host,
        port,
        path: '/peerjs',
        secure,
        config: { iceServers },
        debug: 1,
      })
      peerRef.current = peer

      // 4. Cuando PeerJS asigna un ID, registrarlo en el servidor
      peer.on('open', (peerId) => {
        if (!mountedRef.current) return
        console.log(`[PeerJS] Peer listo con ID: ${peerId}`)
        registerPeer(socket, roomId, peerId)
        setPeerReady(true)
      })

      // 5. Responder llamadas entrantes
      peer.on('call', (call) => {
        if (!localStreamRef.current) return
        call.answer(localStreamRef.current)
        const callerUid = call.metadata?.uid || call.peer

        call.on('stream', (remoteStream) => {
          addRemoteStream(call.peer, callerUid, callerUid, remoteStream)
        })
        call.on('close', () => removeRemoteStream(call.peer))
        callsRef.current.set(call.peer, call)
      })

      peer.on('error', (err) => {
        console.error('[PeerJS] Error:', err)
        if (mountedRef.current) setMediaError(`Error de conexión P2P: ${err.type}`)
      })
    }

    init()

    return () => {
      mountedRef.current = false
      // Cerrar todas las llamadas activas
      callsRef.current.forEach((call) => call.close())
      callsRef.current.clear()
      // Detener stream local
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      // Destruir peer
      peerRef.current?.destroy()
      peerRef.current = null
      setLocalStream(null)
      setRemoteStreams([])
      setPeerReady(false)
    }
  }, [enabled, socket, roomId, myUid, addRemoteStream, removeRemoteStream])

  // ─── Escuchar eventos Socket.io de PeerJS ────────────────────────
  useEffect(() => {
    if (!socket || !peerReady) return

    // Nuevo participante registró su peer → llamarlo
    const onPeerRegistered = ({ uid, peerId, displayName }) => {
      if (uid === myUid) return
      callPeer(peerId, uid, displayName)
    }

    // Participante salió → cerrar su stream
    const onParticipantLeft = ({ peerId }) => {
      if (peerId) {
        callsRef.current.get(peerId)?.close()
        removeRemoteStream(peerId)
      }
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

  // ─── Llamar a participantes que ya estaban en la sala ────────────
  // Se activa cuando room_joined llega con participantes que ya tienen peerId
  const callExistingPeers = useCallback((participants) => {
    participants.forEach(({ uid, peerId, displayName }) => {
      if (uid === myUid || !peerId) return
      callPeer(peerId, uid, displayName)
    })
  }, [myUid, callPeer])

  // ─── Toggle mute ─────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const newMuted = !isMuted
    stream.getAudioTracks().forEach((t) => { t.enabled = !newMuted })
    setIsMuted(newMuted)
    socket?.emit('media_state_change', { roomId, isMuted: newMuted, isCameraOff })
  }, [isMuted, isCameraOff, socket, roomId])

  // ─── Toggle cámara ───────────────────────────────────────────────
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