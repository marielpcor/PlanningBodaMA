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
