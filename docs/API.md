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
| GET    | `/users`             | **Solo administrador.** `[{ id, username, role, active, createdAt }]`                                                |
| POST   | `/users`             | **Solo administrador.** `{ username, password, role? }` (`role`: `user` por defecto, o `admin`)                      |
| PATCH  | `/users/:id`         | **Solo administrador.** `{ password?, active? }`. Las dos cierran las sesiones de ese usuario                        |

Quien no es administrador recibe `FORBIDDEN`. La contraseña nueva tiene al menos 8 caracteres. Un nombre de
usuario repetido (sin distinguir mayúsculas ni acentos) responde `DUPLICATE`; desactivarse a uno mismo,
`CONFLICT`. No hay ruta para borrar un usuario ni para ver sus datos.

## Cuentas

| Método | Ruta            | Descripción                                                           |
| ------ | --------------- | --------------------------------------------------------------------- |
| GET    | `/accounts`     | Todas, incluidas las archivadas                                       |
| POST   | `/accounts`     | `{ name, type, currency, bankId?, networkId? }`                       |
| GET    | `/accounts/:id` |                                                                       |
| PATCH  | `/accounts/:id` | `{ name?, archived?, bankId?, networkId? }`. Tipo y moneda no cambian |
| DELETE | `/accounts/:id` | `IN_USE` si tiene movimientos, cierres o planes de cuotas             |

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
  "description": "Edesur",
  "note": "",
  "tagIds": [],
  "splits": [],
  "toAccountId": null,
  "toAmountCents": null,
  "paymentDate": null,
  "original": null,
  "items": []
}
```

`refund: true` marca una devolución: solo en un egreso (si no, `VALIDATION`) y nunca en cuotas. Su monto es
positivo y resta del egreso del mes, del resumen de la tarjeta y del consumo. Si se omite es `false`.

`items` son los productos: `[{ "name", "amountCents", "product", "group", "quantity" }]`, hasta 200.
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

| Método | Ruta                                             | Descripción                                                                          |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| GET    | `/spreadsheet/export?format=xlsx\|csv&from=&to=` | Movimientos confirmados en el formato de importación                                 |
| GET    | `/spreadsheet/template`                          | Planilla vacía con los encabezados                                                   |
| POST   | `/spreadsheet/import/preview`                    | `multipart/form-data`, campo `file` (.xlsx o .csv, 5 MB, 2000 filas). No guarda nada |
| POST   | `/spreadsheet/import/review`                     | `{ rows: [{ line, row }] }`. Vuelve a revisar filas ya leídas. No guarda nada        |
| POST   | `/spreadsheet/import/commit`                     | `{ rows, createMissing }`. Todo o nada                                               |

La vista previa informa `unknownAccounts` (nombres de cuenta que no existen) y `newCategories`
(`{ kind, path }` de cada categoría que habría que crear). Para apuntar una de esas a una existente, el
cliente reescribe las filas con el nombre o la ruta elegidos y las manda a `/import/review`, que responde
con el mismo formato que la vista previa.

## Reglas de categoría

"Este comercio va siempre a esta categoría." Una regla por comercio, sin distinguir mayúsculas ni acentos.

| Método | Ruta                  | Descripción                                                        |
| ------ | --------------------- | ------------------------------------------------------------------ |
| GET    | `/category-rules`     | Todas                                                              |
| PUT    | `/category-rules`     | `{ merchant, categoryId }`. Crea la regla o cambia la del comercio |
| DELETE | `/category-rules/:id` |                                                                    |

## Documentos

Tickets, capturas y resúmenes de tarjeta leídos con IA. La subida responde enseguida; la lectura ocurre en
segundo plano.

| Método | Ruta                                       | Descripción                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/documents?status=pending\|all`           | `pending` (por defecto): procesando, listos para revisar y con error                                                                                                                                                                                                                                                                                                                                                                   |
| POST   | `/documents`                               | `multipart/form-data`: `kind` (`receipt` o `screenshot`), `accountId` opcional y de 1 a 10 imágenes en `files` (JPG, PNG o WEBP, 5 MB cada una). Responde `202`                                                                                                                                                                                                                                                                        |
| POST   | `/documents/statement/preview`             | `multipart/form-data`: el PDF de un resumen en `file` (hasta 5 MB y 20 páginas) y `password` opcional. Devuelve `{ text, pages, hidden }`: el texto con los datos personales reconocibles tapados. No guarda nada ni llama a la IA                                                                                                                                                                                                     |
| POST   | `/documents/statement`                     | `{ text, fileName, accountId? }`: el texto que el usuario aprobó (hasta 100.000 caracteres). Crea un documento `card_statement` sin imágenes. Responde `202`                                                                                                                                                                                                                                                                           |
| GET    | `/documents/:id`                           | Detalle con `extraction` (lo leído, con la categoría sugerida ya resuelta), `text` (el texto de un resumen, hasta confirmarlo) y `duplicateHints`: por cada movimiento, `existing`, `repeated` o `null`                                                                                                                                                                                                                                |
| GET    | `/documents/:id/files/:index`              | Una de las imágenes. Deja de existir al confirmar                                                                                                                                                                                                                                                                                                                                                                                      |
| POST   | `/documents/:id/retry`                     | Vuelve a leer ya un documento con error, ya leído o esperando a la IA (descarta el resultado anterior y la espera)                                                                                                                                                                                                                                                                                                                     |
| POST   | `/documents/:id/confirm`                   | `{ transactions: [{ transaction, installment, continuePlan }], rules, cardPeriods }` (`continuePlan: true` en una cuota que no es la última crea su plan y las cuotas que faltan, proyectadas) (los productos van en `transaction.items`; `cardPeriods`, solo para un resumen, son hasta 2 cierres con la forma de `POST /card-periods`). Crea los cierres, los movimientos y las reglas, y borra las imágenes o el texto. Todo o nada |
| DELETE | `/documents/:id?transactions=keep\|delete` | Sin confirmar: lo descarta. Confirmado: sus movimientos quedan como manuales (`keep`) o van a la papelera (`delete`); los cierres que se guardaron de él quedan, sin el vínculo                                                                                                                                                                                                                                                        |

Si la IA está sin cupo o no responde (`rate_limited`, `unavailable`), el documento no pasa a `error`: sigue
en `processing` con `retryAt` (cuándo se vuelve a intentar solo) y `waits` (cuántas veces esperó). Las
esperas son de 1, 5, 15, 30, 60, 120, 240 y 480 minutos (`DOCUMENT_RETRY_DELAYS_MINUTES`); después de la
última pasa a `error`. Mientras el servidor está despierto revisa cada minuto; también al pedir la lista
de pendientes.

Estados: `processing` → `ready` → `confirmed`, o `error` (con `errorCode`: `rate_limited`, `unavailable`,
`not_configured`, `blocked`, `unreadable`).

Resumen de tarjeta: el PDF se lee en memoria y se descarta. Si no se puede usar, la respuesta es `VALIDATION`
sobre `file` (no es PDF, demasiadas páginas, imagen escaneada sin texto, demasiado texto, no se pudo abrir)
o sobre `password` (falta o es incorrecta). La extracción de un resumen trae `statement` con `closingDate`,
`dueDate`, `nextClosingDate`, `nextDueDate`, `totalCents`, `minimumPaymentCents` y `currency`. Las cuotas
mayores a la primera vienen fechadas el día del cierre. Un cierre que ya existe para esa tarjeta hace fallar
la confirmación con `DUPLICATE`. En `duplicateHints`, `existing` también marca una cuota ("3 de 6") que ya
está guardada por el mismo monto, aunque sea en otra fecha.

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

| Método | Ruta                                | Qué hace                                                                      |
| ------ | ----------------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/reports/categories?month=YYYY-MM` | Ingresos y egresos del mes por categoría, por moneda: `{ month, currencies }` |

Cada moneda trae `income` y `expense`, cada uno con `totalCents` y `categories`: las categorías principales
con algo en el mes, de mayor a menor. Cada categoría es `{ categoryId, name, totalCents, children }`, donde
`totalCents` incluye lo de sus subcategorías. `categoryId: null` junta lo que no tiene categoría.

Cuenta lo mismo que `/transactions/summary`: movimientos confirmados, por fecha de pago, sin transferencias
ni papelera. Un movimiento dividido suma cada parte a su categoría y una devolución resta de la suya.

## Por venir

Etapa 4: más informes en `/reports` (por cuenta, evolución mensual, comercios), `/recurrings`,
`/exchange-rates`.
