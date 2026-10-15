# Sistema de producción · Wanderwarm

Sistema para seguir la producción de Wanderwarm de punta a punta: órdenes, talleres, calidad, recetas de consumo y viajes de la camioneta, con un asistente al que se le escribe o se le manda una foto.

Hecho por **Stoka Software**.

---

## Abrirlo ya (sin instalar nada)

Abrí **`demo/index.html`** con doble clic. Se abre en el navegador con datos de ejemplo y podés entrar como cualquier perfil.

> En la demo todo se guarda en ese navegador. Sirve para mostrar y probar.

## Correrlo en la compu (para seguir desarrollando)

Necesitás [Node.js](https://nodejs.org) 18 o más nuevo.

1. Doble clic en **`INICIAR.bat`** (Windows). La primera vez instala las librerías (tarda un par de minutos).
2. Se abre `http://localhost:5173`.

O desde una terminal en esta carpeta:

```bash
npm install
npm run dev
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila el sistema para subirlo (queda en `dist/`) |
| `npm run build:demo` | Regenera la demo de un solo archivo (`demo/`) |

---

## Qué tiene

| Pantalla | Para qué |
|---|---|
| **Inicio** | Ingreso con video de fondo. En demo elegís perfil; con Supabase, mail y contraseña. |
| **Tablero** | Barra de **filtros** (7/30/90 días, este mes o fechas, ventas/stock, producto, taller). 6 indicadores, órdenes por etapa, gráfico con series que se prenden y apagan, producción y fallas por taller (**tocás un taller y filtra todo**), motivos de falla (tocás uno y se destaca), viajes por destino y días promedio por etapa. |
| **Órdenes · Por etapa** | Cada etapa es una **fila**: arrastrás la orden a otra fila o usás las flechas ‹ › de la tarjeta. Tocás la tarjeta y se abre la ficha. Al mover aparece **Deshacer**. |
| **Órdenes · Recorrido** | Una fila por orden con sus 7 etapas: **tocás la etapa** a la que querés moverla. |
| **Ficha de la orden** | Entregas por taller, control de calidad, materiales según el BOM (con merma), costo y margen, historial y acceso directo al **estándar de esa etapa**. |
| **Productos · BOM** | Ficha de cada producto con: **BOM** (componentes, consumo por prenda, % de merma, consumo con merma por talle, costo y peso de cada uno, calculadora para N prendas, ajuste de consumo por talle), **Ruta de proceso** (minutos y costo por etapa), **Costos y precio** (de dónde sale el costo, margen) y **Datos**. Se puede duplicar un producto. |
| **Procesos** | **Estándares de trabajo** de cada etapa: objetivo, responsable, tiempo, paso a paso, checklist marcable, criterios y errores comunes. Los ven todos los roles (talleres y chofer incluidos), se pueden imprimir y Dirección/Producción los editan con control de versión. |
| **Calidad** | Tasa de fallas de 6 meses contra la meta, ranking de talleres y carga rápida. |
| **Talleres** | Capacidad semanal, unidades, fallas y órdenes activas por taller. |
| **Logística** | **Mapa de recorridos** de izquierda a derecha (fábrica → corte → confección → personalización → vuelta), con la cantidad de viajes en cada tramo, período elegible y detalle al tocar un lugar o una línea. Ranking de recorridos y viajes por semana. |
| **Asistente** | **Botón flotante estilo WhatsApp** en todas las pantallas. Se despliega el chat, responde con los datos y prepara cargas que se confirman con un botón. |
| **Equipo** | Personas, roles y tabla de permisos. |
| **Ajustes** | Empresa · Producción (meta de fallas, días de aviso, alerta de capacidad, plazo por defecto, exigir calidad, saltar etapas) · Alertas y avisos (qué, por dónde, a quién, hora del resumen) · Lugares y km · Listas (motivos de falla, categorías, talles) · Integraciones (Supabase, Claude, facturación ARCA, WhatsApp, contador) · Apariencia (tema, animaciones, vista compacta, pantalla de inicio) · Equipo · Datos (copia .json, órdenes a Excel .csv, importar, borrar ejemplos, reiniciar) · Acerca de. |

Extras: **Ctrl + K** abre el buscador rápido, modo oscuro, y funciona en celular con barra inferior.

### Roles

| Rol | Ve | Puede |
|---|---|---|
| **Dirección** | Todo, incluidos costos y márgenes | Todo, más gestionar el equipo, borrar y ver como otro rol |
| **Producción** | Tablero, órdenes, calidad, talleres, catálogo, logística | Crear y mover órdenes, cargar calidad, entregas y viajes. No ve costos. |
| **Taller** | Sus órdenes pendientes, sus entregas y los procesos | Informar entregas de su taller |
| **Chofer** | Logística y procesos | Registrar viajes |

Dirección puede usar **"Ver como"** (abajo a la izquierda) para mostrar la pantalla de cada rol.

---

## Pasarlo a producción con Supabase (para que todo el equipo cargue)

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegá y corré el archivo `supabase/schema.sql` (completo, incluye la parte v2 de procesos y ajustes). Crea las tablas, los permisos por rol y la función segura para que los talleres solo carguen entregas de su taller.
3. Copiá `.env.example` como `.env` y completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
4. Creá los usuarios en **Authentication → Users → Invite**. **El primero que se crea queda como Dirección**; al resto le asignás el rol desde la pantalla **Equipo**.
5. Asistente con IA (lee mensajes libres y fotos de remitos):
   ```bash
   supabase functions deploy asistente
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
6. Subir la web: conectá esta carpeta a Vercel (o `npm run build` y subí `dist/`), con las mismas variables del `.env`.

Para cargar los datos de la demo en Supabase no hace falta nada: arrancás vacío y cargás productos, talleres y órdenes reales.

---

## Tecnología

React 18 + TypeScript + Vite · Tailwind CSS · Framer Motion (animaciones) · Recharts (gráficos) · dnd-kit (arrastrar órdenes) · cmdk (buscador) · Zustand (estado) · Sonner (avisos) · canvas-confetti · Lucide (íconos) · Supabase (base de datos, usuarios, tiempo real y función del asistente) · Claude (asistente).

### Estructura

```
src/
  views/        una pantalla por archivo (Tablero, Ordenes, Calidad, ...)
  components/   Layout (menú, buscador), fichas de orden, piezas de UI
  store/        estado y acciones (crear orden, mover etapa, registrar entrega...)
  lib/          tipos, roles y permisos, indicadores, asistente local, Supabase, datos de ejemplo
public/media/   video de fondo (montaña con nieve y brillo de calor)
supabase/       schema.sql y función del asistente
demo/           versión de un solo archivo para abrir con doble clic
```
