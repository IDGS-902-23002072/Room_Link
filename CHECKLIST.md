# Checklist de entrega de RoomLink

Corte del 24 de noviembre de 2026. Base auditada: `develop` y tag publicado [`v0.1.0`](https://github.com/IDGS-902-23002072/Room_Link/releases/tag/v0.1.0), código de Vite y Expo y las ocho historias del documento de definición. Los responsables reflejan las asignaciones del proyecto. La columna de cierre distingue trabajo de producto de las pruebas que siguen pendientes.

## Las ocho historias de usuario

| Historia y responsable | Qué existe | Qué falta para cerrar |
|---|---|---|
| **HU-01 · M01 · César** | Playwright Vite cubre registro con términos, correo duplicado y contraseña corta junto al campo, bloqueo tras cinco intentos y restablecimiento por SMTP local con revocación de sesión. El backend verifica expiración a los 30 min y desbloqueo a los 15 min. | Google y SMTP de producción quedan fuera de este cierre. |
| **HU-02 · M02 · Roberto** | Perfil y galería en Vite y Expo. La web captura fecha de nacimiento para la edad y aplica los límites de 300 caracteres y seis fotos. El backend filtra contacto según la privacidad y la conexión. | Exponer los controles de privacidad de contacto en Vite y verificar qué puede ver una cuenta ajena, pendiente y aceptada. Probar edición y reflejo público con dos sesiones, incluyendo biografía, séptima foto, orden de galería y visibilidad después de recargar. Acordar el procedimiento de verificación si se va a ofrecer como parte de la entrega. |
| **HU-03 · M03 · Omar** | El E2E web contesta las siete preguntas, revisa el resumen, recarga, edita y verifica el nuevo cálculo. MySQL tiene cobertura de guardados simultáneos. | — |
| **HU-04 · M04 · Omar** | El E2E web verifica la invitación sin test, foto, nombre, edad, zona, presupuesto, orden descendente y búsqueda vacía con limpieza. Los anuncios de demostración de Expo solo se muestran en desarrollo. | — |
| **HU-05 · M05 · Roberto** | Vite carga el feed completo y filtra en el navegador. La API tiene rutas de búsqueda. | Conectar la búsqueda al endpoint según el tipo de resultado, con paginación y preferencias compatibles con su contrato. Verificar que presupuesto y zona tengan datos reales y que combinar zona, edad, presupuesto y hábitos conserve resultados y total coherentes. Añadir E2E de cero resultados y limpiar filtros. |
| **HU-06 · M07/M08 · Avril y Guzmán** | Vite prueba el bloqueo con dos fotos, edición con conservación de fotos y costos, publicación, pausa y reactivación. La API exige rol de anfitrión o admin en las mutaciones y conserva las restricciones de propietario. | Verificación en APK instalado. |
| **HU-07 · M09 · Guzmán** | Playwright verifica fecha, afinidad, lista de espera, rechazo con aviso, aceptación y persistencia al recargar. Vite y Expo permiten cerrar el anuncio al aceptar. | Confirmar el recorrido en APK y smoke tras publicar la versión. |
| **HU-08 · M11 · Avril** | API para enviar, responder, listar y cancelar conexiones. Expo tiene gestión y la web conserva el estado pendiente al recargar el perfil candidato. El chat se habilita en la API al aceptar. | Completar bandeja web de recibidas/enviadas y campo de introducción opcional. Asegurar aviso de rechazo y que un reintento idempotente no duplique avisos. E2E Vite de ambas cuentas con aceptación y rechazo, estados, avisos y chat vinculado a esa conexión. |

## Módulos complementarios y cierre operativo

| Módulo y responsable | Qué existe | Qué falta para cerrar |
|---|---|---|
| **M06 · Compatibilidad detallada y mapa · Guzmán** | Playwright cubre selección manual, geocodificación, puntos cercanos y recuperación tras un 503. El mapa y su enlace siguen accesibles durante el fallo. | Overpass público devolvió 502 al consultar León. El E2E usó un proveedor controlado. Falta confirmar los lugares cercanos con el proveedor real. |
| **M10 · Chat · César** | E2E web con postulación aceptada y conexión aceptada. Verifica recepción, lectura, persistencia, reconexión y acceso denegado a una cuenta ajena a la sala. | Verificación en APK. |
| **M12 · Acuerdos · Roberto** | Hay API de creación, revisión, firmas y versiones, y pantallas web y Expo. El formulario web deja título, fecha propuesta y normas personalizadas en el borrador local. | Definir qué campos deben viajar al acuerdo y persistirlos si forman parte de la versión firmada. Probar dos participantes, permisos, ambas firmas, una nueva versión y persistencia al volver a entrar. |
| **M13 · Moderación y sanciones · César y Avril** | E2E web de denuncia por fraude, priorización automática, permisos de admin, aprobación, historial y aviso al anfitrión. API y Expo incluyen gestión de sanciones. | Avril: gestión web de sanciones y pruebas de emisión, revocación y bloqueo. |
| **M14 · Notificaciones · Por asignar** | E2E Vite cubre preferencias persistentes, respeto del aviso de conexión, avisos de postulación y moderación, y lectura. | APK: permiso y entrega de avisos. La sincronización actual depende de la sesión activa. Para recibir con la app cerrada hace falta transporte push. SMTP real queda fuera de este cierre. |
| **M15 · Dashboard administrativo · Roberto** | Vite y Expo consultan la API de analítica. | Validar métricas con datos conocidos, filtros de fecha, privacidad por rol y estados vacíos. Comparar web y móvil con el mismo rango. |

- [x] **Entrega web y API** · Se publicó [`v0.1.0`](https://github.com/IDGS-902-23002072/Room_Link/releases/tag/v0.1.0) por tag. Azure respondió en `/health` y `/ready`. [Despliegue](https://github.com/IDGS-902-23002072/Room_Link/actions/runs/45435082825)
- [x] **QA automático** · El workflow de QA final pasó los recorridos por rol, SMTP local, PWA, Expo y restauración de MySQL. [GitHub Actions](https://github.com/IDGS-902-23002072/Room_Link/actions/runs/45434292032)
- [x] **QA de César y Guzmán** · 11 escenarios Playwright con Vite y Expo Web, y 192 pruebas de backend entre unitarias, integración MySQL y smoke.
- [ ] **Cierre operativo** · Validar Overpass y el APK instalado. ADB no detectó dispositivo ni emulador. Usar el flujo `frontend/tests/maestro/login-por-rol.yaml` en Android. Ejecutar el smoke de producción tras un nuevo release. Los casos web que dependen de la implementación de Roberto y Avril siguen en sus respectivas HU. El lint global de Expo conserva 10 errores y 1 aviso previos.
- [ ] **Control del release** · El procedimiento de `v0.1.0` esperó manualmente el QA del SHA antes de etiquetar. Si el equipo requiere una barrera automática, hacer que el workflow de release compruebe el resultado del SHA etiquetado antes de desplegar.

## Rama de Roberto

El commit [`66f1fc1`](https://github.com/IDGS-902-23002072/Room_Link/commit/66f1fc10eb8066f471a1bd1e400c0470b5a3b21f) incorpora `10eae69` con búsqueda paginada, controles de privacidad, administración de verificación y cambios de autorización/versionado de acuerdos. Vite compila en la rama aislada. El backend de `66f1fc1` falla el typecheck por marcadores de conflicto en `app.ts`, `profile.controller.ts` y `search.view.ts`. El parche funcional produce ocho conflictos al aplicarse sobre `develop`. Sigue pendiente integrar con los cambios actuales y repetir QA.

- **M02.** Validar con cuentas ajenas, pendientes y aceptadas, incluida la visibilidad del correo y la decisión de identidad por admin.
- **M05.** Hay filtros y paginación de roomies. Falta probar filtros combinados, totales y limpieza con MySQL y Vite. La búsqueda de habitaciones con filtros avanzados se conectó en Expo; Vite conserva su catálogo actual.
- **M12.** Hay cambios para crear acuerdos con una postulación aceptada y revisar versiones entre participantes. Título, inicio y normas personalizados siguen en el borrador local web. Falta validar dos firmas, nueva versión y acceso de terceros.
- **M15.** El dashboard ya estaba integrado. El cambio nuevo no adjunta una prueba automatizada de métricas en MySQL. Falta evidencia reproducible por rango y rol con los mismos datos para Vite y Expo.
