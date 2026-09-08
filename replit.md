# Caja Peluquería Bruno

Caja móvil para registrar ventas, salidas y cierres de una peluquería canina.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/caja-bruno/src/App.tsx` — aplicación, rutas, caja, ventas, historial y configuración.
- `artifacts/caja-bruno/src/index.css` — tema visual móvil inspirado en la referencia de Bruno.
- `artifacts/caja-bruno/public/bruno-mascot.png` — ilustración usada en la tarjeta de caja.
- La persistencia de esta primera versión usa `localStorage` del dispositivo.

## Architecture decisions

- La caja activa se calcula a partir de `activeOpenedAt`; cerrar caja crea un cierre inmutable y abre un período nuevo.
- Las ventas anuladas permanecen en el historial y dejan de computar en el saldo efectivo.
- Los servicios y todas las operaciones se guardan localmente para que la app funcione sin depender de una conexión.

## Product

La app permite gestionar servicios activos, registrar ventas con cantidad, registrar salidas de caja, consultar y anular ventas, y cerrar períodos con resumen de ventas, salidas y neto.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Las cantidades y precios se manejan como pesos argentinos enteros sin centavos en esta interfaz.
- Para comprobar el build manualmente fuera del workflow hay que definir `PORT` y `BASE_PATH`; el workflow los inyecta automáticamente.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
