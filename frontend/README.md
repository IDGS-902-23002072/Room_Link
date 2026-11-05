# Frontend Room Link

Aplicación Expo/React Native (móvil y web) con los módulos asignados a César:

- autenticación: inicio de sesión, registro y recuperación/restablecimiento;
- mensajería: bandeja, sala e información contextual;
- moderación de publicaciones: cola, denuncias e historial.

## Diseño

Las nueve vistas siguen la paleta y la intención de los mockups móviles de
RoomLink, con un diseño elevado sobre un design system propio:

- `src/shared/theme.js` — tokens (paleta, espaciado, radios, tipografía, sombras).
- `src/shared/icons.js` — iconografía line-art construida con `View` (sin
  dependencias de iconos ni SVG).
- `src/shared/ui.js` — componentes reutilizables (Button, TextField, Card,
  HeroCard, SegmentedTabs, Chip/StatusChip, Avatar, BottomNav, MessageBubble,
  SearchField, EmptyState, Notice…).

La lógica de cada módulo vive en `*.logic.js` y el acceso a la API en
`src/api/client.js`; la capa visual no la toca. Paleta: `#81638b` (primario),
`#b695c0` (secundario), `#dac9df` (lavanda), `#5dc1b9`/`#9ce0db` (acento teal).

## Desarrollo

```bash
npm install
npm run web
```

La API se obtiene de `EXPO_PUBLIC_API_URL` y usa por defecto `http://localhost:3000/api/v1`.

## Verificación

```bash
npm run check
```
