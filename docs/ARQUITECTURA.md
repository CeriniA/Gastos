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
    context/           De quién son los datos que toca el código que está corriendo
    crypto/            Guardar un secreto cifrado; notas firmadas de corta vida
    errors/            Errores tipados
    http/              parse(), ok(), sendFile(), asUser()
    middleware/        Autenticación, permiso de administrador y manejo único de errores
    db/                Conexión, transacciones, ids, dueño de cada dato, puertos de colección, migraciones
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
  providers/rates/     Cotización pública de referencia para comprobantes en otra moneda
  migrations/          Cambios numerados sobre datos guardados
  wiring.ts            Donde se conectan los servicios entre sí (sin base de datos)
  container.ts         Usuarios, sesiones, respaldo y Drive armados sobre esos servicios
  composition.ts       Producción: repositorios reales, transacciones reales, puertos de colección
  starter.ts           Con qué arranca cada usuario: categorías, cuentas, bancos
  testing/memory.ts    El backend completo en memoria, para pruebas
  testing/memoryApp.ts El mismo armado de container.ts sobre ese backend, para atender por HTTP
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

### Usuarios y dueños

La app tiene varios usuarios y cada dato es de uno solo. Nadie ve los datos de otro, tampoco el
administrador, que solo crea usuarios, les cambia la contraseña y los activa o desactiva.

**Quién entra.** Los usuarios viven en la colección `users` (módulo `users`), con la contraseña como hash
de bcrypt. El módulo `auth` arma las sesiones: un token JWT que lleva el id del usuario y la versión de
sus sesiones. Cerrar las sesiones de alguien (cerrar sesión en todos lados, cambiar la contraseña,
desactivarlo) sube esa versión, y todo token anterior deja de valer en el acto. El primer usuario, un
administrador, se crea al arrancar con `AUTH_USERNAME` y `AUTH_PASSWORD_HASH`; el resto se crea desde la app.

**De quién es cada dato.** El dueño no viaja como argumento por los services y repositorios: está en un
solo lugar y falla del lado seguro.

1. `core/context/owner.ts` guarda para quién corre el código (`runAsUser`). Sin usuario, pedir el dueño
   **da error**: un olvido rompe, no muestra datos ajenos.
2. `core/db/ownerPlugin.ts` (`ownedByUser`) se agrega al esquema de cada colección de datos. Le pone el
   campo `userId`, hace que toda consulta, actualización, borrado, agregación o escritura en lote vea solo
   lo del usuario que corre, y marca con él todo documento nuevo, diga lo que diga.
3. Los repositorios y los services se escriben como si hubiera un solo usuario.

Quién entra al contexto:

| Dónde                                             | Cómo                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Un pedido HTTP                                    | El controller devuelve sus handlers por `asUser`, que usa el usuario del token   |
| Tareas del servidor (limpieza, Drive, documentos) | `container.forEachUser`: una vuelta por cada usuario                             |
| La vuelta de Google al conectar Drive             | `runAsUser` con el usuario que dice la nota firmada que viajó a Google           |
| Migraciones                                       | Una vez por cada usuario; las marcadas `system` corren una vez con `runAsSystem` |

`asUser` está en el controller y no en un middleware porque entre el middleware de autenticación y el
controller se lee el cuerpo del pedido o sus archivos, y el contexto no sobrevive a eso.

Lo que es único es único **por usuario** (`uniquePerUser`): dos usuarios pueden tener cada uno su cuenta
"Efectivo". El código que usa el driver sin pasar por Mongoose (el respaldo) filtra con `ownedOnly()` y
marca con `stampOwner()`.

`users` es la única colección sin dueño ni puerto de respaldo: no es dato de nadie y guarda secretos. El
permiso de Drive de cada usuario se guarda cifrado (`core/crypto/secretBox.ts`) con una clave derivada de
`JWT_SECRET`.

### Errores

Los services lanzan errores tipados (`NotFoundError`, `ValidationError`, `ConflictError`,
`DuplicateError`, `InUseError`, `UnauthorizedError`, `ForbiddenError`, `AiProviderError`). Un único middleware los
convierte en la respuesta. Los controllers no atrapan errores. El frontend traduce el código de error a
un mensaje en español en un solo archivo.

Lo que queda fuera de un pedido tiene su propia red:

- **Servidor:** una promesa sin esperar que falla se registra y el servidor sigue (`unhandledRejection`); una
  excepción que nadie atrapó se registra y el proceso se reinicia (`uncaughtException`). Las tareas en segundo
  plano atrapan y registran sus errores.
- **Servicios de afuera** (IA, PDF, Drive, cotizaciones): fallan con un error con nombre o devuelven "sin dato",
  pero siempre avisan por `onError` o el log; nunca se tragan el motivo.
- **Frontend:** lo que falla al pedir datos lo muestra `QueryState`; lo que falla al guardar, `useAction`; lo que
  falla al dibujar una pantalla lo atrapa `ErrorBoundary` (`shared/ui/ErrorBoundary.tsx`), con un botón para
  recargar.

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

Los puertos trabajan sobre los datos del usuario que corre: un respaldo tiene los datos de un usuario, y
restaurarlo reemplaza solo los suyos, haciéndolo dueño de lo que entra. Así un respaldo de antes de que
hubiera usuarios se restaura en la cuenta de quien lo sube. La lista de migraciones aplicadas viaja en el
respaldo pero no se restaura: sirve para saber cuáles le faltan a esos datos y aplicárselas.

### La IA como pieza reemplazable

El resto de la app conoce solo la interfaz `AiExtractor`: recibe imágenes, o el texto de un resumen, y
devuelve una extracción con el formato de `extractionResultSchema`. Gemini es una implementación. Cambiar
de proveedor es escribir otra y cambiar una línea en `composition.ts`. Lo que devuelve se valida igual que
cualquier otra entrada.

Los PDF siguen la misma idea con `PdfTextReader` (`providers/pdf/`): da el texto de cada página. Un resumen
puede llegar también en Excel o CSV: `modules/documents/statementFile.ts` reconoce el archivo por sus
primeros bytes y lo pasa a texto; el Excel lo lee `readWorkbook` del módulo `spreadsheet`, que el módulo de
documentos recibe en `wiring.ts` como cualquier otra dependencia. El tapado
de datos personales (`shared/src/redaction.ts`) corre en el servidor antes de mostrar el texto, y las
palabras que el usuario tapa se aplican en el teléfono; a la IA solo llega el texto aprobado.

### Límite de lectura con IA

Cada usuario manda a leer una cantidad de documentos por día (`AI_DAILY_READINGS`, o la que le dé el
administrador). Lo controla `modules/users/aiAllowance.ts`, que solo necesita el repositorio de usuarios y
la fecha. Por eso `composition.ts` (y `testing/memoryApp.ts`) lo arman **antes** que los servicios: el de
documentos lo recibe como `takeAiReading` y el de usuarios lo usa para mostrar cuántas lleva cada uno. Nada
depende de una variable que se asigna después del armado. La cuenta del día vive en `users`, no en los datos
del usuario: no entra en el respaldo.

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
- Los colores son variables de `styles.css` (claro y oscuro); las pantallas usan sus nombres (`bg-surface`,
  `text-primary`), nunca un color escrito. Botones, campos y tarjetas salen de `shared/ui/ui.tsx`; el selector
  de mes, de `shared/ui/MonthNav.tsx`; el ícono de una categoría, de `shared/ui/categoryLook.tsx`; los tamaños
  de los íconos, de `shared/ui/icons.ts`.

## Cambios acordados (7/11/2026, pendientes de implementar)

Esta página describe lo que existe hoy. Esto es lo que va a cambiar, para no sorprender:

- **Los `index.ts` de cada módulo se eliminan.** Solo los usan `composition.ts`, `container.ts` y `app.ts`;
  pasarán a importar los archivos que definen lo que necesitan. Un módulo sigue sin importar a otro, y el lint
  se ajusta a eso. Si `shared/src/index.ts` sigue siendo un barril es una decisión abierta.
- **Módulos nuevos:** `merchants` y `products`, cada uno con sus textos conocidos. **Desaparecen**
  `category-rules` y `product-rules`.
- Los renglones de un ticket siguen **dentro** del movimiento, ahora con el id del producto.
- Reglas de tamaño, complejidad y archivos barril en el lint, y el criterio para inyectar dependencias:
  `ESTANDARES_CODIGO.md`. Lo medido hoy: `AUDITORIA.md`.

## Cómo agregar un módulo

Ejemplo: presupuestos.

1. Esquemas y tipos en `shared/src/schemas/budget.ts`; exportarlos en `shared/src/index.ts`.
2. `backend/src/modules/budgets/` con model (con `schema.plugin(ownedByUser)`), repository (incluido su
   puerto y referencias), service, controller (que devuelve sus handlers por `asUser`), routes e `index.ts`.
3. En `wiring.ts`: crear el service pasándole lo que necesita de otros módulos. En `composition.ts`:
   pasar su repositorio real y agregar el puerto a `collectionPorts`. En `testing/memory.ts`: su
   repositorio en memoria.
4. En `app.ts`: montar la ruta.
5. Si otro módulo tiene que respetarlo (una categoría con presupuesto no se borra), agregarle esa
   consulta como dependencia.
6. `frontend/src/features/budgets/` con `api.ts` y pantallas; textos en `es.ts`; ruta en `App.tsx`.
7. Pruebas de sus reglas, y su ruta en la prueba de `app.test.ts` que comprueba que un usuario no ve lo de
   otro. Documentar en `API.md` y `GLOSARIO.md`.

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
  hace el frontend. Incluye un Excel exportado y vuelto a leer, el respaldo con su restauración, y dos
  usuarios que no ven nada del otro: ni listas, ni un dato pedido por su id, ni su respaldo, ni su Drive.
- `core/db/ownerPlugin.test.ts`: el filtro por dueño sobre Mongoose de verdad, sin base: cada tipo de
  consulta queda acotada al usuario, y sin usuario no hay consulta.
- Informes (`modules/reports/reports.service.test.ts`): por categoría, por cuenta, mes por mes, por comercio,
  todo en una moneda y la proyección. Fijos (`modules/recurrings/recurrings.service.test.ts`): sugerencias,
  marca, estado del mes, nombres por tipo y moneda.
- Resúmenes de cuenta y saldos (`modules/documents/accountStatement.test.ts`): PDF, Excel y CSV, tapado,
  dirección de las transferencias y saldo desde el saldo inicial. La lectura de la respuesta de la IA, en
  `providers/ai/normalize.test.ts`.
- Usuarios (`modules/users/users.service.test.ts`): renombrar, cambiar el tipo y el límite diario de IA.
- Productos corregidos (`modules/product-rules/productRules.service.test.ts`): se recuerdan al confirmar y se
  ofrecen en el ticket siguiente. La hoja "Productos" del Excel, en `modules/spreadsheet/spreadsheet.service.test.ts`.
- Usuarios y sesiones (`modules/auth/auth.service.test.ts`), el cifrado (`core/crypto/crypto.test.ts`) y
  la copia a Drive de cada usuario (`modules/backup/driveBackup.test.ts`).

Las variables que necesitan (`backend/memory.env`) son inventadas y no llevan secretos. Con las mismas
piezas, `npm run demo` levanta la app con datos de mentira para probar las pantallas a mano.

Lo que estas pruebas no cubren son las consultas de Mongoose contra una base de verdad: lo que hace cada
repositorio real, los índices únicos por usuario y la migración que le pone dueño a los datos viejos (ver
`ROADMAP.md`).

Las reglas nuevas llevan prueba.
