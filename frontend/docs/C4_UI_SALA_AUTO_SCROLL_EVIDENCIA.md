# C4 - Diseño UI Sala y Auto-scroll

## Objetivo de la rúbrica
Cumplir el criterio C4: interfaz de sala operativa, consistente y con scroll automático del chat.

## Cambios implementados
- Se ajustó la vista `RoomDetail.jsx` para separar claramente la información general de la sala, participantes conectados y chat.
- El chat ahora usa un contenedor dedicado con referencia al final de la conversación.
- Cada vez que se cargan mensajes o llega un mensaje nuevo por WebSocket, la vista baja automáticamente al último mensaje.
- Si el usuario se desplaza hacia arriba, aparece el botón `Bajar al último mensaje` para volver al final.
- Se agregaron estados visuales de conexión: `Conectando` y `En línea`.
- Se mejoró el estado vacío del chat y la legibilidad de mensajes largos.
- Se mantuvieron atributos de accesibilidad como `aria-live`, `aria-relevant`, labels ocultos y mensajes de estado.

## Archivos modificados
- `src/pages/RoomDetail.jsx`
- `src/styles/Rooms.css`

## Prueba recomendada para evidencia
1. Entrar a una sala desde dos navegadores o dos cuentas.
2. Enviar varios mensajes desde el cliente A hasta que haya scroll en el chat.
3. Verificar que el cliente B recibe los mensajes y baja automáticamente al último.
4. Subir manualmente el scroll en el chat.
5. Enviar otro mensaje y verificar que se puede volver al final con el botón.
6. Tomar capturas antes/después mostrando la sala, el chat y el último mensaje visible.

## Validación local
```bash
npm run lint
npm run build
```

Resultado esperado: ambos comandos pasan sin errores.
