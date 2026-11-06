# Aplicación móvil

Aplicación Expo con React Native y Expo Router. El proyecto está en `Room_Link/`.

Incluye los módulos de compatibilidad y exploración de roomies, además de los
módulos de César (autenticación, mensajería y moderación de publicaciones).

## Estructura

- `Room_Link/src/app/`: rutas de navegación.
- `Room_Link/src/modulos/encuesta/`: cuestionario y componentes de compatibilidad.
- `Room_Link/src/modulos/exploracion/`: búsqueda, perfiles y vista rápida de roomies.
- `Room_Link/src/modulos/anuncios/`, `chats/` y `perfil/`: pantallas de navegación.
- `Room_Link/src/modulos/comunes/`: componentes compartidos entre módulos.

Los componentes y archivos de cada módulo usan nombres en español y se agrupan
por pantalla, componentes, datos y estilos cuando corresponde.

## Diseño (módulos de César)

Las vistas de autenticación, mensajería y moderación siguen la paleta y la
intención de los mockups móviles de RoomLink sobre un design system propio:

- `src/shared/theme.js` — tokens (paleta, espaciado, radios, tipografía, sombras).
- `src/shared/icons.js` — iconografía line-art construida con `View` (sin
  dependencias de iconos ni SVG).
- `src/shared/ui.js` — componentes reutilizables (Button, TextField, Card,
  HeroCard, SegmentedTabs, Chip/StatusChip, Avatar, BottomNav, MessageBubble,
  SearchField, EmptyState, Notice…).

La lógica de cada módulo vive en `*.logic.js` y el acceso a la API en
`src/api/client.js`; la capa visual no la toca. Paleta: `#81638b` (primario),
`#b695c0` (secundario), `#dac9df` (lavanda), `#5dc1b9`/`#9ce0db` (acento teal).

## Comandos

Desde `Room_Link/`:

```bash
npm install
npm start
npm run web
npm run lint
npx tsc --noEmit
```

La API se obtiene de `EXPO_PUBLIC_API_URL` y usa por defecto `http://localhost:3000/api/v1`.

## Verificación

```bash
npm run check
```
