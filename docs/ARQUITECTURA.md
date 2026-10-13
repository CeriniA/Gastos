# Arquitectura

El objetivo es poder ampliar la app sin romper lo que ya funciona: módulos independientes, capas con
una sola responsabilidad y una única definición de cada cosa.

## Paquetes

```
shared/    Lo que backend y frontend tienen que entender igual
backend/   API
frontend/  Interfaz
```

`shared` no depende de nada del navegador ni de Node. Backend y frontend dependen de `shared`, nunca
entre sí.

### shared

| Archivo           | Contenido                                                                   |
| ----------------- | --------------------------------------------------------------------------- |
| `constants.ts`    | Monedas, tipos, estados, límites, códigos de error                          |
| `money.ts`        | Única conversión, redondeo y formato de dinero (centavos enteros)           |
| `dates.ts`        | Únicas cuentas con fechas (texto `YYYY-MM-DD`)                              |
| `text.ts`         | Normalización de nombres para comparar                                      |
| `categoryTree.ts` | Profundidad, camino y movimientos válidos del árbol de categorías           |
| `csv.ts`          | Lectura y escritura de CSV                                                  |
| `importFormat.ts` | Columnas de la planilla y conversión fila ↔ movimiento                      |
| `schemas/`        | Esquemas Zod y tipos de cada entidad, del respaldo y del contrato con la IA |

Un esquema se escribe una vez: el backend valida con él, el frontend arma el formulario con él y el
tipo de TypeScript sale de él.

## Backend

```
src/
  config/env.ts        Único lector de variables de entorno
  core/
    errors/            Errores tipados
    http/              parse(), ok(), sendFile()
    middleware/        Autenticación y manejo único de errores
    db/                Conexión, transacciones, ids, puertos de colección, migraciones
  modules/<nombre>/
    <nombre>.routes.ts
    <nombre>.controller.ts
    <nombre>.service.ts
    <nombre>.repository.ts
    <nombre>.model.ts
    index.ts           Lo único que el resto de la app puede importar del módulo
  providers/ai/        Interfaz del lector de documentos y sus implementaciones
  providers/pdf/       Interfaz del lector de texto de PDF y su implementación (unpdf)
  providers/drive/     Dónde se guarda la copia automática del respaldo (Google Drive, por HTTPS)
  migrations/          Cambios numerados sobre datos guardados
  wiring.ts            Donde se conectan los servicios entre sí (sin base de datos)
  composition.ts       Producción: repositorios reales, transacciones reales, puertos de colección
  testing/memory.ts    El backend completo en memoria, para pruebas
  testing/memoryApp.ts Lo que le falta a ese backend para atender por HTTP (login y respaldo en memoria)
  app.ts               Express: middleware y rutas
  server.ts            Arranque
```

### Capas

| Capa           | Hace                                                          | No puede                        |
| -------------- | ------------------------------------------------------------- | ------------------------------- |
| **routes**     | Asocia cada URL a un controller y sus middleware              | Tener lógica                    |
| **controller** | Valida la entrada, llama al service, arma la respuesta        | Decidir reglas ni tocar la base |
| **service**    | Reglas de negocio, verificación de referencias, transacciones | Saber de HTTP ni de la base     |
| **repository** | Único que consulta la base; devuelve tipos de `shared`        | Tener reglas de negocio         |
| **model**      | Esquema de Mongoose e índices                                 |                                 |

Las dependencias van solo hacia abajo.

### Entre módulos

Un módulo no importa archivos internos de otro. Lo que necesita lo declara como una interfaz chica
(`AccountUsage`, `TransactionDependencies`) y lo recibe en `wiring.ts`.

Ejemplo: el servicio de cuentas necesita saber si una cuenta tiene movimientos antes de borrarla. No
importa el repositorio de movimientos: recibe una función `countTransactions`. Si mañana cambia cómo se
guardan los movimientos, cuentas no se entera.

Las transacciones siguen la misma idea: el service recibe `runInTransaction` y no sabe si detrás hay
MongoDB o la versión en memoria de las pruebas.

`eslint.config.js` hace cumplir las dos reglas (capas y fronteras entre módulos).

### Errores

Los services lanzan errores tipados (`NotFoundError`, `ValidationError`, `ConflictError`,
`DuplicateError`, `InUseError`, `UnauthorizedError`, `AiProviderError`). Un único middleware los
convierte en la respuesta. Los controllers no atrapan errores. El frontend traduce el código de error a
un mensaje en español en un solo archivo.

### Respuestas

- Éxito: `{ "data": ... }`.
- Error: `{ "error": { "code", "message", "details", "requestId" } }`.
- Listados paginados: `{ items, page, pageSize, total }`.

### Integridad, respaldo y puertos de colección

Cada módulo expone un **puerto** de su colección (`createCollectionPort(model, referencias)`), con la
lista de campos que apuntan a otras colecciones. Con los puertos registrados en `composition.ts`
funcionan, sin código extra por módulo:

- el respaldo completo y su restauración;
- el chequeo de integridad;
- el rechazo de un respaldo con referencias rotas.

### La IA como pieza reemplazable

El resto de la app conoce solo la interfaz `AiExtractor`: recibe imágenes, o el texto de un resumen, y
devuelve una extracción con el formato de `extractionResultSchema`. Gemini es una implementación. Cambiar
de proveedor es escribir otra y cambiar una línea en `composition.ts`. Lo que devuelve se valida igual que
cualquier otra entrada.

Los PDF siguen la misma idea con `PdfTextReader` (`providers/pdf/`): da el texto de cada página. El tapado
de datos personales (`shared/src/redaction.ts`) corre en el servidor antes de mostrar el texto, y las
palabras que el usuario tapa se aplican en el teléfono; a la IA solo llega el texto aprobado.

## Frontend

```
src/
  shared/
    api/        Cliente HTTP, caché de datos, traducción de errores
    i18n/es.ts  Todos los textos
    ui/         Componentes base
    layout/     Marco de la app y aviso de servidor despertando
  features/<nombre>/
    api.ts      Consultas y cambios de esa funcionalidad
    *Page.tsx   Pantallas
```

- Los datos del servidor tienen una sola copia: la caché de TanStack Query.
- Las pantallas validan con los esquemas de `shared` y muestran los mensajes de `es.ts`.
- Toda acción que guarda algo pasa por `useAction()` (`shared/ui/useAction.ts`): un solo lugar decide cómo
  se muestra un error.
- `shared/` no importa de `features/`.

## Cómo agregar un módulo

Ejemplo: presupuestos.

1. Esquemas y tipos en `shared/src/schemas/budget.ts`; exportarlos en `shared/src/index.ts`.
2. `backend/src/modules/budgets/` con model, repository (incluido su puerto y referencias), service,
   controller, routes e `index.ts`.
3. En `wiring.ts`: crear el service pasándole lo que necesita de otros módulos. En `composition.ts`:
   pasar su repositorio real y agregar el puerto a `collectionPorts`. En `testing/memory.ts`: su
   repositorio en memoria.
4. En `app.ts`: montar la ruta.
5. Si otro módulo tiene que respetarlo (una categoría con presupuesto no se borra), agregarle esa
   consulta como dependencia.
6. `frontend/src/features/budgets/` con `api.ts` y pantallas; textos en `es.ts`; ruta en `App.tsx`.
7. Pruebas de sus reglas. Documentar en `API.md` y `GLOSARIO.md`.

Ningún módulo existente cambia, salvo el punto 5.

## Pruebas

Corren con el ejecutor de pruebas de Node (`npm test`), sin base de datos ni red:

- `shared`: dinero, fechas, CSV, árbol de categorías, formato de importación, forma del movimiento.
- `backend`: los servicios reales, conectados como en producción, sobre repositorios en memoria
  (`createMemoryBackend()`). Cubren movimientos, fecha de pago, cuentas, categorías, etiquetas, balance
  mensual, papelera, e importación y exportación de punta a punta con archivos CSV, incluido el
  "todo o nada" cuando una escritura falla.
- `backend/src/app.test.ts`: la app de Express de verdad (rutas, autenticación, lectura del cuerpo,
  manejo de errores) sobre el mismo backend en memoria (`testing/memoryApp.ts`), pedida por HTTP como lo
  hace el frontend. Incluye un Excel exportado y vuelto a leer, y el respaldo con su restauración.

Las variables que necesitan (`backend/memory.env`) son inventadas y no llevan secretos. Con las mismas
piezas, `npm run demo` levanta la app con datos de mentira para probar las pantallas a mano.

Lo que estas pruebas no cubren son las consultas de Mongoose: lo que hace cada repositorio real contra la
base (ver `ROADMAP.md`).

Las reglas nuevas llevan prueba.
