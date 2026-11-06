# RoomLink Web

## Desarrollo local

1. Copia `.env.example` como `.env` y configura `VITE_API_URL` con la dirección alcanzable del backend.
2. Desde esta carpeta, ejecuta `npm install` si aún no están instaladas las dependencias.
3. Inicia el sitio con `npm run dev`. Vite usa `http://localhost:5173` por defecto.
4. Inicia sesión con una cuenta de la API. El cuestionario y las recomendaciones requieren un usuario activo; el dashboard requiere el rol `admin`.

El backend permite por defecto el origen local de Vite. Si usas otro host/origen web, configura `FRONTEND_ORIGIN` en el backend. No guardes credenciales en variables `VITE_*`; son públicas en el navegador.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
