# C3 - US-11 Historial de Chat en Firestore

## Objetivo
Cumplir el criterio C3: los mensajes del chat no solo se ven en tiempo real, tambien quedan persistidos en Firestore y se recuperan al entrar o recargar la sala.

## Implementacion

### Frontend
- `src/pages/RoomDetail.jsx` carga el historial con `GET /api/rooms/:roomId/messages` al abrir la sala.
- Si hay mensajes guardados, se renderizan antes de iniciar el envio de nuevos mensajes.
- Al recibir un mensaje nuevo por WebSocket, la UI lo agrega sin duplicarlo.
- El chat informa si el historial fue cargado desde Firestore.
- Para salas privadas, el frontend envia el `roomCode` validado al endpoint de historial.

### Backend
- `main-api/src/controllers/roomController.ts` recupera los mensajes desde `rooms/{roomId}/messages` ordenados por `createdAt`.
- `realtime-server/src/handlers/chatHandler.ts` guarda cada mensaje en Firestore antes de emitirlo a la sala.
- Los mensajes incluyen `id`, `roomId`, `senderUid`, `senderName`, `text`, `createdAt`, `persistedAt` y `storagePath`.
- Si Firestore falla, el mensaje no se emite como guardado y el cliente recibe `message_failed`.

## Evidencia sugerida
1. Enviar varios mensajes desde dos navegadores dentro de la misma sala.
2. Capturar Firestore en `rooms/{roomId}/messages` mostrando los documentos creados.
3. Recargar la pagina de la sala y capturar que los mensajes vuelven a aparecer.
4. Capturar el texto de estado: `Historial Firestore cargado`.

## Pruebas tecnicas ejecutadas

```bash
# Frontend
npm run lint
npm run build

# Backend main-api
npm run build

# Backend realtime-server
npm run build
```
