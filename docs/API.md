# API

Prefijo: `/api/v1`. Todas las rutas piden `Authorization: Bearer <token>`, salvo las marcadas como
públicas.

- Éxito: `{ "data": ... }`. Borrados: `204` sin cuerpo.
- Error: `{ "error": { "code", "message", "details", "requestId" } }`.
- Dinero en centavos enteros. Fechas `YYYY-MM-DD`. Meses `YYYY-MM`.

Los esquemas de entrada y los tipos de salida están en `shared/src/schemas/`.

## Códigos de error

| Código                | HTTP | Cuándo                                                      |
| --------------------- | ---- | ----------------------------------------------------------- |
| `VALIDATION`          | 400  | Datos inválidos. `details.issues` lista `{ path, message }` |
| `INVALID_BACKUP`      | 400  | El archivo no es un respaldo, o es de una versión más nueva |
| `INTEGRITY`           | 400  | El respaldo tiene referencias a datos que no incluye        |
| `UNAUTHORIZED`        | 401  | Falta el token o venció                                     |
| `INVALID_CREDENTIALS` | 401  | Usuario o contraseña incorrectos                            |
| `NOT_FOUND`           | 404  | No existe                                                   |
| `CONFLICT`            | 409  | La operación no se puede hacer en el estado actual          |
| `DUPLICATE`           | 409  | Ya existe uno con ese nombre                                |
| `IN_USE`              | 409  | No se puede borrar porque otros datos lo usan               |
| `PAYLOAD_TOO_LARGE`   | 413  | Archivo o pedido demasiado grande                           |
| `RATE_LIMITED`        | 429  | Demasiados intentos de login                                |
| `AI_PROVIDER`         | 502  | Falló el servicio de lectura (etapa 2)                      |
| `INTERNAL`            | 500  | Error inesperado                                            |

## Estado y acceso

| Método | Ruta               | Descripción                                                                                 |
| ------ | ------------------ | ------------------------------------------------------------------------------------------- |
| GET    | `/health`          | **Pública.** `{ status, database }`                                                         |
| POST   | `/auth/login`      | **Pública.** `{ username, password }` → `{ token, expiresAt }`. 10 intentos cada 15 minutos |
| GET    | `/auth/me`         | Sesión actual                                                                               |
| POST   | `/auth/logout-all` | Cierra la sesión en todos los dispositivos, incluido el que lo pide                         |

## Cuentas

| Método | Ruta            | Descripción                                      |
| ------ | --------------- | ------------------------------------------------ |
| GET    | `/accounts`     | Todas, incluidas las archivadas                  |
| POST   | `/accounts`     | `{ name, type, currency }`                       |
| GET    | `/accounts/:id` |                                                  |
| PATCH  | `/accounts/:id` | `{ name?, archived? }`. Tipo y moneda no cambian |
| DELETE | `/accounts/:id` | `IN_USE` si tiene movimientos                    |

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

| Método | Ruta                | Descripción                                                       |
| ------ | ------------------- | ----------------------------------------------------------------- |
| GET    | `/backup/export`    | Descarga el respaldo completo (JSON)                              |
| POST   | `/backup/restore`   | Cuerpo: el respaldo. Reemplaza todo o no cambia nada. Hasta 25 MB |
| GET    | `/backup/integrity` | `{ ok, checkedAt, broken[] }`                                     |

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

Tickets y capturas leídos con IA. La subida responde enseguida; la lectura ocurre en segundo plano.

| Método | Ruta                                       | Descripción                                                                                                                                                                     |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/documents?status=pending\|all`           | `pending` (por defecto): procesando, listos para revisar y con error                                                                                                            |
| POST   | `/documents`                               | `multipart/form-data`: `kind` (`receipt` o `screenshot`), `accountId` opcional y de 1 a 10 imágenes en `files` (JPG, PNG o WEBP, 5 MB cada una). Responde `202`                 |
| GET    | `/documents/:id`                           | Detalle con `extraction` (lo leído, con la categoría sugerida ya resuelta) y `duplicateHints`: por cada movimiento, `existing`, `repeated` o `null`                             |
| GET    | `/documents/:id/files/:index`              | Una de las imágenes. Deja de existir al confirmar                                                                                                                               |
| POST   | `/documents/:id/retry`                     | Vuelve a leer un documento con error o ya leído (descarta el resultado anterior)                                                                                                |
| POST   | `/documents/:id/confirm`                   | `{ transactions: [{ transaction, installment }], rules }` (los productos van en `transaction.items`). Crea los movimientos, guarda las reglas y borra las imágenes. Todo o nada |
| DELETE | `/documents/:id?transactions=keep\|delete` | Sin confirmar: lo descarta. Confirmado: sus movimientos quedan como manuales (`keep`) o van a la papelera (`delete`)                                                            |

Estados: `processing` → `ready` → `confirmed`, o `error` (con `errorCode`: `rate_limited`, `unavailable`,
`not_configured`, `blocked`, `unreadable`).

Subir un archivo ya confirmado y con movimientos vigentes responde `DUPLICATE`, con el documento existente en
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

## Por venir

Etapa 3: `/card-periods`, `/installment-plans`. Etapa 4: `/reports`, `/recurrings`, `/exchange-rates`.
