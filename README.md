# Wanderwarm · Sistema de producción

App web (celular y compu) para seguir la producción de Wanderwarm: órdenes por etapa, talleres tercerizados, calidad, productos con BOM, procesos estándar, la camioneta y un asistente con IA. Hecho por **Stoka Software**.

## Cómo está armado

| Parte | Dónde |
|---|---|
| App (React + Vite + Tailwind) | `src/` · se publica en Vercel |
| Base de datos, login y permisos | Supabase, proyecto **wander-produccion** (São Paulo) |
| Esquema, validaciones y permisos | `supabase/schema.sql` |
| Asistente con IA | Función `asistente` (lee la clave de Anthropic cifrada en Vault) |
| Alta de usuarios | Función `usuarios` (solo Dirección y super admin) |
| Demo sin internet | `demo/index.html` (doble clic, datos de ejemplo en el navegador) |

## Roles

| Rol | Qué hace |
|---|---|
| Super admin (Stoka) | Todo, más la clave de la API, el modelo de IA y la auditoría (Ajustes → Plataforma). |
| Dirección (admin) | Ve todo, costos incluidos; administra equipo, catálogo y ajustes. |
| Producción | Crea y mueve órdenes, carga calidad y viajes. |
| Taller | Ve solo las órdenes asignadas a su taller e informa entregas. |
| Chofer | Registra los viajes de la camioneta. |

Los permisos están en la base (RLS), no solo en las pantallas. Las cuentas nuevas nacen sin acceso hasta que un admin les asigna rol.

## Cómo funciona la camioneta

Un **viaje** es una salida: arranca en la fábrica, hace **paradas** y vuelve. En cada parada el chofer marca qué **dejó** o **retiró**, de qué orden y cuántas prendas, y anota los km del tablero al salir y al volver. Con eso el sistema calcula:

- viajes, km y costo (km × costo por km de Ajustes → Lugares y logística);
- talleres más visitados y viajes y costo logístico por orden;
- dónde está físicamente la mercadería de cada orden;
- control cruzado: lo que la camioneta dejó en un taller, lo que el taller informó y lo que se retiró.

Si la camioneta **deja** una orden en un taller, ese taller queda asignado a la etapa correspondiente. El chofer también puede decirlo por chat: “dejé 200 remeras de la orden 15 en Bordados Centro”.

## Desarrollo

```bash
npm install
cp .env.example .env   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
npm run build          # producción (dist/)
npm run build:demo     # demo de un archivo (demo/)
```

Sin `.env` la app arranca en modo demo con datos de ejemplo.

## Antes de usarlo en serio

1. Ajustes → Plataforma: pegar la clave de Anthropic (super admin).
2. Equipo: crear los usuarios reales (o cambiar mail y contraseña de los de prueba).
3. Ajustes → Datos y copias → **Borrar datos de ejemplo**.
4. En Supabase → Authentication → Sign In / Providers: desactivar “Allow new users to sign up” y activar la protección de contraseñas filtradas.
