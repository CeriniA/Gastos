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

| Método | Ruta          | Descripción                                                                                 |
| ------ | ------------- | ------------------------------------------------------------------------------------------- |
| GET    | `/health`     | **Pública.** `{ status, database }`                                                         |
| POST   | `/auth/login` | **Pública.** `{ username, password }` → `{ token, expiresAt }`. 10 intentos cada 15 minutos |
| GET    | `/auth/me`    | Sesión actual                                                                               |

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

| Método | Ruta                                  | Descripción                                                 |
| ------ | ------------------------------------- | ----------------------------------------------------------- |
| GET    | `/transactions`                       | Paginado. Filtros abajo                                     |
| POST   | `/transactions`                       | Carga manual                                                |
| GET    | `/transactions/summary?month=YYYY-MM` | Ingresos, egresos y balance por moneda, según fecha de pago |
| GET    | `/transactions/:id`                   |                                                             |
| PATCH  | `/transactions/:id`                   | Parcial. El resultado se valida completo                    |
| DELETE | `/transactions/:id`                   | A la papelera                                               |
| POST   | `/transactions/:id/restore`           | Saca de la papelera                                         |

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
  "paymentDate": null
}
```

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
| POST   | `/spreadsheet/import/commit`                     | `{ rows, createMissing }`. Todo o nada                                               |

## Por venir

Etapa 2: `/documents`, `/pending`, `/category-rules`. Etapa 3: `/card-periods`, `/installment-plans`.
Etapa 4: `/reports`, `/recurrings`, `/exchange-rates`.
