# C4 - Diseño UI Sala y Auto-scroll

## Objetivo
Cumplir el criterio C4: interfaz de sala operativa y scroll automatico de chat.

## Implementacion
- La vista de sala mantiene panel de informacion general, participantes conectados y chat.
- El contenedor del chat conserva un alto compacto similar al diseno previo.
- El chat usa scroll interno para subir y bajar sin alargar toda la pantalla.
- Al cargar mensajes o recibir nuevos mensajes, el chat baja automaticamente al ultimo mensaje.
- Si el usuario se desplaza hacia arriba, aparece la opcion para volver al ultimo mensaje.
- Los mensajes largos se ajustan dentro de la burbuja sin romper el diseno.

## Evidencia sugerida
1. Captura de sala con mensajes visibles y barra de scroll interna.
2. Captura despues de enviar un mensaje nuevo desde otro navegador, mostrando que aparece abajo.
3. Captura del boton para bajar al ultimo mensaje si el usuario se desplaza hacia arriba.
