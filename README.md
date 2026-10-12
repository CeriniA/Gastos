# Gastos

App web personal para llevar ingresos y egresos: carga manual, fotos de tickets, capturas de
MercadoLibre/MercadoPago y resúmenes de tarjeta leídos con IA, en pesos y dólares.

Este repositorio es la **base del proyecto** (etapa 1 de `docs/ROADMAP.md`): estructura, capas,
esquemas compartidos, login, cuentas, categorías, etiquetas, movimientos manuales, balance del mes,
respaldo completo, exportación e importación de planillas. La lectura con IA, las tarjetas, las cuotas
y los informes se construyen sobre esto en las etapas siguientes.

## Stack

| Capa          | Tecnología                                                                   |
| ------------- | ---------------------------------------------------------------------------- |
| Frontend      | React, Vite, Tailwind, TanStack Query, React Hook Form, app instalable (PWA) |
| Backend       | Node 22, Express 5, Mongoose, Zod                                            |
| Base de datos | MongoDB Atlas (plan gratuito M0)                                             |
| IA            | Gemini Flash detrás de una interfaz reemplazable (etapa 2)                   |
| Alojamiento   | Render: sitio estático + servicio web gratuito                               |
| Lenguaje      | TypeScript estricto en todo el proyecto                                      |

## Estructura

```
shared/     Fuente única: constantes, esquemas de validación, tipos, dinero, fechas, formato de importación
backend/    API. Módulos por funcionalidad con capas routes → controller → service → repository → model
frontend/   Interfaz. Una carpeta por funcionalidad, espejo del backend
docs/       Especificación, decisiones, arquitectura, API, glosario y hoja de ruta
```

El código está en inglés y todo lo que se ve en pantalla en español. `docs/GLOSARIO.md` tiene la
equivalencia de cada término.

## Puesta en marcha

Requisitos: Node 22 o superior y cuentas gratuitas en GitHub, MongoDB Atlas y Render.

**1. Instalar dependencias**

```bash
npm install
```

Esto crea `package-lock.json`. Hay que subirlo al repositorio: Render y la integración continua lo
necesitan (`npm ci`).

**2. Verificar**

```bash
npm run check    # tipos, lint y pruebas
npm run build    # compila backend y frontend
```

> La base se escribió en un entorno sin acceso al registro de npm. Las reglas de negocio y el paquete
> `shared` se probaron ahí; la compilación contra las librerías reales (Express, Mongoose, React, Vite)
> no. Si `npm run check` marca algo en este primer paso, son ajustes de tipos o de versiones, no de
> diseño. El detalle está en `docs/ROADMAP.md`, sección "Estado de la base".

**3. Base de datos**

En MongoDB Atlas: crear un cluster M0, un usuario de base de datos y, en Network Access, permitir
`0.0.0.0/0` (el plan gratuito de Render no tiene IP fija). Copiar la cadena de conexión.

Conviene usar dos bases en el mismo cluster: `gastos` para los datos reales y `gastos-dev` para probar.

**4. Variables de entorno**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run hash-password -w backend -- "tu contraseña"    # pegar el resultado en AUTH_PASSWORD_HASH
```

Completar `backend/.env` siguiendo los comentarios del archivo.

**5. Datos iniciales y arranque**

```bash
npm run seed -w backend    # categorías y cuentas de arranque; se puede repetir sin duplicar
npm run dev:backend        # http://localhost:4000
npm run dev:frontend       # http://localhost:5173
```

## Publicar en Render

1. Subir el repositorio a GitHub.
2. En Render: New → Blueprint → elegir el repositorio. `render.yaml` describe los dos servicios.
3. Completar las variables que pide:
   - `MONGODB_URI`: la cadena de Atlas apuntando a la base `gastos`.
   - `AUTH_USERNAME` y `AUTH_PASSWORD_HASH`.
   - `GEMINI_API_KEY`: la clave de Google AI Studio. Sin ella la app funciona, pero no lee fotos.
   - `CORS_ORIGIN`: la dirección del sitio estático (`https://gastos-web.onrender.com` o la que asigne Render).
   - `VITE_API_URL`: la dirección del servicio (`https://gastos-api.onrender.com`), sin `/api/v1`.
4. Abrir el sitio en Chrome desde el celular y elegir "Agregar a pantalla de inicio".

El servicio gratuito se duerme tras 15 minutos sin uso y tarda cerca de un minuto en despertar. La app
lo avisa en pantalla.

## Comandos

| Comando                                            | Qué hace                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run check`                                    | Tipos, lint y pruebas                                                  |
| `npm test`                                         | Solo pruebas                                                           |
| `npm run lint`                                     | Estilo y reglas de arquitectura                                        |
| `npm run format`                                   | Formatea el código                                                     |
| `npm run build`                                    | Compila backend y frontend                                             |
| `npm run seed -w backend`                          | Carga categorías y cuentas iniciales                                   |
| `npm run hash-password -w backend`                 | Genera el hash de la contraseña                                        |
| `npm run try-extraction -w backend -- "<carpeta>"` | Lee imágenes reales con la IA y muestra el resultado, sin guardar nada |

## Lectura con IA

Para leer tickets y capturas hace falta una clave de Gemini: se obtiene gratis en
[Google AI Studio](https://aistudio.google.com) ("Get API key") y va en `GEMINI_API_KEY`, dentro de
`backend/.env` (y en Render, en las variables del servicio). Sin clave, el resto de la app funciona igual.

Antes de confiar en la lectura, probala con tus propios documentos:

```bash
npm run try-extraction -w backend -- "C:\ruta\a\una\carpeta" --kind receipt
npm run try-extraction -w backend -- "C:\ruta\a\capturas" --kind screenshot
```

Cada imagen es un pedido contra el cupo diario gratuito. En el plan gratuito, Google puede usar lo que se
envía para mejorar sus productos.

## Respaldo

El plan gratuito no garantiza copias de seguridad. En la app, **Más → Respaldo y datos** descarga una
copia completa en JSON y permite restaurarla. Conviene bajar una cada tanto.

## Documentación

- `docs/ESPECIFICACION.md`: qué hace la app y sus reglas.
- `docs/ARQUITECTURA.md`: capas, dependencias y cómo agregar un módulo.
- `docs/DECISIONES.md`: cada decisión tomada y su motivo.
- `docs/API.md`: endpoints.
- `docs/IMPORTACION_EXPORTACION.md`: formato de planilla y de respaldo.
- `docs/GLOSARIO.md`: términos en español y su nombre en el código.
- `docs/ROADMAP.md`: etapas, qué está hecho y qué falta.
- `AGENTS.md`: reglas para cualquier asistente de IA que modifique el proyecto.
