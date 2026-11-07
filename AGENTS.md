# Reglas del proyecto para asistentes de IA

Este proyecto lo mantiene una persona que no programa, con ayuda de asistentes. Antes de cambiar algo,
leé `docs/ARQUITECTURA.md`, `docs/ESPECIFICACION.md` y `docs/ESTANDARES_CODIGO.md`. Si el cambio toca comercios,
productos, categorías, tarjetas o la forma de cargar, leé también `docs/LOGICA_NEGOCIO.md`: tiene lo acordado
que todavía no está implementado. Estas reglas no son opcionales.

## Idioma

- Código, nombres de archivos, colecciones, campos y comentarios: **inglés**.
- Todo texto que ve el usuario: **español**, y vive solo en `frontend/src/shared/i18n/es.ts`. La política
  de privacidad y las condiciones de uso, que son largas, viven al lado, en `legal.ts`.
- `legal.ts` dice lo que la app hace con los datos y tiene que ser cierto: si un cambio toca qué se guarda,
  a quién se envía o cuándo se borra, se actualiza ese texto y su fecha en el mismo cambio.
- Documentación en `docs/`: español.
- Usá los términos de `docs/GLOSARIO.md`. No inventes otra traducción para un concepto que ya tiene nombre.

## Fuente única de la verdad

- Constantes, esquemas Zod y tipos se definen **una vez** en `shared/` y se importan desde ahí.
  No dupliques un enum, un tipo ni una validación en backend o frontend.
- Dinero: entero en centavos. Solo `shared/src/money.ts` convierte, redondea o formatea (también las
  cantidades: `formatQuantity`).
- Idioma de los números y la moneda por defecto: `APP_LOCALE` y `DEFAULT_CURRENCY` en
  `shared/src/constants.ts`. No escribas `'es-AR'` ni `'ARS'` en otro lado.
- Fechas: texto `YYYY-MM-DD`. Solo `shared/src/dates.ts` hace cuentas con fechas.
- Variables de entorno: solo `backend/src/config/env.ts` lee `process.env`.
- La fecha de pago la decide únicamente `resolvePaymentDate`.
- Totales, saldos y montos convertidos se calculan; no se guardan.

## Usuarios y dueños de los datos

Cada dato es de un usuario y nadie ve los de otro, tampoco el administrador. El dueño no se pasa como
argumento: lo pone y lo filtra un solo lugar. Leé "Usuarios y dueños" en `docs/ARQUITECTURA.md` antes de
tocar un modelo, un controller o una tarea en segundo plano.

- Toda colección con datos de un usuario lleva `schema.plugin(ownedByUser)` (`core/db/ownerPlugin.ts`). Lo
  que no puede repetirse es único **por usuario**: `uniquePerUser(schema, …)`, no `unique: true`.
- Los repositorios y services se escriben como si hubiera un solo usuario. No reciben ni filtran por
  `userId` a mano.
- Todo controller de datos devuelve sus handlers por `asUser({ … })` (`core/http/http.ts`).
- Lo que corre sin un pedido detrás (limpiezas, copia a Drive, cola de documentos) va dentro de
  `container.forEachUser` o `runAsUser`. Sin usuario, tocar datos da error: es a propósito.
- Si esquivás Mongoose y usás el driver (`model.collection…`), filtrá con `ownedOnly()` y marcá con
  `stampOwner()`.
- `runAsSystem` es solo para migraciones marcadas `system`. No lo uses para "que ande".
- `users` no es dato de nadie: no lleva el plugin ni puerto de respaldo. Contraseñas y permisos no salen
  en ninguna respuesta ni en ningún respaldo.

## Calidad del código

El detalle y los límites están en `docs/ESTANDARES_CODIGO.md`. Lo esencial:

- Un archivo hace una cosa. Al tocar un archivo grande, partilo; no lo hagas crecer.
- Un valor con significado de negocio va en `shared/`. Uno técnico de un solo archivo es una constante con
  nombre y motivo, arriba de ese archivo. Ni números, ni direcciones, ni textos sueltos en el medio.
- Sin archivos barril: un `index.ts` que solo reexporta no se escribe. Se importa del archivo que define lo
  que se necesita.
- Lo que varía o se reemplaza en las pruebas (datos, red, reloj, archivos) se recibe como dependencia. Una
  función pura o una constante no se inyecta.
- Una categoría, un comercio o un producto no se busca por su nombre: se usa su id o su rol.

## Capas del backend

`routes → controller → service → repository → model`. Las dependencias van solo hacia abajo.

- **controller**: valida la entrada con `parse(schema, ...)`, llama al service, responde con `ok(...)`.
  Sin reglas de negocio, sin base de datos. Devuelve sus handlers por `asUser`.
- **service**: reglas de negocio. No importa `express` ni `mongoose` ni modelos.
- **repository**: único lugar que usa el modelo. Devuelve los tipos de `shared`, con ids como texto.
- Un módulo no importa los archivos internos de otro. Lo que necesita de otro módulo lo recibe como
  funciones en `backend/src/wiring.ts`.
- Un service no importa la base de datos: recibe `runInTransaction` igual que el resto de sus dependencias.
- `npm run lint` hace cumplir estas reglas. Si el lint se queja de un import, el diseño está mal: no
  desactives la regla.

## Frontend

- Una pantalla que guarda algo usa `useAction()` (`frontend/src/shared/ui/useAction.ts`) para correr la
  acción y mostrar el error; no escribas otro `try/catch` con su propio estado de error.
- Las reglas de un formulario se validan con el esquema de `shared`, no con un `if` repetido en la pantalla.
- Una lista de opciones que el usuario ve (cuotas, grupos, tipos) sale de una constante de `shared`.
- `npm run lint` rechaza textos escritos en las pantallas y los valores `'es-AR'` o `'ARS'` sueltos en el
  frontend.

## Integridad de datos

MongoDB no tiene claves foráneas; la integridad la garantiza el backend.

- Toda referencia se verifica en el service antes de escribir.
- Una operación que toca más de una colección corre dentro de `runInTransaction`.
- Lo que tiene historia se archiva, no se borra. Reglas de borrado: `docs/ESPECIFICACION.md`.
- Toda colección nueva registra su puerto (`createCollectionPort`) con sus referencias en
  `backend/src/composition.ts`. Así entra sola en el respaldo y en el chequeo de integridad.
  Única excepción: `users` (ver `docs/DECISIONES.md`).
- Un cambio en la estructura de datos guardados lleva una migración en `backend/src/migrations/`. Se
  escribe como un repositorio, para un solo usuario: corre una vez por cada uno, y también sobre un
  respaldo viejo cuando alguien lo restaura.

## Regla del producto

La app propone y el usuario decide. Nada de lo que sugiere la IA o una regla automática (categoría,
duplicado, movimiento fijo, unión de movimientos) se aplica sin confirmación del usuario.

## Antes de terminar un cambio

1. `npm run check` pasa. Incluye `npm run audit:code` (`scripts/audit.mjs`), que rechaza código copiado
   (8 líneas iguales en dos lugares), exports que nadie usa y números sueltos: un número con significado va
   en una constante con nombre y un comentario que diga por qué vale eso.
2. Las reglas nuevas tienen prueba. Para esperar un error usá `codeOf` de
   `backend/src/testing/assertions.ts`. Las de servicios se prueban con `createMemoryBackend()`
   (`backend/src/testing/memory.ts`), sin base de datos; si agregás un método a un repositorio,
   agregalo también ahí. Una ruta nueva se suma a la prueba de `backend/src/app.test.ts` que comprueba
   que un usuario no ve lo de otro.
3. Si cambió una decisión, está anotada en `docs/DECISIONES.md`.
4. Si cambió un endpoint, está en `docs/API.md`.

## Qué no hacer

- No poner la clave de la IA ni ningún secreto en el frontend ni en el repositorio.
- No devolver ni registrar en los logs un hash de contraseña ni el permiso de Drive de un usuario.
- No agregar una pantalla ni una ruta donde un usuario (aunque sea administrador) vea datos de otro.
- No guardar imágenes de comprobantes después de que el usuario confirma o descarta la revisión.
- No mandar a la IA un resumen de tarjeta sin pasar por el tapado de datos (`shared/src/redaction.ts`) y la
  aprobación del usuario. El PDF y su contraseña no se guardan.
- No agregar dependencias sin necesidad: el backend corre con 512 MB de memoria.
- No agregar una función de la "segunda versión" (`docs/ROADMAP.md`) sin que el usuario la pida.
