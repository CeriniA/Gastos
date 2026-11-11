# Auditoría del código (7 de noviembre de 2026)

Compara el código con `AGENTS.md` y con `LOGICA_NEGOCIO.md`. Es un informe: no se cambió código.
Los números salen de búsquedas sobre `backend/src`, `shared/src` y `frontend/src`; cuentan apariciones
de un texto, no líneas a editar.

## 1. Resultado

El código cumple casi todas las reglas de `AGENTS.md`. Los desvíos son pocos y chicos. Lo grande no es
deuda: es la **distancia hacia el diseño nuevo** (sección 5), que toca muchos archivos.

`npm run check` pasa completo: tipos (`tsc`), lint, auditoría de código y **217 pruebas, 0 fallas**.

Una revisión de lógica posterior (sección 9) encontró además errores de concurrencia en la confirmación de
documentos y otros de menor gravedad. "Cumple casi todas las reglas" vale para el estilo y las capas, no
para la ausencia de errores.

## 2. Lo que está bien

- Ningún `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` ni `TODO` en el código de la app.
- Ningún `'es-AR'` ni `'ARS'` suelto fuera de las pruebas.
- `process.env` solo en `config/env.ts` (excepción: sección 3).
- Los services no importan `express`, `mongoose` ni modelos.
- `runAsSystem` solo se usa en las migraciones.
- Las 12 colecciones con datos de un usuario llevan `ownedByUser` y registran su puerto de respaldo.
- Los 16 controllers de datos devuelven sus handlers por `asUser` (`auth` y `users` no, a propósito).
- El consumo ya cuenta solo egresos, como pide el diseño.

## 3. Desvíos de las reglas

| # | Dónde | Qué pasa | Gravedad |
| - | ----- | -------- | -------- |
| 1 | `frontend/.../ReviewPage.tsx` (3 lugares), `TransactionFormPage.tsx`, `DataPage.tsx` | Tienen su propio `try/catch` con su propio estado de error, en vez de `useAction()`. `DataPage` tiene una segunda versión de `useAction` hecha a mano (`run`, `busy`, `message`) | Media |
| 2 | `card-periods/cardPeriods.model.ts` | Un índice `unique: true` sobre `{accountId, closingDate}` en vez de `uniquePerUser`. Hoy es correcto en la práctica (el id de cuenta ya es de un solo usuario), pero rompe la forma de la regla | Baja |
| 3 | `backend/src/scripts/try-extraction.ts` | Lee `process.env` directamente. Es un script de prueba manual | Baja |
| 4 | `docs/ESPECIFICACION.md` sección 5 | Dice que las categorías "se arman sobre la marcha", pero cada usuario nuevo recibe categorías iniciales (`starter.ts`). El documento está desactualizado | Baja |

Que el punto 1 no lo detecte el lint es el hueco real: la regla se cumple por costumbre, no se hace cumplir.

## 4. Textos repetidos y constantes

Respuesta corta: **no hay que editar millones de líneas, pero tampoco está en un solo lugar.**

- Los valores como `'expense'`, `'income'`, `'transfer'` vienen de listas únicas en `shared/src/constants.ts`
  y TypeScript deriva los tipos de ahí. Cambiar un valor **hace fallar la compilación en cada lugar**,
  nunca queda uno olvidado en silencio. Se escriben a mano unas 211 veces (unas 80 en código de la app y
  el resto en pruebas, demos y el backend de prueba).
- Los otros estados y tipos (`credit_card`, `confirmed`, `card_statement`, `receipt`…) están igual:
  123 apariciones solo en `backend/src/modules`, más de la mitad en pruebas.
- `npm run audit:code` revisa números, código copiado y exports sin uso. **No revisa textos repetidos.**
- **El único caso que sí rompe la regla de "editar sin romper"** es "Cargos financieros": se busca por su
  nombre (`documents/suggestions.ts`, con `nameKey(FINANCIAL_CHARGES_CATEGORY)`). Si el usuario la
  renombra, la app deja de usarla sin avisar. El diseño nuevo lo resuelve con un rol.

Recomendación: **no reemplazar cada texto por una constante**. Con un tipo derivado de la lista, el
compilador ya cumple esa función y el reemplazo sumaría ruido. Lo que sí vale la pena es (a) el rol para
las categorías que la app necesita reconocer y (b) una regla del lint que impida buscar una categoría,
comercio o producto por su nombre.

## 5. Distancia hacia el diseño nuevo

Cuánto toca cada cambio del documento de lógica:

| Cambio | Qué hay hoy | Alcance |
| ------ | ----------- | ------- |
| Sacar `description` y pasar a comercio por id | 163 apariciones en 53 archivos (pantallas, informes, planilla, IA, pruebas, demos) | **Grande** |
| `recurring` e `installmentPlan` por `merchantId` | `merchantKey` o `merchant:` en 91 lugares de 26 archivos | Grande |
| Reemplazar `categoryRule` y `productRule` por textos conocidos | Son dos módulos completos (modelo, repositorio, service, controller, rutas, pruebas) | Grande |
| Sacar las divisiones manuales (hecho el 10/11/2026) | 52 apariciones en 9 archivos del backend y 20 en 4 de la pantalla (15 en el formulario) | Medio, más una migración |
| Productos solo en egresos | El esquema solo prohíbe productos en transferencias (`transaction.ts:132`) | Chico |
| Renglón sin producto con categoría propia | No existe | Chico |
| Rol de categoría | No existe; hoy se busca por nombre | Chico |
| Aviso de duplicado al cargar a mano | Existe al revisar un documento y al importar (`findDuplicates`); el formulario manual no lo usa y compara la fecha exacta, no ±3 días | Medio |
| Estado del resumen y recordatorio | La pantalla de tarjetas muestra cargado y pagado; no hay aviso de vencido | Medio |
| Control con el resumen siguiente | La IA recibe la orden de **ignorar** saldo anterior y pagos recibidos de la tarjeta (`prompt.ts:48`) | Medio (cambia la lectura) |
| PDF de ticket o factura | Los comprobantes solo aceptan imágenes (`documents.service.ts:413`); los PDF solo entran como resumen | Medio |

## 6. Corrección al diseño

`starter.ts` ya entrega a cada usuario nuevo 13 categorías de egresos planas, 5 de ingresos, 3 cuentas
y los bancos y marcas por defecto, **solo cuando el usuario no tiene nada**. Por eso:

- La lista inicial nueva (con subcategorías) reemplaza a la de `starter.ts` para usuarios nuevos.
- Quien ya usa la app no recibe nada solo. Se le ofrece un botón "Agregar categorías sugeridas" que suma
  las que falten sin tocar las suyas.
- `LOGICA_NEGOCIO.md` sección 6 se corrigió en este sentido.

## 7. Riesgos de la implementación

- **Migración con datos reales**: corre una vez por usuario y también sobre un respaldo viejo cuando se
  restaura. Conviene un respaldo a Drive antes del primer arranque con la versión nueva.
- **El backend en memoria** (`testing/memory.ts`) y la prueba de aislamiento entre usuarios
  (`app.test.ts`) tienen que acompañar cada tabla y cada ruta nueva.
- **Sacar `description` afecta a la exportación e importación de planillas**: el formato de archivo
  cambia. Hay que decidir cómo se leen los archivos viejos.
- **Los informes** (categoría, comercios, consumo, evolución, proyección) cambian de base a la vez; es
  donde más riesgo hay de que un total se mueva. Cada uno necesita una prueba que compare antes y después.

## 8. Calidad estructural (medida contra `ESTANDARES_CODIGO.md`)

| Criterio | Qué se midió | Resultado |
| -------- | ------------ | --------- |
| Archivos barril | 17 `index.ts` en `backend/src/modules` (de 1 a 8 reexportaciones cada uno) y `shared/src/index.ts` (26 reexportaciones) | Los 17 de módulos **solo los usan 3 archivos** (`composition.ts`, `container.ts`, `app.ts`, 35 importaciones): ningún módulo importa a otro. Se pueden quitar con poco costo. El de `shared` lo usan 170 archivos |
| Tamaño de archivos | 15 archivos de más de 300 líneas | `ReviewPage.tsx` 869, `transactions.repository.ts` 659, `TransactionFormPage.tsx` 592, `documents.service.ts` 553, `transactions.service.ts` 452, `importFormat.ts` 415. Además `testing/memory.ts` 932 (réplica en memoria de todos los repositorios) y `es.ts` 876 |
| Responsabilidades mezcladas | `transactions.repository.ts` | Guarda movimientos, pero también arma las filas de los informes, los renglones del consumo, las claves de duplicado y la exportación |
| Reglas de tamaño en el lint | `eslint.config.js` | **No hay**: ni líneas por archivo, ni complejidad, ni parámetros |
| Constantes | Dominio en `shared/src/constants.ts` (más de 300 líneas, un solo archivo); las técnicas, al principio de cada proveedor, con nombre | Bien ubicadas. Las claves de caché se repiten como listas sueltas en cada `api.ts` del frontend, incluso entre pantallas (`['transactions', 'balances']`) |
| Valores a mano | Direcciones, tiempos, modelo de IA | Las direcciones y tiempos tienen nombre. El modelo de IA por defecto (`gemini-3.5-flash-lite`) está escrito **dos veces** (`env.ts` y `try-extraction.ts`), y `client.ts` trae `http://localhost:4000` |
| Números sueltos | `scripts/audit.mjs` | Deja pasar `8`, `10`, `12`, `16`, `24`, `60`, `100` y `1000` sin nombre: la lista de permitidos es demasiado ancha |
| Inyección de dependencias | Raíz de composición (`wiring.ts` 269 líneas, `composition.ts`, `container.ts`) | Bien: los services son funciones que reciben sus dependencias; no hay `fetch` directo; los proveedores van detrás de una interfaz. Sin librería ni clases de más |
| Reloj | `Date.now()` o `new Date()` dentro de 4 services (9 usos) | No está inyectado. Conviene inyectarlo solo donde la lógica depende de la hora |

## 9. Errores de lógica (revisión del 7/11/2026)

Una revisión externa señaló los puntos de abajo. Cada uno se verificó leyendo el código. **Ninguno se
reprodujo**: acá no hay MongoDB, y las carreras dependen de cómo se intercalan dos pedidos reales.

**A. Corregir primero**

| # | Hallazgo | Dónde | Qué se confirmó | Gravedad |
| - | -------- | ----- | --------------- | -------- |
| 1 | **Doble confirmación de un documento.** `confirm()` mira que esté listo (`ready`) fuera de la transacción, y la actualización final no pregunta el estado previo. MongoDB reintenta sola una transacción que choca (`withTransaction`), y el reintento no vuelve a mirar el estado: puede crear los movimientos dos veces | `documents.service.ts:538-567`, `documents.repository.ts:143-162`, `core/db/transaction.ts:36` | El código es como se describe. Que se duplique depende de la carrera | Alta |
| 2 | **Confirmar y borrar a la vez.** La actualización final puede devolver `null` (el documento ya no existe) y nadie lo mira: quedan movimientos apuntando a un documento inexistente | `documents.service.ts:567`, `577-588` | Confirmado. Se arregla con la misma corrección que el punto 1 | Media |

**B. Corregir en la base de calidad** (corregidos el 7/11/2026, con prueba: 3, 7, 8, 10 y 11; el 7 y el 11 son
de pantalla y no tienen prueba automática. Faltan el 5, que se prueba con un respaldo grande en Atlas, y el 9,
que se hace junto con las fechas de `shared`.)

| # | Hallazgo | Dónde | Qué se confirmó | Gravedad |
| - | -------- | ----- | --------------- | -------- |
| 3 | Una cuota proyectada que está en la papelera pasa a confirmada al llegar su fecha: `confirmProjectedUpTo` no filtra por `deletedAt` | `transactions.repository.ts:428-431` | Confirmado, pero pesa menos de lo dicho: la papelera no cuenta en los informes y restaurar es una acción del usuario. Igual conviene filtrar | Baja |
| 5 | Restaurar un respaldo corre en **una sola transacción** (borrar e insertar todas las colecciones) | `backup.service.ts:71-85`, `collectionPort.ts:63-82` | El mecanismo está confirmado. Los topes de Atlas que cita el informe (unas 1000 operaciones, 16 MB) no se pueden verificar desde acá: se hace una operación de borrado y una de inserción por colección. El riesgo real es el tiempo máximo de una transacción (60 segundos por defecto en MongoDB) y la memoria del plan gratuito. Hay que probarlo con un respaldo grande en Atlas | Media, sin probar |
| 7 | Un 401 lento desloguea una sesión recién iniciada: el pedido lee el token al enviarse, pero al recibir el 401 se borra el token actual sin compararlo | `client.ts:85`, `110-113` | Confirmado | Baja |
| 8 | El tapado de datos deja pasar un celular de 10 dígitos ("11 5555-5555"; el mínimo es de 12) y un CUIT con puntos ("20.12345678.9"; el patrón acepta guiones o nada). El tapado por etiqueta cubre la línea entera | `redaction.ts:22`, `44` | Confirmado. Es privacidad: se ajusta con el primer resumen real | Media |
| 9 | La regla "fecha no futura" vive solo en el service; `shared` valida solo el formato | `transactions.service.ts:120` | Confirmado. Necesita "hoy", que depende de la zona horaria: pasa a ser una función de `shared/dates.ts` | Baja |
| 10 | `parseAmountToCents(1.005)` da 100 centavos (error de punto flotante en `input * 100`) | `money.ts:16` | Confirmado; solo para números, como las celdas de un Excel | Baja |
| 11 | El botón de descartar de Pendientes no se deshabilita mientras corre; el de reintentar sí | `PendingPage.tsx:77`, `89` | Confirmado | Baja |

**C. Mejora, no error**

| # | Hallazgo | Dónde | Qué se confirmó |
| - | -------- | ----- | --------------- |
| 4 | Las cuotas importadas de una planilla quedan sin plan (`planId: null`) | `spreadsheet.service.ts:286-288` | Es cierto, pero no es un error: el mismo estado existe al leer una cuota de un resumen sin crear su plan. Mejora posible: ofrecer crear el plan |

**D. Descartado**

| # | Hallazgo | Dónde | Por qué |
| - | -------- | ----- | ------- |
| 6 | Carrera en la copia a Drive | `driveBackup.ts:95-104` | `state.running ??= attempt(...)` no ejecuta `attempt` si ya hay una copia en curso. Dos llamadas a la vez lanzan **una sola** |

**E. No verificados:** subir a la vez dos veces el mismo archivo gasta cuota de IA; un Excel chico que
descomprime a mucho carga entero en memoria antes de filtrar filas; el error de la revisión no se limpia al
corregir un campo.

**F. Manejo de errores (revisión del 7/11/2026)**

Lo central estaba bien: un solo `errorHandler`, errores con nombre, tareas en segundo plano que atrapan y
registran, `useAction` en el frontend. Se encontraron cuatro huecos:

| # | Hueco | Estado |
| - | ----- | ------ |
| F1 | El servidor no tenía `unhandledRejection` ni `uncaughtException` | Corregido en `server.ts` |
| F2 | El frontend no tenía `ErrorBoundary`: una pantalla que falla al dibujarse quedaba en blanco | Corregido (`ErrorBoundary.tsx`, texto en `es.crash`) |
| F3 | Tres pantallas (`ReviewPage`, `TransactionFormPage`, `DataPage`) tienen su propio `try/catch` en lugar de `useAction` (la lista inicial incluía por error `AddPage`, `StatementPage` y `BalanceCheck`, que sí lo usan; se corrigió en la sección 11) | Pendiente: va con las reglas de lint (paso 1) |
| F4 | Las cotizaciones se tragaban el motivo del fallo | Corregido: `onError` y aviso en el log. El `catch` de `backup.controller.ts` queda: el motivo ya lo registra `driveBackup` |

## 10. Orden recomendado

1. **Base de calidad**, antes de cualquier función nueva: corregir primero los errores A de la sección 9
   (confirmación de documentos), luego los B, los desvíos 1 a 3 de la sección 3,
   quitar los archivos barril de los módulos, activar las reglas de lint nuevas con su lista temporal
   de excepciones, y ajustar la lista de números permitidos.
2. Actualizar los documentos de `docs/`.
3. Partir **al tocarlos** los archivos grandes que el diseño nuevo ya modifica (todos los de la sección 8
   salvo `importFormat.ts`, que también cambia por la columna de descripción): el repositorio de
   movimientos, la revisión, el formulario, el servicio de documentos y el backend en memoria.
4. Listas nuevas (comercios, productos, textos conocidos, rol) y su migración, sin cambiar todavía las
   pantallas.
5. Movimientos con ids, sin `description` ni divisiones; migración de ambas.
6. Informes por renglón.
7. Tarjetas, duplicados al cargar a mano y PDF.

## 11. Auditoría de cumplimiento (7/11/2026, después de los primeros arreglos)

Se revisó todo el código contra `AGENTS.md`, regla por regla, con búsquedas sobre `backend/`, `frontend/` y
`shared/`. `npm run check` pasa (typecheck, lint, audit y 222 pruebas). Las funciones largas se midieron con un
conteo aproximado de líneas, no con una herramienta.

**Se cumple**

| Regla | Qué se comprobó |
| ----- | --------------- |
| Variables de entorno | Solo `config/env.ts` lee `process.env`. Única excepción: `scripts/try-extraction.ts`, una herramienta manual |
| Dueños de los datos | Los 12 modelos de datos llevan `ownedByUser`; `users` es la excepción prevista. Todos los controllers usan `asUser`, salvo `auth` (previsto). `runAsSystem` solo está en las migraciones. `model.collection` solo se usa en `collectionPort.ts` |
| Integridad | Los 12 puertos de colección están registrados en `composition.ts`, más el de migraciones |
| Qué no hacer | No se registran contraseñas ni tokens. Las imágenes se borran al confirmar (`markConfirmed`) o a los días (`purgeStale`). El tapado de datos se usa antes de mandar texto a la IA. No hay claves en el repositorio (ver D12) |
| Texto de pantalla | El lint pasa: no hay textos en las pantallas |
| Idioma del código | No se encontró código ni comentarios en español fuera de `es.ts`, `legal.ts` y los scripts |
| Fecha de pago | Solo `resolvePaymentDate` la decide; las otras veces que se escribe `paymentDate` es para dejarla vacía o copiar la de un archivo |

**Desvíos**

| # | Desvío | Dónde | Gravedad |
| - | ------ | ----- | -------- |
| D1 | **Archivos barril:** 18 `index.ts` de módulos, más `shared/src/index.ts`. `migrations/index.ts` (30 líneas) es una lista de migraciones, no un barril | `backend/src/modules/*/index.ts` | Media (ya acordado quitarlos) |
| D2 | **Tamaño:** 8 archivos de código superan las 400 líneas: `memory.ts` 969, `ReviewPage.tsx` 929, `es.ts` 914 (es texto), `transactions.repository.ts` 706, `TransactionFormPage.tsx` 631, `documents.service.ts` 600, `transactions.service.ts` 500, `importFormat.ts` 460, `DataPage.tsx` 417. Funciones de más de 80 líneas: `TransactionFormPage` (~550), `createDocumentsService` (~465), `createTransactionsService` (~425), `DataPage` (~350), `createSpreadsheetService` (~290), `createReportsService` (~200) | Varios | Media (el lint todavía no lo exige) |
| D3 | **Dinero fuera de `money.ts`:** el prorrateo de un renglón al cambiar el total usa `Math.round` en `transactions.service.ts:227`; el redondeo de cantidades (`* 1000 / 1000`) está en `consumption.service.ts:45` | Dos services | Media |
| D4 | **Números y reloj sueltos:** `24 * 60 * 60 * 1000` está escrito en `documents.service.ts:390` y en `transactions.service.ts:383`; `+ 1000` en `transactions.service.ts:347`. Además hay `new Date()` directo en `transactions.service.ts` (332, 380, 496) y `backup.service.ts` (46, 97), aunque otros services reciben el reloj. El audit deja pasar estos números porque 1000 está en su lista | Varios | Media |
| D5 | **Moneda escrita a mano:** `starter.ts` tiene `'ARS'` dos veces en lugar de `DEFAULT_CURRENCY` | `starter.ts:34,36` | Baja |
| D6 | **Único sin usuario:** el índice `{ accountId, closingDate }` de los períodos de tarjeta usa `unique: true` y no `uniquePerUser`. Hoy no choca porque una cuenta es de un solo usuario | `cardPeriods.model.ts:32` | Baja |
| D7 | **`try/catch` propio en pantallas** en vez de `useAction`: `ReviewPage` (3), `TransactionFormPage` (1, necesita los avisos por campo) y `DataPage` (su propio `run` con tonos de mensaje). Corrige la lista del hueco F3 de la sección 9 | Tres pantallas | Media |
| D8 | **Búsqueda por nombre:** "Cargos financieros" se busca por su texto (`FINANCIAL_CHARGES_CATEGORY`, usado en `suggestions.ts`). Ya está previsto cambiarlo por un rol | `constants.ts:103` | Media (planificado). **Corregido:** la categoría lleva `role` y `suggestions.ts` la busca por rol |
| D9 | **Códigos HTTP sueltos** (201, 202, 400, 409, 502…) escritos en controllers y en `errors.ts`, sin constantes con nombre | Controllers y errores | Baja |
| D10 | **`API.md` incompleto:** 14 rutas no figuran: `GET /accounts/balances`, `GET /accounts/:id/balance`, `GET /consumption/summary`, `GET /consumption/items`, `GET /documents`, `DELETE /documents/:id`, `GET /recurrings`, `GET /reports/categories`, `/accounts`, `/merchants`, `/evolution`, `GET /spreadsheet/export`, `GET /transactions/summary`, `GET /transactions/last-rate`. Pueden estar descritas en prosa; la tabla no las tiene | `docs/API.md` | Media (regla 4) |
| D11 | **Pruebas:** `exchange-rates`, `institutions` y `tags` no tienen archivo de pruebas propio; el frontend no tiene ninguna. No se verificó ruta por ruta que la prueba de aislamiento entre usuarios las cubra | Varios | Baja |
| D12 | **Archivo de credenciales de Google en `docs/`:** `client_secret_…json`. Git lo ignora (`.gitignore`) y nunca estuvo en el historial, pero queda dentro de la carpeta del proyecto | `docs/` | Media: moverlo fuera del proyecto |
| D13 | **El lint no exige** tamaño, complejidad, barriles, `useAction` ni búsqueda por nombre; solo capas y textos. Por eso D1, D2, D7 y D8 pudieron aparecer | `eslint.config.js` | Media (es el paso 1 del plan) |

**Lo que cambia en el plan.** D3, D4, D5, D6, D9 y D10 son arreglos chicos que entran en el paso 1, junto con los
barriles y el lint. D2 y D7 se atacan al tocar esos archivos. D8 ya desapareció con el rol de categoría. D12 lo hace la
persona dueña del proyecto: moverlo a una carpeta fuera del proyecto.

**Estado de los desvíos chicos (7/11/2026, segunda pasada)**

| # | Estado |
| - | ------ |
| D3 | Corregido: `scaleCents` y `addQuantities` en `money.ts`, con prueba. Los dos services los usan |
| D4 | Corregido: `MS_PER_SECOND/MINUTE/HOUR/DAY` y `shiftMoment` en `shared/src/dates.ts`; `server.ts`, `auth.routes.ts` y los dos services los usan. El reloj (`now`) se inyecta en `transactions` y en `backup` (`wiring.ts`, `container.ts`). Quedan constantes locales de tiempo en `googleDrive.ts`, `auth.service.ts`, `openExchangeRates.ts` y `gemini.ts`: son propias de cada archivo y ya tienen nombre y motivo |
| D5 | Corregido: `starter.ts` usa `DEFAULT_CURRENCY` |
| D6 | Corregido: el índice usa `uniquePerUser`. En una base que ya existe, MongoDB crea el índice nuevo y deja el viejo (`accountId_1_closingDate_1`); es inofensivo, y se puede borrar a mano desde Atlas cuando se quiera |
| D9 | Corregido: `core/http/status.ts` (`HTTP_STATUS`) en controllers, errores y el manejador de errores |
| D10 | **Era un falso positivo de esta auditoría:** comparé mal las rutas que en `API.md` llevan `?mes=…`. Con la comparación corregida, las 69 rutas están documentadas |

**Fechas y horas.** Ninguno de estos cambios toca los días de calendario, que siguen como texto `YYYY-MM-DD`
y solo se calculan en `shared/src/dates.ts`. `shiftMoment` y `MS_PER_*` se usan únicamente con instantes (cuándo
se mandó algo a la papelera, cuándo vence un reintento), que se guardan como `Date` en UTC y no dependen de la zona
horaria. Los días de gracia de la papelera se cuentan en milisegundos, así que un cambio de horario de verano
no los corre.

**D7 corregido (7/11/2026).** `ReviewPage`, `TransactionFormPage` y `DataPage` ya no arman su propio estado de
error: todo guardado pasa por `useAction`. El hook acepta ahora `run(trabajo, { onError })`: si `onError`
devuelve `true`, la pantalla ya marcó los campos que el servidor rechazó y no se arma el aviso general. En
`ReviewPage`, corregir un campo también limpia el aviso de arriba, que antes quedaba colgado. `DataPage` conserva
su estado para los resultados que no son errores ("restaurado", "integridad rota"). Se comprobó con `npm run check`
y con la pantalla de datos en la demo (un archivo roto muestra el aviso de error); el envío de un movimiento con
rechazo del servidor y la revisión de un documento no se recorrieron a mano.

**D14 (hallazgo nuevo, baja).** Importar un archivo `.xlsx` corrupto responde un error 500 ("Algo falló en el
servidor") en lugar de un mensaje de validación, como sí hace la lectura de resúmenes (`documents.service.ts`).
Falta atrapar el error de lectura en `spreadsheet.service.ts` y devolver un `VALIDATION` en el campo `file`.

**D1 corregido (7/11/2026).** Los 18 `index.ts` de los módulos se borraron; `app.ts`, `composition.ts`, `container.ts`, `memoryApp.ts`, los scripts y una prueba importan del archivo que define cada cosa. El lint ahora prohíbe que un módulo importe a otro (cualquier `../<módulo>`), y se comprobó con dos archivos de prueba que lo rechaza. `migrations/index.ts` se queda (es una lista para registrar) y `shared/src/index.ts` sigue pendiente de decisión.

**Frente de calidad cerrado (7/11/2026).**
- **D13 corregido:** `eslint.config.js` exige ahora tamaño de archivo (400 líneas), de función (80), complejidad (15), parámetros (4) y anidado (4), y prohíbe `try/catch` propio en las pantallas. Con las líneas en blanco y los comentarios sin contar, se midió: **4 archivos** pasan de 400 líneas (`documents.service.ts`, `transactions.repository.ts`, `ReviewPage.tsx`, `TransactionFormPage.tsx`; los otros de la lista de D2 no pasan al medir así), **31 archivos** tienen alguna función de más de 80 líneas, **11** de más de 15 de complejidad y **1** de más de 4 niveles. Todos están en `lint-exceptions.js`, que solo puede achicarse. Parámetros: ninguno pasa de 4.
- **D2:** queda como trabajo gradual: cada archivo sale de la lista cuando se parte, y se parte cuando un cambio de la lógica nueva lo toca.
- **Números del audit:** `24`, `60` y `1000` y los códigos HTTP dejaron de estar permitidos sueltos. Eso hizo aparecer 5 casos más, ya corregidos (`MS_PER_SECOND`, y `OBJECT_ID_LENGTH` para los 24 caracteres de un id).
- **Error #9:** la regla de fecha futura usa `isFutureDay` de `shared/src/dates.ts`.
- **D14 corregido:** un `.xlsx` roto al importar responde `VALIDATION` en el campo `file`, con su prueba.
- **Quedan:** el error #5 (probar restaurar un respaldo grande en Atlas), y D12 (mover el `client_secret` fuera de `docs/`).
