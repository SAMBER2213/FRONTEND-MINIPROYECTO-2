# Bitácora UX/HCI - StudySync Auth y perfil

## Decisión 1: username obligatorio después de Google

**Problema:** Google entrega email y nombre, pero no garantiza un username único para identificar al usuario dentro de salas, chat y evidencias.

**Decisión:** Si el usuario entra con Google y no tiene documento en `users/{uid}`, la app lo redirige a `/complete-profile` antes de permitir el acceso al dashboard.

**Evidencia esperada:** captura del formulario "Completa tu perfil" después de autenticarse con Google por primera vez.

## Decisión 2: mensajes claros de error y éxito

**Problema:** En formularios de autenticación, el usuario necesita saber si falló la contraseña, si el username está duplicado o si la acción fue correcta.

**Decisión:** Se agregaron mensajes con `role="alert"` para errores y `role="status"` para éxito. Esto mejora accesibilidad y retroalimentación inmediata.

**Evidencia esperada:** captura con error de username duplicado y captura con mensaje de éxito al crear perfil.

## Decisión 3: dashboard protegido por perfil completo

**Problema:** No basta con estar autenticado; si el usuario no tiene username, no puede participar correctamente en salas y chat.

**Decisión:** La ruta `/dashboard` exige sesión activa y documento de perfil en Firestore. Si no hay sesión redirige a `/`; si falta perfil redirige a `/complete-profile`.

**Evidencia esperada:** captura intentando abrir `/dashboard` sin login y captura mostrando el dashboard solo después de completar perfil.

## Evidencias recomendadas para entregar

1. Video corto del registro manual: email + contraseña + username, entrada al dashboard y documento creado en Firestore.
2. Video corto de Google: login con Google, formulario obligatorio de username, entrada al dashboard.
3. Captura del error `Ese username ya está en uso`.
4. Captura de Swagger `Users` y del documento `main-api/docs/USER_MODEL.md`.
