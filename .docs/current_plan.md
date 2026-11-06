# Plan activo — módulos asignados a César

## [OBJETIVO ACTUAL]

Implementar únicamente los módulos asignados a César en el documento del proyecto: Autenticación y Accesos, Mensajería Instantánea y Moderación de Publicaciones, vinculándolos con las issues técnicas correspondientes.

## [ALCANCE DE ISSUES]

- Kanban oficial: [Room_Link - Kanban #4](https://github.com/users/IDGS-902-23002072/projects/4).
- Autenticación: issue padre [#1](https://github.com/IDGS-902-23002072/Room_Link/issues/1) y tareas [#21–#30](https://github.com/IDGS-902-23002072/Room_Link/issues/21).
- Mensajería: issue padre [#11](https://github.com/IDGS-902-23002072/Room_Link/issues/11) y tareas [#98–#105](https://github.com/IDGS-902-23002072/Room_Link/issues/98).
- Moderación de publicaciones: issue compartida [#14](https://github.com/IDGS-902-23002072/Room_Link/issues/14) y tareas [#121–#128](https://github.com/IDGS-902-23002072/Room_Link/issues/121), [#131](https://github.com/IDGS-902-23002072/Room_Link/issues/131) y [#132](https://github.com/IDGS-902-23002072/Room_Link/issues/132), limitadas funcionalmente a anuncios.
- Restricciones transversales aplicables: `RNF-01.1`–`RNF-01.3`, `RNF-02.2`–`RNF-02.3`, `RNF-03.1`–`RNF-03.4`, `RNF-04.1` y `RNF-05.1`.

Fuera de alcance: perfiles, postulaciones, conexiones, moderación de usuarios o mensajes, sanciones de cuentas, notificaciones `RF-14.*`, analítica y cualquier otro módulo asignado a otra persona. Los módulos externos solo se consumirán mediante puertos explícitos.

## [ARQUITECTURA/DISEÑO]

Se evaluaron dos opciones:

1. Reorganizar todo el backend a capas hexagonales independientes por módulo. Cumple literalmente la hoja de RNF, pero modifica módulos ajenos a César y contradice la arquitectura compartida actualmente documentada en el repositorio.
2. Extender el monolito modular MVC/DDD existente, agregando contratos específicos, repositorios como única frontera de datos e inyección de adaptadores para OAuth, correo, eventos y tiempo real. Mantiene el alcance aislado y evita una migración arquitectónica transversal.

Se elige la opción 2. Cada módulo nuevo mantendrá dominio y casos de uso libres de Hono y Drizzle; los controladores serán adaptadores HTTP/SSE y las implementaciones Drizzle permanecerán en infraestructura. El frontend será Expo/React Native con soporte web, rutas y clientes API separados por módulo.

## [PASOS DE IMPLEMENTACIÓN (Checklist)]

- [x] Sustituir el Kanban duplicado por el oficial y asignar a `bhask4ra` las 31 issues oficiales del alcance de César, sin sobrescribir el estado definido por el dueño.
- [x] Crear pruebas unitarias de autenticación que fallen sin las reglas de términos, password >= 8, bloqueo tras 5 intentos, recuperación de 30 minutos y evento de registro.
- [x] Implementar puertos y adaptadores de autenticación: hashing moderno, sesiones seguras, OAuth Google, notificación de recuperación y publicación de eventos.
- [x] Completar repositorios y endpoints de registro, login, OAuth, recuperación, restablecimiento, sesión y cierre de sesión sobre el esquema existente.
- [x] Crear pruebas unitarias de mensajería para autorización, orden cronológico, entrega y lectura.
- [x] Implementar dominio, repositorios y endpoints HTTP/SSE de bandeja, sala, envío, entrega y lectura.
- [x] Crear pruebas unitarias de moderación de anuncios para reportes, cola, aprobación, rechazo, baja e historial.
- [x] Implementar dominio, repositorios y endpoints de moderación limitados a publicaciones y protegidos por rol administrador.
- [x] Inicializar el frontend Expo/PWA sin agregar pantallas de otros integrantes.
- [x] Implementar las 3 pantallas de autenticación: login, registro/términos y recuperación/restablecimiento.
- [x] Implementar las 3 pantallas de mensajería: bandeja, sala e información contextual.
- [x] Implementar las 3 pantallas de moderación de publicaciones: cola, denuncias e historial.
- [x] Probar los dos modos de rotura exigidos para cada grupo de pruebas nuevas y restaurar la implementación final.
- [ ] Ejecutar typecheck, build, pruebas unitarias, integración y smoke tests del árbol final. Integración MySQL bloqueada por credenciales locales.
- [x] Actualizar README, documentación de API, estado de sesión y este plan.
- [ ] Actualizar el Kanban según el estado realmente verificable, sin cerrar issues parcialmente cubiertas.

## [CRITERIOS DE ACEPTACIÓN]

- Las 31 issues oficiales enlazadas tienen trazabilidad explícita a código y pruebas; ninguna issue de otro integrante cambia de alcance.
- Registro local exige correo único, contraseña de al menos 8 caracteres y aceptación explícita de términos.
- OAuth se consume mediante un puerto verificable y no acopla el dominio al proveedor.
- Cinco fallos consecutivos bloquean el login durante 15 minutos.
- Recuperación usa token criptográfico de un solo uso con expiración de 30 minutos y respuesta que no filtra existencia de cuentas.
- El registro publica `UserRegisteredEvent` mediante un puerto de eventos.
- Solo una conexión aceptada o postulación admitida habilita una sala privada.
- Los mensajes se persisten y consultan en orden estable, con estados de entrega y lectura; el canal SSE transmite actualizaciones.
- La moderación de César solo opera sobre anuncios: denuncias, cola, aprobación, rechazo, baja e historial.
- Los endpoints privados aplican sesión y RBAC; los payloads no exponen hashes ni tokens almacenados.
- Las nueve pantallas de César funcionan en web y viewport móvil y manejan carga, vacío y error.
- La matriz QA termina sin filas requeridas en `FAILED`; cualquier `BLOCKED` identifica dependencia, comando intentado y riesgo residual.

## [DEPENDENCIAS EXTERNAS]

- Google OAuth requiere credenciales del proyecto para una validación real contra Google. Se implementará y probará el puerto con un adaptador controlado; si las credenciales no están disponibles, la prueba externa quedará registrada como espera con dueño y fecha.
- El envío real de correos requiere proveedor/credenciales. El flujo y el puerto se probarán de forma determinista; la entrega externa se registrará como espera si no existe configuración.
