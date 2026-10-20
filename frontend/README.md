# Aplicación móvil

Aplicación Expo con React Native y Expo Router. El proyecto está en `Room_Link/`.

## Estructura

- `Room_Link/src/app/`: rutas de navegación.
- `Room_Link/src/modulos/encuesta/`: cuestionario y componentes de compatibilidad.
- `Room_Link/src/modulos/exploracion/`: búsqueda, perfiles y vista rápida de roomies.
- `Room_Link/src/modulos/anuncios/`, `chats/` y `perfil/`: pantallas de navegación.
- `Room_Link/src/modulos/comunes/`: componentes compartidos entre módulos.

Los componentes y archivos de cada módulo usan nombres en español y se agrupan por pantalla, componentes, datos y estilos cuando corresponde.

## Comandos

Desde `Room_Link/`:

```bash
npm install
npm start
npm run web
npm run lint
npx tsc --noEmit
```
