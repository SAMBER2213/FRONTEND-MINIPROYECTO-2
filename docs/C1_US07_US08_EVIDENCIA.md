# C1 — US-07/US-08: Editar, eliminar y unirse a salas

## Qué cubre

- US-07: el anfitrión puede editar una sala creada por él.
- US-07: el anfitrión puede eliminar una sala creada por él.
- US-07: invitados no pueden editar ni eliminar salas. La API responde `403` si lo intentan.
- US-08: un usuario autenticado puede unirse pegando un ID/código válido.
- US-08: salas privadas exigen el código corto válido compartido por el anfitrión.

## Cambios implementados

### Frontend

- `src/pages/Rooms.jsx`
  - Formulario "Unirse a una sala" con validación de ID/código.
  - Formulario inline para editar sala.
  - Botones Editar/Eliminar visibles solo para anfitrión.
  - Mensajes de error y éxito con `role="alert"` / `role="status"`.
- `src/pages/RoomDetail.jsx`
  - Conserva el código validado en `sessionStorage` para que salas privadas puedan conectar por WebSocket.
  - Muestra si el usuario entró como anfitrión o invitado.
- `src/services/api.js`
  - El join ya no fuerza mayúsculas sobre todo el valor, para permitir ID Firestore además del código corto.

### Backend

- `main-api/src/controllers/roomController.ts`
  - Validaciones estrictas para nombre, descripción, privacidad y capacidad.
  - `PUT /api/rooms/:roomId`: solo anfitrión, devuelve sala actualizada completa.
  - `DELETE /api/rooms/:roomId`: solo anfitrión y elimina también mensajes de la subcolección.
  - `GET /api/rooms/join/:roomCode`: acepta código corto o ID Firestore. En sala privada, invitado solo entra con código corto válido.
  - `GET /api/rooms/:roomId`: oculta `roomCode` a invitados en salas privadas si no lo validaron por join.
- `main-api/src/routes/rooms.ts`
  - Swagger actualizado para documentar el flujo de unión por ID/código.

## Pruebas sugeridas para capturas

1. Como Usuario A, crear una sala privada y capturar la tarjeta con ID único visible.
2. Como Usuario A, editar nombre/descripción/capacidad y capturar el antes/después.
3. Como Usuario B, pegar el ID/código válido en "Unirse a una sala" y capturar la entrada a la sala.
4. Como Usuario B, verificar que no aparecen botones Editar/Eliminar.
5. Intento negativo: Usuario B entra con un ID/código inválido y aparece mensaje de error.
6. Intento negativo API: Usuario B intenta `PUT` o `DELETE /api/rooms/:roomId` de una sala que no creó y recibe `403`.

## Comandos ejecutados

```bash
# Frontend
npm run build
npm run lint

# Backend main-api
npm run build

# Realtime server
npm run build
```
