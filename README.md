# Planificador de Boda · M & A 💍

App web para organizar las actividades de la boda. Permite:

- **Lista de actividades** con estado: **Pendiente**, **En proceso** y **Finalizado**.
- Asignar una **fecha** a cada actividad (ej. «Prueba de vestido» → 15 de agosto).
- Una **vista de calendario** donde las actividades con fecha aparecen marcadas y, al tocar un día, se ven sus actividades.
- Notas opcionales, filtros por estado, editar y eliminar.

Comparte la paleta y el monograma **M & A** de la app de música de la boda.

## Cómo ejecutarlo

No necesita instalar nada (usa solo Node nativo, sin dependencias):

```bash
npm start
```

Luego abre **http://localhost:3000**.

> Si tu Node no lee el puerto, puedes definir `PORT` en las variables de entorno.

## Dónde se guardan los datos

- **Local (por defecto):** en `data/activities.json`. No requiere configuración.
- **Nube (opcional, Supabase):** define `SUPABASE_URL` y `SUPABASE_KEY`
  (ver `.env.example`) y ejecuta `supabase-schema.sql` en tu proyecto de Supabase.

## Publicar en internet (Render + Supabase)

> En Render el disco es **efímero**: el archivo `data/activities.json` se borra al
> reiniciar. Para que las actividades no se pierdan, en producción hay que usar Supabase.

**1. Crear la tabla en Supabase**
- En tu proyecto de Supabase → **SQL Editor** → ejecuta el contenido de
  [`supabase-schema.sql`](supabase-schema.sql). Crea la tabla `activities`.
  (Puedes reutilizar el mismo proyecto Supabase de la app de música.)

**2. Crear el servicio en Render**
- [render.com](https://render.com) → **New** → **Web Service** → conecta este repositorio.
- Configuración:
  - **Build Command:** *(vacío — no hay dependencias)*
  - **Start Command:** `npm start`
  - **Instance Type:** Free
- **Environment Variables:**
  - `SUPABASE_URL` → la URL de tu proyecto Supabase
  - `SUPABASE_KEY` → la *anon key* de Supabase
  - El `PORT` lo asigna Render automáticamente; no lo definas.
- **Create Web Service**. En ~1–2 min tendrás una URL pública.

Si en los logs aparece `Almacenamiento: Supabase (nube)`, está guardando online. ✅

> **Plan gratis:** el servicio se "duerme" tras un rato sin uso y la primera visita
> tarda ~30 s en despertar. Para una boda es suficiente.

## Estructura

```
server.js              Servidor HTTP + API REST (Node nativo)
storage.js             Almacenamiento: archivos locales o Supabase
supabase-schema.sql    Tabla de actividades para Supabase
public/
  index.html           Página (vistas Lista y Calendario)
  styles.css           Estilos (paleta verde salvia + dorado)
  app.js               Lógica del frontend
  logo.svg             Monograma M & A
data/                  Datos locales (no se versionan)
```

## API

| Método | Ruta                     | Descripción                          |
|--------|--------------------------|--------------------------------------|
| GET    | `/api/activities`        | Lista todas las actividades          |
| POST   | `/api/activities`        | Crea una actividad                   |
| PATCH  | `/api/activities/:id`    | Actualiza (estado, fecha, nota…)     |
| DELETE | `/api/activities/:id`    | Elimina una actividad                |

Campos de una actividad: `title`, `description`, `date` (`YYYY-MM-DD` o `null`),
`status` (`pendiente` · `en_proceso` · `finalizado`).
