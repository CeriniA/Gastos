# Reglas del proyecto para asistentes de IA

Este proyecto lo mantiene una persona que no programa, con ayuda de asistentes. Antes de cambiar algo,
leé `docs/ARQUITECTURA.md` y `docs/ESPECIFICACION.md`. Estas reglas no son opcionales.

## Idioma

- Código, nombres de archivos, colecciones, campos y comentarios: **inglés**.
- Todo texto que ve el usuario: **español**, y vive solo en `frontend/src/shared/i18n/es.ts`.
- Documentación en `docs/`: español.
- Usá los términos de `docs/GLOSARIO.md`. No inventes otra traducción para un concepto que ya tiene nombre.

## Fuente única de la verdad

- Constantes, esquemas Zod y tipos se definen **una vez** en `shared/` y se importan desde ahí.
  No dupliques un enum, un tipo ni una validación en backend o frontend.
- Dinero: entero en centavos. Solo `shared/src/money.ts` convierte, redondea o formatea.
- Fechas: texto `YYYY-MM-DD`. Solo `shared/src/dates.ts` hace cuentas con fechas.
- Variables de entorno: solo `backend/src/config/env.ts` lee `process.env`.
- La fecha de pago la decide únicamente `resolvePaymentDate`.
- Totales, saldos y montos convertidos se calculan; no se guardan.

## Capas del backend

`routes → controller → service → repository → model`. Las dependencias van solo hacia abajo.

- **controller**: valida la entrada con `parse(schema, ...)`, llama al service, responde con `ok(...)`.
  Sin reglas de negocio, sin base de datos.
- **service**: reglas de negocio. No importa `express` ni `mongoose` ni modelos.
- **repository**: único lugar que usa el modelo. Devuelve los tipos de `shared`, con ids como texto.
- Un módulo no importa los archivos internos de otro. Lo que necesita de otro módulo lo recibe como
  funciones en `backend/src/wiring.ts`.
- Un service no importa la base de datos: recibe `runInTransaction` igual que el resto de sus dependencias.
- `npm run lint` hace cumplir estas reglas. Si el lint se queja de un import, el diseño está mal: no
  desactives la regla.

## Integridad de datos

MongoDB no tiene claves foráneas; la integridad la garantiza el backend.

- Toda referencia se verifica en el service antes de escribir.
- Una operación que toca más de una colección corre dentro de `runInTransaction`.
- Lo que tiene historia se archiva, no se borra. Reglas de borrado: `docs/ESPECIFICACION.md`.
- Toda colección nueva registra su puerto (`createCollectionPort`) con sus referencias en
  `backend/src/composition.ts`. Así entra sola en el respaldo y en el chequeo de integridad.
  Única excepción: `authState` (ver `docs/DECISIONES.md`).
- Un cambio en la estructura de datos guardados lleva una migración en `backend/src/migrations/`.

## Regla del producto

La app propone y el usuario decide. Nada de lo que sugiere la IA o una regla automática (categoría,
duplicado, movimiento fijo, unión de movimientos) se aplica sin confirmación del usuario.

## Antes de terminar un cambio

1. `npm run check` pasa.
2. Las reglas nuevas tienen prueba. Las de servicios se prueban con `createMemoryBackend()`
   (`backend/src/testing/memory.ts`), sin base de datos; si agregás un método a un repositorio,
   agregalo también ahí.
3. Si cambió una decisión, está anotada en `docs/DECISIONES.md`.
4. Si cambió un endpoint, está en `docs/API.md`.

## Qué no hacer

- No poner la clave de la IA ni ningún secreto en el frontend ni en el repositorio.
- No guardar imágenes de comprobantes después de que el usuario confirma o descarta la revisión.
- No agregar dependencias sin necesidad: el backend corre con 512 MB de memoria.
- No agregar una función de la "segunda versión" (`docs/ROADMAP.md`) sin que el usuario la pida.
