# Hoja de ruta

Cada etapa termina en algo que funciona. Si una se complica, lo anterior ya sirve.

## Estado de la base

| Qué                                                          | Estado                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` (tipos, lint, auditoría de código y pruebas) | Pasa en la PC del usuario el 17/10/2026 con la etapa 4 (201 pruebas)                                                                                                |
| Usuarios y datos por usuario contra MongoDB Atlas            | Funciona en Render desde el 13/10/2026; la migración de dueños corrió sin errores                                                                                   |
| Etapa 4 contra MongoDB Atlas                                 | **Sin probar.** Escrita el 17/10/2026 y probada en memoria y por HTTP                                                                                               |
| Pantallas de la etapa 1 en un navegador                      | Recorridas el 13/10/2026 contra la demo en memoria (`npm run demo`), tamaño celular: flujo y textos. Sin mirar el aspecto ni probar las descargas                   |
| Lectura de resúmenes en PDF                                  | Escrita el 12/10/2026 sin ningún resumen real a mano: la lectura del PDF, el tapado de datos y las instrucciones a la IA se ajustan con el primer resumen verdadero |
| Compilación de backend y frontend (`npm run build`)          | Render compiló los dos el 11/10/2026; se repite en cada push                                                                                                        |
| Etapa 1 corriendo contra MongoDB Atlas                       | Dada por cerrada por el usuario                                                                                                                                     |
| Lectura real con Gemini                                      | Usada por el usuario con tickets y capturas de MercadoPago. La clasificación de productos (instrucciones versión 5) dio bien en el primer uso real, el 11/10/2026   |
| Consumo por producto contra MongoDB y Gemini reales          | Funciona en Render con datos reales desde el 11/10/2026                                                                                                             |
| `render.yaml`                                                | Desplegado en Render el 11/10/2026: backend y sitio en línea. Atlas necesita `0.0.0.0/0` en Network Access                                                          |

Las versiones de `package.json` se escribieron sin acceso al registro de npm; la instalación funcionó.

## Dónde quedamos (17/10/2026)

Para retomar. Se borra o se reescribe al empezar la próxima sesión.

**Subido antes (commit y push del usuario):** todo hasta `b58f5a3`: usuarios con datos propios, Drive por
usuario, pago de tarjeta, informe por categoría, política de privacidad y condiciones. Funciona en Render
desde el 13/10/2026.

**Hecho el 17/10/2026, con commit y sin push:**

1. Usuarios: el administrador renombra a un usuario, le cambia el tipo (no el suyo propio) y le fija un
   límite diario de lecturas con IA (Más → Usuarios → Editar). Ahí también se ve cuántas lleva hoy cada uno.
2. Límite de lectura con IA por usuario: 30 documentos por día, o lo que diga `AI_DAILY_READINGS`. Pasado
   el límite, la subida se rechaza con un aviso.
3. Etapa 4 completa:
   - Informes nuevos: Cuentas, Meses (evolución), Comercios y Próximos (proyección).
   - Tasas de cambio (Más → Tasas de cambio) y "Mostrar: todo en pesos / todo en dólares" en los informes.
   - Movimientos fijos (Más → Movimientos fijos): sugerencias, "Es un movimiento fijo" en cada movimiento,
     estado de cada mes, aviso en el Inicio y entrada en la proyección.
4. Política de privacidad actualizada (fecha 17/10/2026): dice que se guardan fijos, tasas y la cuenta de
   lecturas del día.
5. Migración `2026-10-17-recurring-merchant`: completa dos campos nuevos de los fijos. No hay fijos guardados
   todavía, así que normalmente no cambia nada.

**Para subirlo:**

1. `npm run check` pasó el 17/10/2026 (201 pruebas).
2. Commit hecho el 17/10/2026.
3. Push. En Render no hace falta ninguna variable nueva: `AI_DAILY_READINGS` es opcional (30 si no está).
4. Después del despliegue: Más → Usuarios muestra "Lecturas con IA hoy" de cada uno; Informes tiene seis
   pestañas.

**No probado contra una base real:** las consultas nuevas (informes, fijos, tasas, el contador de lecturas)
están probadas sobre el backend en memoria y por HTTP. Contra MongoDB Atlas corren por primera vez al subir.

**Pendiente del usuario (no es código):**

- Cargar `VITE_CONTACT_EMAIL` en el sitio de Render y poner las direcciones de `/privacidad` y
  `/condiciones` en Google Cloud.
- Configurar Google una vez con `docs/RESPALDO_DRIVE.md` y probar "Copiar ahora" con un Drive de verdad.
- Que el amigo pruebe un resumen real: qué quedó sin tapar en el texto, si la suma da igual al total y si
  los intereses, impuestos y comisiones salen en "Cargos financieros".
- Decidir el margen de días para la misma compra cargada por dos vías (ver abajo).

**Lo próximo que se puede programar:**

- Ajustar el tapado y las instrucciones con el primer resumen real.
- La misma compra cargada por dos vías (ticket y resumen): detectarla y proponer unirla. Falta definir el
  margen de días (abierto en `DECISIONES.md`; se propuso 3, con mismo monto y cuenta).
- Recordar una corrección de producto o grupo para el próximo ticket; comparar precios en el tiempo.
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

- Probar la conexión de Drive con Google de verdad: hasta ahora, con un Google simulado.

Hecho (17/10/2026): el administrador renombra a un usuario y le cambia el tipo, y cada usuario tiene un
límite diario de documentos mandados a la IA (30, `AI_DAILY_READINGS`, o el que le dé el administrador).

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

Hecho (17/10/2026), probado en memoria y por HTTP, sin probar contra Atlas:

- Informes por cuenta, evolución mensual (Meses) y comercios.
- Tasas de cambio manuales (`exchange-rates`) y vista en una moneda en todos los informes salvo Consumo.
- Movimientos fijos (`recurrings`): sugerencia, marca manual, estado del mes, aviso en el Inicio.
- Proyección de este mes y los dos siguientes: lo cargado, las cuotas por venir y los fijos sin aparecer.

Falta: nada pendiente de programar. Queda usarla y ajustar los números de la regla de fijos (3 meses, 20 %,
5 días) si avisan de más o de menos.

## Segunda versión

Presupuestos por categoría, notificaciones de vencimiento, compartir hacia la app desde Android, uso
sin conexión, saldos por cuenta, conservar comprobantes de forma permanente.
