# Hoja de ruta

Cada etapa termina en algo que funciona. Si una se complica, lo anterior ya sirve.

## Estado de la base

| Qué                                                          | Estado                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` (tipos, lint, auditoría de código y pruebas) | Pasa en la PC del usuario el 13/10/2026 con usuarios y datos por usuario (185 pruebas)                                                                              |
| Usuarios y datos por usuario contra MongoDB Atlas            | **Sin probar.** Escrito el 13/10/2026; la migración que le pone dueño a los datos corre por primera vez en el próximo despliegue. Bajar un respaldo antes           |
| Pantallas de la etapa 1 en un navegador                      | Recorridas el 13/10/2026 contra la demo en memoria (`npm run demo`), tamaño celular: flujo y textos. Sin mirar el aspecto ni probar las descargas                   |
| Lectura de resúmenes en PDF                                  | Escrita el 12/10/2026 sin ningún resumen real a mano: la lectura del PDF, el tapado de datos y las instrucciones a la IA se ajustan con el primer resumen verdadero |
| Compilación de backend y frontend (`npm run build`)          | Render compiló los dos el 11/10/2026; se repite en cada push                                                                                                        |
| Etapa 1 corriendo contra MongoDB Atlas                       | Dada por cerrada por el usuario                                                                                                                                     |
| Lectura real con Gemini                                      | Usada por el usuario con tickets y capturas de MercadoPago. La clasificación de productos (instrucciones versión 5) dio bien en el primer uso real, el 11/10/2026   |
| Consumo por producto contra MongoDB y Gemini reales          | Funciona en Render con datos reales desde el 11/10/2026                                                                                                             |
| `render.yaml`                                                | Desplegado en Render el 11/10/2026: backend y sitio en línea. Atlas necesita `0.0.0.0/0` en Network Access                                                          |

Las versiones de `package.json` se escribieron sin acceso al registro de npm; la instalación funcionó.

## Dónde quedamos (13/10/2026)

Para retomar. Se borra o se reescribe al empezar la próxima sesión.

**Ya subido (commit y push hechos por el usuario):** resúmenes en PDF, devoluciones, cuotas desde el
resumen, cuotas según el cierre y la copia automática en Drive (`c4c16f7`); y lo del 13/10/2026 (`270603c`):

1. Intereses, impuestos y comisiones leídos de un documento se proponen en "Cargos financieros"
   (instrucciones versión 8). Sin migración: no cambia nada de lo guardado.
2. La pantalla Agregar muestra sus errores con `useAction`, como el resto.

También subido (`020c281`, repaso de la etapa 1): la demo en memoria (`npm run demo`), las pruebas por HTTP
(`backend/src/app.test.ts`), el arreglo de los movimientos divididos que no se reconocían como repetidos al
importar, la confirmación al borrar una cuenta y `useAction` en Login, Más y el formulario de movimientos.

Y el repaso de las etapas 2 y 3 (`4806090`): la demo simula la IA y el lector de PDF, y los dos arreglos de
la pantalla de revisión (a dónde va al confirmar, y la tarjeta elegida con "Cuenta para todos").

**Hecho después, en la carpeta del usuario, sin commit: usuarios (ver la sección "Usuarios" más abajo).**

1. Usuarios en MongoDB con contraseña en hash y sesión por JWT. El administrador crea usuarios, les cambia
   la contraseña y los activa o desactiva (Más → Usuarios). Cada uno cambia la suya (Más → Cambiar mi
   contraseña).
2. Cada dato tiene dueño y nadie ve los de otro. El dueño lo pone y lo filtra un solo lugar
   (`core/db/ownerPlugin.ts`); sin usuario, tocar datos da error.
3. Respaldo, restauración, exportación, cola de documentos y limpiezas son de cada usuario.
4. Cada usuario conecta su propio Google Drive desde la app. En Render quedan `DRIVE_CLIENT_ID`,
   `DRIVE_CLIENT_SECRET` y `PUBLIC_API_URL`; `DRIVE_REFRESH_TOKEN` ya no se usa.
5. Se fueron `npm run seed` y `npm run drive-auth`: los datos iniciales se dan solos a cada usuario nuevo.

**Y tres mejoras más, también sin commit:**

1. Al unir categorías, las partes de un movimiento dividido que quedan en la misma categoría se juntan (era
   el problema que había quedado anotado sin corregir).
2. Pagar la tarjeta: "Registrar un pago" en cada resumen de Más → Tarjetas. Es una transferencia ligada al
   resumen, que muestra lo pagado y lo que falta.
3. Informe por categoría, con ingresos y egresos y el árbol de categorías. Informes ahora tiene dos
   pestañas: "Por categoría" y "Consumo".

**Subido y funcionando en Render (`bca99dc`):** usuarios, Drive por usuario, pago de tarjeta e informe por
categoría. El usuario confirmó el 13/10/2026 que funciona; la migración de dueños corrió sin errores.

**Hecho después, sin commit:** política de privacidad (`/privacidad`) y condiciones de uso
(`/condiciones`), públicas, enlazadas desde el login y desde Más. Falta cargar `VITE_CONTACT_EMAIL` en el
sitio de Render y poner las dos direcciones en Google Cloud. Commit sugerido:
`feat: public privacy policy and terms of use`.

**Lo que sigue era el plan de la subida anterior; queda como registro.**

**Primer paso al retomar. Leer entero antes de subir: este cambio toca todos los datos guardados.**

1. `npm run check`: pasó el 13/10/2026 (185 pruebas).
2. **Bajar un respaldo desde la app en producción (Más → Respaldo y datos), antes del push.** La versión
   nueva lo sabe restaurar aunque no tenga dueños.
3. Commit: `feat: users with their own data, per-user Drive, card payments, report by category`
4. Push. Al arrancar, Render:
   - crea el primer usuario, administrador, con `AUTH_USERNAME` y `AUTH_PASSWORD_HASH`;
   - corre la migración `2026-10-13-data-owners`: todo lo guardado pasa a ser de ese usuario y los índices
     únicos se rehacen por usuario.
5. Entrar de nuevo (las sesiones viejas dejan de valer) y revisar que estén las cuentas y los movimientos.
   Si algo falta o el servidor no arranca, mirar los registros de Render; con el respaldo del paso 2 se
   recupera todo.
6. Crear un segundo usuario y comprobar que no ve nada.

**No probado contra una base real:** la migración, los índices por usuario y el filtro por dueño están
probados sobre Mongoose sin base y sobre el backend en memoria (incluido por HTTP, con dos usuarios). Contra
MongoDB Atlas corren por primera vez en el paso 4. Lo más prudente es probarlo antes en la base `gastos-dev`
(`npm run dev:backend` con `MONGODB_URI` apuntando ahí, después de restaurarle el respaldo).

**Pendiente del usuario (no es código):**

- Bajar un respaldo desde la app (Más → Datos) antes de subir lo de usuarios.
- Configurar Google una vez con `docs/RESPALDO_DRIVE.md` (credencial de tipo "Aplicación web", tres
  variables en Render) y después conectar el Drive desde la app y probar "Copiar ahora". Si ya se había
  creado la credencial de tipo "App de escritorio", hay que crear una nueva.
- Crear los usuarios que hagan falta en Más → Usuarios y pasarles su contraseña.
- Que el amigo pruebe un resumen real: qué quedó sin tapar en el texto, si la suma da igual al total y si
  los intereses, impuestos y comisiones salen en "Cargos financieros".

**Lo próximo que se puede programar:**

- Ajustar el tapado y las instrucciones con el primer resumen real.
- La misma compra cargada por dos vías (ticket y resumen): detectarla y proponer unirla. Antes hay que
  definir el margen de días (está abierto en `DECISIONES.md`; se propuso 3, con mismo monto y cuenta).
- Etapa 4: los informes que faltan (por cuenta, evolución mensual, comercios) y movimientos fijos.
- Uso sin conexión: está en la segunda versión; el usuario decidió no adelantarlo por ahora.

**Cómo se trabaja (recordatorio para el asistente):**

- Leer `AGENTS.md`, `docs/ARQUITECTURA.md` y `docs/ESPECIFICACION.md` antes de programar.
- Escribir los archivos directo en la carpeta del usuario; no mandar zips.
- Antes de usar una librería nueva, leer sus tipos instalados en la PC del usuario, no escribirla de memoria.
- Antes de entregar: formato, `npm run audit:code`, pruebas y tipos, y decir qué se corrió.
- Un problema que se encuentra se arregla en el momento, no se anota como deuda sin avisar.
- No leer `backend/.env`.

## Usuarios (13/10/2026)

Hecho:

- Colección `users`, login contra la base, JWT con el id del usuario y la versión de sus sesiones.
- Administrador: crea usuarios, les cambia la contraseña, los activa o desactiva. No ve datos de nadie.
- Cada usuario cambia su contraseña y cierra sus sesiones en todos los dispositivos.
- Dueño en cada dato (`ownedByUser`), índices únicos por usuario y migración de lo que ya había.
- Respaldo, restauración (también de un respaldo viejo), exportación, cola de documentos, limpiezas y
  copia a Drive por usuario.
- Conexión del Drive de cada uno desde la app, con el permiso guardado cifrado.
- Pantallas: Más → Usuarios, Más → Cambiar mi contraseña, y la sección de Drive en Respaldo y datos.
  Recorridas en un navegador con la demo: crear un usuario, entrar como él y no ver nada del otro, cambiar
  la contraseña, conectar y desconectar Drive, desactivar un usuario.

Falta:

- Probarlo contra MongoDB Atlas (ver "Dónde quedamos").
- Probar la conexión de Drive con Google de verdad: hasta ahora, con un Google simulado.
- Que el administrador pueda renombrar un usuario o cambiarle el tipo (hoy se crea otro).
- Un límite de uso de la IA por usuario: hoy todos comparten el mismo cupo de Gemini.

## Etapa 1: base usable (este repositorio)

Hecho:

- Estructura, capas, esquemas compartidos, errores, configuración, migraciones.
- Login de un usuario.
- Cuentas, categorías en árbol (crear, renombrar, mover, archivar, unir, borrar) y etiquetas.
- Movimientos manuales: alta, edición, transferencias y división entre categorías.
- Lista de movimientos con buscador, filtros (tipo, cuenta, categoría, etiqueta, todos los meses) y
  "Cargar más".
- Papelera: ver, restaurar, borrar del todo y vaciar.
- Pantalla de etiquetas: crear, renombrar y borrar.
- Balance mensual por moneda según fecha de pago.
- Respaldo completo, restauración y chequeo de integridad.
- Exportación a Excel y CSV; importación con vista previa, eligiendo a qué cuenta o categoría existente
  corresponde una que el archivo nombra y la app no tiene.
- App instalable; aviso de servidor despertando.
- Datos iniciales (categorías y cuentas de arranque).

Las pantallas que cerraron la etapa (papelera, categorías, etiquetas, división, filtros, importación) se
escribieron el 11/10/2026. Sus reglas de backend tienen pruebas y los tipos de las pantallas pasan
`npm run check`. No se probaron en un navegador antes de entregarlas; se recorrieron el 13/10/2026 con la
demo en memoria (login, inicio, movimientos con buscador y filtros, alta, edición, división, transferencia
entre monedas, papelera, cuentas, categorías, etiquetas, chequeo de integridad e importación de un CSV).
Quedó sin mirar el aspecto (colores, tamaños, cómo entra en la pantalla) y las descargas de archivos.

Falta: nada pendiente de programar. Queda usarla y corregir lo que aparezca.

## Etapa 2: lectura con IA

Hecho (backend):

- Proveedor Gemini detrás de `AiExtractor`, por HTTPS y sin dependencias nuevas: instrucciones
  versionadas, limpieza y validación de la respuesta, reintentos ante límite o saturación.
- Módulo `documents`: subida de 1 a 10 imágenes, tipo real del archivo, huella contra duplicados,
  lectura en segundo plano de a uno, reanudación al arrancar, reintento manual, confirmación todo o
  nada con borrado de las imágenes, y borrado con elección sobre sus movimientos.
- Reglas comercio → categoría (`category-rules`), que ganan sobre la sugerencia de la IA y siguen a la
  categoría si se une o se borra.
- Script `npm run try-extraction -w backend` para probar la lectura con documentos reales.

Hecho (pantallas): Agregar (cámara o galería, con compresión en el navegador y varias fotos para un
mismo ticket), Pendientes (se actualiza sola mientras la IA lee) y Revisión (imagen arriba, datos
editables abajo, campos dudosos marcados, opción de recordar la categoría del comercio).

Hecho después, a partir del uso real:

- Tickets en otra moneda (reales): el movimiento se guarda en la moneda de la cuenta y conserva el
  monto original y el cambio. La revisión propone un cambio (el del día, uno público de referencia o el
  último usado) y permite "No convertir".
- Aviso de movimientos que parecen repetidos, contra los ya cargados y dentro del mismo documento.
- Volver a subir un archivo: se lee de nuevo salvo que sus movimientos sigan cargados. "Volver a leer"
  en Pendientes.

- Editar el cambio de un movimiento ya guardado; el cambio y el monto se recalculan uno al otro.
- Los documentos sin revisar vencen a los 30 días.
- Cerrar sesión en todos los dispositivos.
- Cuando la IA está sin cupo o no responde, el documento espera y se reintenta solo.

Comprobado con pruebas sobre el backend en memoria y una IA simulada. Las pantallas no tienen pruebas.

Falta:

- Seguir ajustando las instrucciones (`backend/src/providers/ai/prompt.ts`) con documentos reales: las
  capturas de MercadoPago con listas superpuestas son el caso más difícil.
- Elegir el modelo: hoy el valor por defecto es `gemini-3.5-flash-lite`; se cambia con `GEMINI_MODEL`.
- Lista de reglas y de documentos confirmados en Más (la API ya existe).
- Medir memoria y tiempo en Render gratuito.

### Consumo por producto (hecho)

Los productos se cargan, editan y borran a mano en cualquier movimiento, y se corrigen en la revisión de
un ticket. La IA devuelve por producto un nombre genérico ("Yerba"), un grupo de una lista fija y la cantidad
(instrucciones versión 5). La pestaña Informes muestra el consumo del mes por grupo y producto, y un
buscador de compras por producto. Los tickets confirmados antes de la versión 5 aparecen en "Sin clasificar"; se les puede
poner grupo editando el movimiento.

Falta:

- Recordar una corrección de producto o grupo para el próximo ticket (hoy se corrige a mano cada vez).
- Comparar el precio de un mismo producto a lo largo del tiempo.

## Deuda conocida

Revisión del 11/10/2026. No bloquea el uso; conviene no perderla de vista.

Desde el 12/10/2026 `npm run check` incluye una auditoría (`scripts/audit.mjs`) que rechaza código
copiado, exports sin uso y números sueltos, y el lint rechaza textos escritos en las pantallas. Lo que
sigue en esta lista es lo que esos controles no cubren.

- **Las pantallas no tienen pruebas automáticas.** Las reglas del backend y sus rutas HTTP sí. Las pantallas
  de las etapas 1 a 3 se recorrieron a mano el 13/10/2026 con `npm run demo`: flujo y textos, no el aspecto.
  Sin recorrer: un ticket en otra moneda (el cambio), el alta de cuotas a mano, Bancos y tarjetas, y las
  descargas. Un error visual lo encuentra el usuario.
- **Las consultas a MongoDB no tienen pruebas.** Las pruebas corren sobre repositorios en memoria; lo que
  hace cada repositorio real contra la base solo se comprueba usando la app. Con varios usuarios pesa más:
  el filtro por dueño está probado sobre Mongoose sin base, no contra una base de verdad. Se resolvería con
  una base de pruebas (por ejemplo `mongodb-memory-server`, una dependencia solo de desarrollo).
- **Vulnerabilidades de las librerías** (`npm audit` del 11/10/2026: 1 baja, 2 moderadas, ninguna alta).
  - `esbuild` (dentro de `tsup`): afectaba a su servidor de desarrollo en Windows, que este proyecto
    no usa. Corregido con `npm audit fix` el 11/10/2026.
  - `uuid` (dentro de `exceljs`): sin corrección compatible. **No correr `npm audit fix --force`**:
    baja `exceljs` a una versión vieja y puede romper la importación y exportación. Volver a mirar
    cuando `exceljs` publique una versión que lo resuelva.
- **Copia automática en Drive sin probar con Google real.** Programada y probada con un Google simulado; se
  confirma al activarla.
- **La sesión se guarda en el navegador** (`localStorage`). Es lo habitual en una app de este tipo; el
  riesgo se acota con el vencimiento a 30 días y con "cerrar sesión en todos los dispositivos".
- **Sin aviso de errores.** Si el servidor falla, solo queda en los registros de Render.

## Etapa 3: tarjetas, cuotas y duplicados

Hecho (12/10/2026, carga a mano):

- Bancos y marcas de tarjeta (`institutions`): lista editable sembrada con los comunes; cada cuenta
  indica su banco y cada tarjeta su marca.
- Cierres y vencimientos (`card-periods`): la fecha de pago de cada compra con tarjeta sale del cierre y
  se recalcula al corregirlo. Pantalla Tarjetas con lo cargado por resumen y la diferencia contra su total.
- Compras en cuotas (`installment-plans`): un movimiento por mes; las futuras proyectadas y confirmadas
  solas al llegar su fecha.

Comprobado con pruebas sobre el backend en memoria. Sin probar todavía con datos reales.

Hecho (12/10/2026, sin probar con un resumen real):

- Resúmenes en PDF: el servidor saca el texto (`unpdf`), tapa los datos personales reconocibles y lo
  muestra; el usuario tapa lo que quede (con palabras que el teléfono recuerda) y recién entonces se manda
  el texto a la IA. El PDF no se guarda nunca y la contraseña tampoco.
- La IA devuelve los movimientos y el cierre, vencimiento, próximo cierre, total y pago mínimo. En la
  revisión se eligen las tarjetas (pesos y dólares de la misma tarjeta vienen marcadas) y se guardan los
  cierres junto con las compras; se ve la suma de lo marcado contra el total.
- Las cuotas que cobra el resumen se fechan el día del cierre.

Hecho (12/10/2026):

- Devoluciones: un egreso marcado que resta del mes, del resumen de la tarjeta y del consumo. Se marcan
  al cargar o editar, en la revisión de lo leído (la IA las propone) y en la planilla (tipo `devolución`).
- "Cuota 3 de 6" de una compra no cargada: en la revisión se ofrece crear el plan con las cuotas que faltan,
  proyectadas. Una cuota que ya está cargada se marca como repetida y no se vuelve a crear.
- Corregido: una compra en cuotas hecha justo antes del cierre ya no saltea un resumen. Con los cierres de la
  tarjeta cargados, las cuotas siguientes se fechan a mitad de cada período.

Hecho (13/10/2026, sin probar con un resumen real):

- Intereses, impuestos y comisiones se proponen en la categoría "Cargos financieros" (instrucciones
  versión 8): la IA marca el renglón y el backend pone la categoría. La regla del usuario para ese comercio
  gana.

Falta:

- Probarlo con un resumen real y ajustar el tapado y las instrucciones.
- PDF escaneado (sin texto): hoy se rechaza con aviso.
- Detección de la misma compra cargada por dos vías (ticket y resumen) y propuesta de unión.

Hecho (13/10/2026): pagar la tarjeta como transferencia desde otra cuenta, ligada a su resumen, con lo
pagado y lo que falta a la vista.

## Etapa 4: informes, fijos y monedas

Hecho (13/10/2026): informe por categoría, de ingresos y egresos, con el árbol de categorías.

- Informes por cuenta, evolución mensual, comercios.
- Tasas de cambio manuales (`exchange-rates`) y vista consolidada.
- Movimientos fijos (`recurrings`): sugerencia, marca manual, proyección y avisos.
- Proyección de cuotas y fijos.

## Segunda versión

Presupuestos por categoría, notificaciones de vencimiento, compartir hacia la app desde Android, uso
sin conexión, saldos por cuenta, conservar comprobantes de forma permanente.
