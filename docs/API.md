# API

Prefijo: `/api/v1`. Todas las rutas piden `Authorization: Bearer <token>`, salvo las marcadas como
públicas.

- Éxito: `{ "data": ... }`. Borrados: `204` sin cuerpo.
- Error: `{ "error": { "code", "message", "details", "requestId" } }`.
- Dinero en centavos enteros. Fechas `YYYY-MM-DD`. Meses `YYYY-MM`.

Los esquemas de entrada y los tipos de salida están en `shared/src/schemas/`.

## Códigos de error

| Código                | HTTP | Cuándo                                                                                                                                 |
| --------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION`          | 400  | Datos inválidos. `details.issues` lista `{ path, message }`                                                                            |
| `INVALID_BACKUP`      | 400  | El archivo no es un respaldo, es de una versión más nueva, o tiene datos que hoy son de otro usuario (`details.reason = "other_user"`) |
| `INTEGRITY`           | 400  | El respaldo tiene referencias a datos que no incluye                                                                                   |
| `UNAUTHORIZED`        | 401  | Falta el token o venció                                                                                                                |
| `INVALID_CREDENTIALS` | 401  | Usuario o contraseña incorrectos, o usuario desactivado                                                                                |
| `FORBIDDEN`           | 403  | Hace falta ser administrador                                                                                                           |
| `NOT_FOUND`           | 404  | No existe                                                                                                                              |
| `CONFLICT`            | 409  | La operación no se puede hacer en el estado actual                                                                                     |
| `DUPLICATE`           | 409  | Ya existe uno con ese nombre                                                                                                           |
| `IN_USE`              | 409  | No se puede borrar porque otros datos lo usan                                                                                          |
| `PAYLOAD_TOO_LARGE`   | 413  | Archivo o pedido demasiado grande                                                                                                      |
| `RATE_LIMITED`        | 429  | Demasiados intentos de login                                                                                                           |
| `AI_PROVIDER`         | 502  | Falló el servicio de lectura (etapa 2)                                                                                                 |
| `AI_LIMIT`            | 429  | El usuario ya mandó a leer todos los documentos que puede hoy                                                                          |
| `INTERNAL`            | 500  | Error inesperado                                                                                                                       |

## Estado y acceso

| Método | Ruta               | Descripción                                                                                 |
| ------ | ------------------ | ------------------------------------------------------------------------------------------- |
| GET    | `/health`          | **Pública.** `{ status, database }`                                                         |
| POST   | `/auth/login`      | **Pública.** `{ username, password }` → `{ token, expiresAt }`. 10 intentos cada 15 minutos |
| GET    | `/auth/me`         | Sesión actual: `{ userId, username, role, expiresAt }`                                      |
| POST   | `/auth/logout-all` | Cierra las sesiones de quien lo pide en todos los dispositivos, incluido este               |

El token es un JWT que nombra al usuario. **Todo lo que devuelve o cambia cualquier otra ruta son datos del
usuario del token**: pedir por su id un dato de otro usuario responde `NOT_FOUND`.

## Usuarios

| Método | Ruta                 | Descripción                                                                                                          |
| ------ | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| POST   | `/users/me/password` | `{ currentPassword, newPassword }`. Cualquier usuario. Cierra sus sesiones: responde `204` y hay que volver a entrar |
| GET    | `/users`             | **Solo administrador.** `[{ id, username, role, active, aiDailyLimit, aiLimit, aiReadingsToday, createdAt }]`        |
| POST   | `/users`             | **Solo administrador.** `{ username, password, role? }` (`role`: `user` por defecto, o `admin`)                      |
| PATCH  | `/users/:id`         | **Solo administrador.** `{ username?, role?, password?, active?, aiDailyLimit? }`. Ver abajo                         |

Quien no es administrador recibe `FORBIDDEN`. La contraseña nueva tiene al menos 8 caracteres. Un nombre de
usuario repetido (sin distinguir mayúsculas ni acentos) responde `DUPLICATE`; desactivarse a uno mismo o
cambiarse el propio tipo, `CONFLICT`: así siempre queda un administrador. Una contraseña nueva y desactivar
cierran las sesiones de ese usuario; renombrarlo o cambiarle el tipo, no (el tipo vale desde el pedido
siguiente). No hay ruta para borrar un usuario ni para ver sus datos.

**Lecturas con IA por día.** Cada documento que se manda a leer (`POST /documents`, `POST /documents/statement`
y `POST /documents/:id/retry`) cuenta uno para el usuario. Pasado su límite responde `AI_LIMIT` (429) y no
se guarda nada; al día siguiente vuelve a cero. El límite es `aiDailyLimit` del usuario, o, si es `null`, el
de la instalación (`AI_DAILY_READINGS`, 30 si no se configura); `aiLimit` es el que rige. `0` deja al
usuario sin IA. Volver a subir un documento que todavía se está leyendo no cuenta, y los reintentos solos
cuando la IA no tiene cupo tampoco. Pasado el límite, volver a subir un documento que espera revisión lo deja
como estaba: el límite se controla antes de reemplazar nada.

## Cuentas

| Método | Ruta                                  | Descripción                                                                                     |
| ------ | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/accounts`                           | Todas, incluidas las archivadas                                                                 |
| POST   | `/accounts`                           | `{ name, type, currency, bankId?, networkId?, openingBalance? }`                                |
| GET    | `/accounts/balances?on=YYYY-MM-DD`    | Saldo de cada cuenta no archivada: `[{ accountId, currency, balanceCents, on }]`. Sin `on`, hoy |
| GET    | `/accounts/:id/balance?on=YYYY-MM-DD` | El saldo de una cuenta ese día                                                                  |
| GET    | `/accounts/:id`                       |                                                                                                 |
| PATCH  | `/accounts/:id`                       | `{ name?, archived?, bankId?, networkId?, openingBalance? }`. Tipo y moneda no cambian          |
| DELETE | `/accounts/:id`                       | `IN_USE` si tiene movimientos, cierres o planes de cuotas                                       |

`bankId` apunta a un banco o emisor y `networkId` a una marca de tarjeta (solo tarjetas de crédito), los dos
de `/institutions`.

## Bancos y tarjetas

| Método | Ruta                | Descripción                                                 |
| ------ | ------------------- | ----------------------------------------------------------- |
| GET    | `/institutions`     | Bancos (`kind: bank`) y marcas de tarjeta (`kind: network`) |
| POST   | `/institutions`     | `{ name, kind }`. Nombre único dentro de su tipo            |
| PATCH  | `/institutions/:id` | `{ name?, archived? }`. El tipo no cambia                   |
| DELETE | `/institutions/:id` | `IN_USE` si alguna cuenta lo usa; en ese caso se archiva    |

La lista arranca con los bancos y marcas más comunes de Argentina (migración
`2026-10-12-default-institutions`).

## Tarjetas: cierres y vencimientos

| Método | Ruta                         | Descripción                                                                                                           |
| ------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/card-periods?accountId=`   | `{ periods, open }`: cada cierre con lo que la app le cargó (`chargedCents`), y lo comprado después del último cierre |
| POST   | `/card-periods`              | `{ accountIds, closingDate, dueDate, totalCents?, minimumPaymentCents? }`. Un período por cuenta, todos o ninguno     |
| PATCH  | `/card-periods/:id`          | Cualquiera de los cuatro datos                                                                                        |
| DELETE | `/card-periods/:id`          | Sus compras vuelven a pagarse en su propia fecha; sus pagos quedan como transferencias sueltas                        |
| POST   | `/card-periods/:id/payments` | `{ accountId, date, amountCents, toAmountCents? }`. Registra un pago del resumen. Responde la transferencia creada    |

Cada período trae `paidCents`: lo que suman sus pagos, en la moneda de la tarjeta.

Un pago es una **transferencia** desde la cuenta `accountId` a la tarjeta, ligada al resumen (`cardPeriodId`);
no es un egreso. `amountCents` es lo que sale de esa cuenta. Si la cuenta y la tarjeta tienen monedas
distintas hace falta `toAmountCents`, lo que cubre del resumen. Se edita y se borra como cualquier movimiento;
en la papelera deja de contar como pago.

Una compra con tarjeta se paga en el vencimiento del primer cierre igual o posterior a su fecha. Al crear,
cambiar o borrar un cierre, el backend recalcula la fecha de pago de las compras de esa tarjeta.

## Cuotas

| Método | Ruta                     | Descripción                                                                                             |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| POST   | `/installment-plans`     | `{ transaction, installments }` (2 a 60). `transaction` es la compra entera; crea un movimiento por mes |
| DELETE | `/installment-plans/:id` | Manda todas las cuotas a la papelera: `{ trashed }`. El plan queda                                      |

Cada cuota tiene la fecha de la compra más los meses que corresponden. Las que ya llegaron quedan
`confirmed`; las futuras, `projected`, y se confirman solas cuando llega su fecha (al arrancar el servidor y
una vez por día). Los centavos que no dividen exacto van a la primera cuota, y los productos también.

## Categorías

| Método | Ruta                    | Descripción                                                         |
| ------ | ----------------------- | ------------------------------------------------------------------- |
| GET    | `/categories`           | Lista plana con `parentId` y `depth`                                |
| POST   | `/categories`           | `{ name, kind, parentId }`                                          |
| PATCH  | `/categories/:id`       | `{ name?, parentId?, archived? }`. Cambiar `parentId` mueve la rama |
| DELETE | `/categories/:id`       | `IN_USE` si tiene subcategorías o movimientos                       |
| POST   | `/categories/:id/merge` | `{ targetId }`. Pasa sus movimientos a la otra y la borra           |

## Etiquetas

| Método | Ruta        | Descripción                         |
| ------ | ----------- | ----------------------------------- |
| GET    | `/tags`     |                                     |
| POST   | `/tags`     | `{ name }`                          |
| PATCH  | `/tags/:id` | `{ name }`                          |
| DELETE | `/tags/:id` | La quita también de sus movimientos |

## Comercios y productos

Listas del usuario. Cada elemento tiene sus **textos conocidos** (`aliases`): lo que un ticket o un resumen
imprime para él. Un nombre o un texto conocido apunta a un solo elemento (`DUPLICATE` si ya es de otro, sin
distinguir mayúsculas ni tildes). Se archivan, se borran si nadie los usa y se unen con otro.

| Método | Ruta            | Descripción                                                                                                  |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/merchants`     | Incluye los archivados                                                                                       |
| POST   | `/merchants`     | `{ name, defaultCategoryId?, aliases? }`. La categoría habitual es de egresos                                |
| PATCH  | `/merchants/:id` | Cualquiera de `name`, `defaultCategoryId` (o `null`), `aliases` (la lista completa), `archived`            |
| GET    | `/products`      | Incluye los archivados                                                                                       |
| POST   | `/products`      | `{ name, categoryId, aliases? }`. La categoría es de egresos                                                |
| PATCH  | `/products/:id`  | Cualquiera de `name`, `categoryId`, `aliases` (la lista completa), `archived`                              |
| DELETE | `/merchants/:id`, `/products/:id` | Solo si ningún movimiento (o renglón) apunta a él; si no, `IN_USE`. Archivalo o unilo |
| POST   | `/merchants/:id/merge`, `/products/:id/merge` | `{ targetId }`. Lo que apuntaba a este pasa al otro, que aprende su nombre y sus textos conocidos; este se borra. `VALIDATION` si es el mismo; `CONFLICT` si el resultado pasa el máximo de textos conocidos |

Una categoría con productos no se puede borrar (`IN_USE`); al unirla con otra, sus productos y la categoría
habitual de sus comercios la siguen.

## Movimientos

| Método | Ruta                                        | Descripción                                                                              |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/transactions`                             | Paginado. Filtros abajo                                                                  |
| POST   | `/transactions`                             | Carga manual                                                                             |
| GET    | `/transactions/summary?month=YYYY-MM`       | Ingresos, egresos y balance por moneda, según fecha de pago                              |
| GET    | `/transactions/last-rate?currency=BRL`      | Último cambio que se aplicó a esa moneda: `{ rate, date }`                               |
| GET    | `/exchange-rates/reference?from=BRL&to=ARS` | Cotización pública de referencia: `{ rate, from, to, asOf, source }`, o `null` si no hay |
| GET    | `/transactions/:id`                         |                                                                                          |
| PATCH  | `/transactions/:id`                         | Parcial. El resultado se valida completo                                                 |
| DELETE | `/transactions/:id`                         | A la papelera                                                                            |
| POST   | `/transactions/:id/restore`                 | Saca de la papelera                                                                      |
| DELETE | `/transactions/:id/permanent`               | Borra del todo un movimiento que está en la papelera. No se puede deshacer               |
| DELETE | `/transactions/trash`                       | Vacía la papelera: `{ deleted }`                                                         |

Filtros de `GET /transactions`: `page`, `pageSize` (máx. 200), `month` (por fecha de pago), `from`, `to`
(por fecha), `type`, `accountId`, `categoryId` (incluye subcategorías), `tagId`, `source`, `q` (texto en
descripción o nota), `deleted=true` (papelera).

Cuerpo de alta:

```json
{
  "type": "expense",
  "refund": false,
  "date": "2026-10-05",
  "amountCents": 1540050,
  "currency": "ARS",
  "accountId": "…",
  "categoryId": "…",
  "merchantId": null,
  "description": "Edesur",
  "note": "",
  "tagIds": [],
  "toAccountId": null,
  "toAmountCents": null,
  "paymentDate": null,
  "original": null,
  "items": []
}
```

`refund: true` marca una devolución: solo en un egreso (si no, `VALIDATION`) y nunca en cuotas. Su monto es
positivo y resta del egreso del mes, del resumen de la tarjeta y del consumo. Si se omite es `false`.

`merchantId` es el comercio de la lista (`/merchants`), solo en un egreso y opcional; archivado, solo lo conserva
un movimiento que ya lo tenía. La `description` sigue existiendo hasta que se quite en un paso siguiente.

`items` son los productos: `[{ "name", "amountCents", "product", "group", "quantity", "productId", "categoryId" }]`, hasta 200.
`productId` es un producto de la lista; `categoryId` es la categoría propia de un renglón sin producto (con
producto, la categoría es la del producto y mandar las dos da `VALIDATION`). Los dos son solo de egresos.
Son opcionales y no tienen que sumar el total (un descuento es un renglón con monto negativo). Una
transferencia no lleva productos. En una edición, mandar `items` los reemplaza todos; no mandarlo los deja
como están.

`original` se usa cuando el comprobante estaba en otra moneda:
`{ "amountCents": 5000, "currency": "BRL", "rate": 272.5 }`. `amountCents` y `currency` del movimiento son
siempre los de la cuenta. El `rate` no se guarda como llega: el backend guarda el que resulta de dividir
el monto por el original, así que al cambiar `amountCents` cambia solo. Si un movimiento convertido
cambia de monto, sus productos cambian en la misma proporción.

## Respaldo

| Método | Ruta                     | Descripción                                                                                                                                   |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/backup/export`         | Descarga el respaldo completo de los datos del usuario (JSON)                                                                                 |
| POST   | `/backup/restore`        | Cuerpo: el respaldo. Reemplaza todos los datos del usuario o no cambia nada. Hasta 25 MB                                                      |
| GET    | `/backup/integrity`      | `{ ok, checkedAt, broken[] }`                                                                                                                 |
| GET    | `/backup/drive`          | La copia del usuario en su Drive: `{ available, connected, lastSavedAt, lastError }`                                                          |
| POST   | `/backup/drive`          | Copia a Drive ahora. Responde el mismo estado; un error va en `lastError` (`not_authorized`, `unavailable`)                                   |
| DELETE | `/backup/drive`          | Desconecta el Drive del usuario: la app se olvida del permiso. Responde el estado                                                             |
| POST   | `/backup/drive/connect`  | `{ url }`: la página de Google donde el usuario da el permiso. `CONFLICT` si el servidor no tiene Drive configurado                           |
| GET    | `/backup/drive/callback` | **Pública.** Ahí manda Google al navegador con `code` y `state`. Guarda el permiso y redirige a `/mas/datos?drive=connected\|refused\|failed` |

`available` es `false` cuando al servidor le faltan `DRIVE_CLIENT_ID`, `DRIVE_CLIENT_SECRET` o
`PUBLIC_API_URL`; `connected`, cuando este usuario todavía no conectó su Drive. El `state` es una nota
firmada por el servidor, válida 10 minutos, que dice qué usuario vuelve: la ruta no usa token de sesión.

Un respaldo de antes de que hubiera usuarios se restaura igual: sus datos pasan a ser de quien lo sube.

## Planillas

| Método | Ruta                                             | Descripción                                                                                       |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| GET    | `/spreadsheet/export?format=xlsx\|csv&from=&to=` | Movimientos confirmados en el formato de importación. El Excel trae una segunda hoja, "Productos" |
| GET    | `/spreadsheet/template`                          | Planilla vacía con los encabezados                                                                |
| POST   | `/spreadsheet/import/preview`                    | `multipart/form-data`, campo `file` (.xlsx o .csv, 5 MB, 2000 filas). No guarda nada              |
| POST   | `/spreadsheet/import/review`                     | `{ rows: [{ line, row }] }`. Vuelve a revisar filas ya leídas. No guarda nada                     |
| POST   | `/spreadsheet/import/commit`                     | `{ rows, createMissing }`. Todo o nada                                                            |

La vista previa informa `unknownAccounts` (nombres de cuenta que no existen) y `newCategories`
(`{ kind, path }` de cada categoría que habría que crear). Para apuntar una de esas a una existente, el
cliente reescribe las filas con el nombre o la ruta elegidos y las manda a `/import/review`, que responde
con el mismo formato que la vista previa.

## Reglas de categoría

"Este comercio va siempre a esta categoría." Una regla por comercio, sin distinguir mayúsculas ni acentos.

| Método | Ruta                  | Descripción                                                                |
| ------ | --------------------- | -------------------------------------------------------------------------- |
| GET    | `/category-rules`     | Todas                                                                      |
| PUT    | `/category-rules`     | `{ merchant, categoryId }`. Crea la regla o cambia la del comercio         |
| DELETE | `/category-rules/:id` |                                                                            |
| GET    | `/product-rules`      | Productos corregidos que la app recuerda: `[{ id, name, product, group }]` |
| DELETE | `/product-rules/:id`  | La olvida: ese renglón vuelve a proponerse como lo lee la IA               |

## Documentos

Tickets, capturas y resúmenes de tarjeta leídos con IA. La subida responde enseguida; la lectura ocurre en
segundo plano.

| Método | Ruta                                       | Descripción                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/documents?status=pending\|all`           | `pending` (por defecto): procesando, listos para revisar y con error                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| POST   | `/documents`                               | `multipart/form-data`: `kind` (`receipt` o `screenshot`), `accountId` opcional y de 1 a 10 imágenes en `files` (JPG, PNG o WEBP, 5 MB cada una). Responde `202`                                                                                                                                                                                                                                                                                                                                                                                             |
| POST   | `/documents/statement/preview`             | `multipart/form-data`: el archivo de un resumen en `file`, PDF (hasta 20 páginas), Excel `.xlsx` o CSV (hasta 5 MB), y `password` opcional para un PDF. Devuelve `{ text, pages, hidden, fileType }`: el texto con los datos personales reconocibles tapados. No guarda nada ni llama a la IA                                                                                                                                                                                                                                                               |
| POST   | `/documents/statement`                     | `{ kind?, text, fileName, accountId? }`: el texto que el usuario aprobó (hasta 100.000 caracteres). `kind` es `card_statement` (por defecto) o `account_statement` (un banco, MercadoPago, una app). Crea el documento sin imágenes. Responde `202`                                                                                                                                                                                                                                                                                                         |
| GET    | `/documents/:id`                           | Detalle con `extraction` (lo leído, con la categoría sugerida ya resuelta), `text` (el texto de un resumen, hasta confirmarlo) y `duplicateHints`: por cada movimiento, `existing`, `repeated` o `null`                                                                                                                                                                                                                                                                                                                                                     |
| GET    | `/documents/:id/files/:index`              | Una de las imágenes. Deja de existir al confirmar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| POST   | `/documents/:id/retry`                     | Vuelve a leer ya un documento con error, ya leído o esperando a la IA (descarta el resultado anterior y la espera)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| POST   | `/documents/:id/confirm`                   | `{ transactions: [{ transaction, installment, continuePlan }], rules, productRules, cardPeriods }` (`continuePlan: true` en una cuota que no es la última crea su plan y las cuotas que faltan, proyectadas) (los productos van en `transaction.items`; `cardPeriods`, solo para un resumen, son hasta 2 cierres con la forma de `POST /card-periods`). Crea los cierres, los movimientos y las reglas, y borra las imágenes o el texto. Todo o nada. `productRules` son `{ name, product, group }`: los renglones corregidos que el usuario pidió recordar |
| DELETE | `/documents/:id?transactions=keep\|delete` | Sin confirmar: lo descarta. Confirmado: sus movimientos quedan como manuales (`keep`) o van a la papelera (`delete`); los cierres que se guardaron de él quedan, sin el vínculo                                                                                                                                                                                                                                                                                                                                                                             |

Si la IA está sin cupo o no responde (`rate_limited`, `unavailable`), el documento no pasa a `error`: sigue
en `processing` con `retryAt` (cuándo se vuelve a intentar solo) y `waits` (cuántas veces esperó). Las
esperas son de 1, 5, 15, 30, 60, 120, 240 y 480 minutos (`DOCUMENT_RETRY_DELAYS_MINUTES`); después de la
última pasa a `error`. Mientras el servidor está despierto revisa cada minuto; también al pedir la lista
de pendientes.

Estados: `processing` → `ready` → `confirmed`, o `error` (con `errorCode`: `rate_limited`, `unavailable`,
`not_configured`, `blocked`, `unreadable`).

Resumen: el archivo se lee en memoria y se descarta. Se reconoce por sus primeros bytes, no por el nombre. Si
no se puede usar, la respuesta es `VALIDATION` sobre `file` (no es PDF, Excel ni CSV; es un Excel viejo `.xls`;
demasiadas páginas o filas; imagen escaneada sin texto; demasiado texto; no se pudo abrir)
o sobre `password` (falta o es incorrecta). La extracción de un resumen trae `statement` con `closingDate`,
`dueDate`, `nextClosingDate`, `nextDueDate`, `totalCents`, `minimumPaymentCents` y `currency`. Las cuotas
mayores a la primera vienen fechadas el día del cierre. Un cierre que ya existe para esa tarjeta hace fallar
la confirmación con `DUPLICATE`. En `duplicateHints`, `existing` también marca una cuota ("3 de 6") que ya
está guardada por el mismo monto, aunque sea en otra fecha.

Resumen de cuenta (`account_statement`): trae ingresos, egresos y transferencias. Cada transferencia trae
`incoming`: `true` si la plata entró a esa cuenta desde otra del usuario, `false` si salió. Su `statement`
trae `fromDate`, `toDate`, `openingBalanceCents` y `closingBalanceCents` (con signo) y `currency`; los campos
de tarjeta vienen en `null`.

**Saldo de una cuenta.** `openingBalance` es `{ amountCents, date }` (con signo: negativo es deuda) o `null`:
lo que tenía la cuenta al empezar `date`, antes de los movimientos de ese día.
El saldo de un día es ese monto más los movimientos confirmados desde `date` hasta ese día, incluidos: los
ingresos y lo que llega suman; los egresos y lo que sale restan; una devolución devuelve. Sin saldo inicial
cuenta desde cero, con todos los movimientos. Las cuotas proyectadas y la papelera no entran. Se calcula,
no se guarda.

Subir un archivo (o el mismo texto de un resumen) ya confirmado y con movimientos vigentes responde `DUPLICATE`, con el documento existente en
`details`. En cualquier otro caso el archivo se lee de nuevo. Sin
`GEMINI_API_KEY` configurada, la subida responde `AI_PROVIDER` con `details.reason = "not_configured"`.

## Consumo

Qué se compró, según los productos de los movimientos (leídos de un ticket o cargados a mano). Solo cuenta egresos confirmados que tienen
detalle de productos; los que están en la papelera no entran.

| Método | Ruta                                   | Qué hace                                                                                 |
| ------ | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/consumption/summary?month=YYYY-MM`   | Por moneda → grupo → producto: total, cantidad de veces y cantidad sumada (si se conoce) |
| GET    | `/consumption/items?q=leche&from=&to=` | Renglones de ticket que contienen esas palabras, del más nuevo al más viejo (máx. 200)   |

Cada producto de un movimiento es `{ name, amountCents, product, group, quantity }`: `name` es el texto
del ticket, `product` el nombre genérico en español ("Leche"), `group` uno de `PRODUCT_GROUPS`
(`shared/src/constants.ts`) o `null`, y `quantity` la cantidad o `null`.

## Informes

| Método | Ruta                                      | Qué hace                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/reports/categories?month=YYYY-MM`       | Ingresos y egresos del mes por categoría, por moneda: `{ month, currencies, consolidated }`                                                                                                                                                                                                                                                                   |
| GET    | `/reports/accounts?month=YYYY-MM`         | Por cuenta: `{ month, balanceOn, accounts: [{ accountId, name, currency, incomeCents, expenseCents, transfersInCents, transfersOutCents, closingBalanceCents }], consolidated }`. Todas las cuentas no archivadas (y las archivadas que se movieron), con el saldo al último día del mes (hoy, si es el mes actual); `null` antes del día de su saldo inicial |
| GET    | `/reports/evolution?to=YYYY-MM&months=12` | Mes por mes, del más viejo al último: `{ months: [{ month, totals }], consolidated }`. `months` de 1 a 36                                                                                                                                                                                                                                                     |
| GET    | `/reports/merchants?month=YYYY-MM`        | Egresos por comercio: por moneda, `{ currency, totalCents, merchants: [{ name, totalCents, count }], othersCents }`                                                                                                                                                                                                                                           |
| GET    | `/reports/projection`                     | Este mes y los dos siguientes: lo cargado más lo esperado (cuotas por venir y fijos sin aparecer)                                                                                                                                                                                                                                                             |

Cada moneda trae `income` y `expense`, cada uno con `totalCents` y `categories`: las categorías principales
con algo en el mes, de mayor a menor. Cada categoría es `{ categoryId, name, totalCents, children }`, donde
`totalCents` incluye lo de sus subcategorías. `categoryId: null` junta lo que no tiene categoría.

Cuenta lo mismo que `/transactions/summary`: movimientos confirmados, por fecha de pago, sin transferencias
ni papelera. Cada renglón suma a la categoría de su producto (o a la suya) y lo que los renglones no cubren, a la del movimiento; una devolución resta de la suya.

Todos los informes cuentan igual: por fecha de pago, las devoluciones restan, las transferencias no son
ingreso ni egreso. Comercio es el de la lista al que apunta el egreso; el que todavía no tiene, se agrupa por su descripción, sin distinguir mayúsculas ni acentos; los 20 más
grandes van uno por uno y el resto (y lo que no tiene descripción) en `othersCents`.

**Todo en una moneda.** Con `in=ARS` o `in=USD` cada informe muestra todo en esa moneda: cada movimiento se
convierte con la tasa del usuario vigente el día del movimiento (la última que empezó ese día o antes).
`consolidated` es entonces `{ currency, leftOut }`: los movimientos que quedaron afuera porque ninguna tasa
cubre su día. Sin `in`, `consolidated` es `null` y cada moneda va por separado.

**Proyección.** Cada mes trae `currencies` (`confirmedIncomeCents`, `confirmedExpenseCents`,
`expectedIncomeCents`, `expectedExpenseCents`, `balanceCents`) y `entries`: lo esperado, cada uno
`{ kind: installment | recurring, type, name, installment, date, cents, currency }`. Lo cargado incluye
las compras con tarjeta que se pagan en ese mes.

## Tasas de cambio

| Método | Ruta                  | Qué hace                                                   |
| ------ | --------------------- | ---------------------------------------------------------- |
| GET    | `/exchange-rates`     | Las del usuario, de la más vieja a la más nueva            |
| POST   | `/exchange-rates`     | `{ validFrom: YYYY-MM-DD, arsPerUsd }`. Vale desde ese día |
| PATCH  | `/exchange-rates/:id` | `{ validFrom, arsPerUsd }`                                 |
| DELETE | `/exchange-rates/:id` | Se borra; los informes dejan de usarla                     |

Dos tasas no pueden empezar el mismo día: `DUPLICATE`. Una tasa no cambia nada guardado.

## Movimientos fijos

| Método | Ruta                           | Qué hace                                                                                                         |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/recurrings?month=YYYY-MM`    | `{ month, items, suggestions, ignored }`. Sin `month`, el mes actual                                             |
| POST   | `/recurrings/from-transaction` | `{ transactionId, ignore? }`. Marca ese movimiento como fijo, o con `ignore: true` dice que su comercio no lo es |
| PATCH  | `/recurrings/:id`              | `{ name?, expectedAmountCents?, dayOfMonth?, accountId?, categoryId?, active? }`                                 |
| DELETE | `/recurrings/:id`              | Lo borra; sus movimientos quedan, solo pierden la marca                                                          |

Cada `item` es `{ recurring, state, seenCents, expectedDate, transactionIds }`. `state`: `seen` (llegó),
`changed` (llegó con más de un 20 % de diferencia), `late` (pasaron 5 días de su día y no llegó), `expected`
(todavía no es su día) o `paused`. Un fijo se reconoce por los movimientos marcados con él y por los de su
mismo tipo, moneda y descripción (sin distinguir mayúsculas ni acentos) que no tengan otra marca, según su
fecha de pago. Una `suggestion` es `{ transactionId, name, type, amountCents, currency, months }`: un
comercio pagado exactamente una vez por mes, por un monto parecido (20 %), al menos 3 meses seguidos que
terminan este mes o el anterior. Ninguna se aplica sola: se acepta con `from-transaction`.

El nombre de un fijo es único por tipo y moneda: "Netflix" en pesos y "Netflix" en dólares son dos. Uno
repetido, también al cambiarle la cuenta a una de otra moneda, responde `DUPLICATE`.

Marcar un movimiento sin descripción, o una transferencia, responde `VALIDATION`. Si su comercio ya es un fijo,
el movimiento se suma a ese. Un fijo marcado como "no es fijo" queda en `ignored`; borrarlo vuelve a
permitir la sugerencia.

## Por venir

Nada anotado. Lo que sigue está en `ROADMAP.md`.
