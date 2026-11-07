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
| Sacar las divisiones manuales | 52 apariciones en 9 archivos del backend y 20 en 4 de la pantalla (15 en el formulario) | Medio, más una migración |
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

**B. Corregir en la base de calidad**

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
