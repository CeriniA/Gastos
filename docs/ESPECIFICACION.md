# Especificación

Qué hace la app y bajo qué reglas. Es la referencia del proyecto: si el código y este documento no
coinciden, uno de los dos está mal y hay que resolverlo.

Cada sección indica en qué etapa se construye (`ROADMAP.md`). Lo marcado **etapa 1** ya está en esta base.

## 1. Propósito y alcance

App web personal para registrar ingresos, egresos y transferencias, y ver el resultado de cada mes. Se usa
sobre todo desde el celular (Android), instalada como app.

Una misma instalación la usan varias personas, cada una con su usuario. **Cada usuario tiene sus propios
datos y no ve los de nadie más** (sección 17). Todo lo que sigue en este documento ("las cuentas", "los
movimientos", "el respaldo") se refiere a los del usuario que está usando la app.

Formas de cargar un movimiento:

| Vía                                   | Etapa |
| ------------------------------------- | ----- |
| Carga manual                          | 1     |
| Importación de planilla (Excel o CSV) | 1     |
| Foto de ticket                        | 2     |
| Captura de MercadoLibre o MercadoPago | 2     |
| Resumen de tarjeta en PDF             | 3     |

**Regla general: la app propone y el usuario decide.** Ninguna sugerencia (categoría, duplicado,
movimiento fijo, unión de dos movimientos) se aplica sin confirmación.

## 2. Movimientos

Un movimiento es un **ingreso**, un **egreso** o una **transferencia**.

- El monto es siempre positivo; el tipo dice hacia dónde va la plata.
- La moneda del movimiento es la de su cuenta.
- Una transferencia va de una cuenta a otra distinta y no lleva categoría. Pagar la tarjeta, cargar
  saldo en MercadoPago o comprar dólares son transferencias: no son ingreso ni egreso, y contarlas como
  egreso duplicaría los consumos.
- Una transferencia entre monedas distintas guarda los dos montos (el que sale y el que llega).
- Un movimiento puede **dividirse** entre varias categorías (un ticket con comida y limpieza). Las
  partes tienen que sumar el total.
- No se aceptan fechas futuras, salvo en movimientos proyectados (cuotas futuras, etapa 3).

Estados: `confirmado` (cuenta en los informes) y `proyectado` (cuota o fijo futuro). Lo que lee la IA no
es un movimiento hasta que se confirma: mientras tanto vive en su documento. El estado `borrador` existe
en el código pero no se usa.

Origen: `manual`, `documento`, `importación`, `cuota`. Un movimiento que vino de un documento o de una
importación y se corrige a mano queda marcado como editado.

### Dos fechas

- **Fecha**: el día del consumo o del ingreso.
- **Fecha de pago**: el día en que la plata sale o entra de verdad.

El balance mensual usa la **fecha de pago**. Para efectivo, banco y billetera es la misma fecha. Para
tarjeta de crédito es el vencimiento del resumen donde cae la compra o la cuota; mientras no exista el
módulo de tarjetas (etapa 3) se puede escribir a mano, y si queda vacía vale la fecha del consumo.

## 3. Monedas

Pesos (ARS) y dólares (USD). Cada movimiento se guarda en su moneda y nunca se convierte al guardar.

- Los totales se muestran separados por moneda.
- **Comprobantes en otra moneda** (por ejemplo reales, comprando en Brasil con una cuenta en pesos): el
  movimiento se guarda en la moneda de la cuenta. En la revisión se indica el cambio del día y la app
  calcula el monto; se puede corregir el total a mano. El monto original, su moneda y el cambio quedan
  anotados en el movimiento. La app propone un cambio (el que ya se usó ese día, una cotización pública de
  referencia o el último usado) y el usuario lo confirma o lo corrige. Los productos del
  ticket se convierten con el mismo cambio.
- El cambio se puede corregir después, al editar el movimiento: cambiar el cambio recalcula el monto, y
  cambiar el monto recalcula el cambio. Los dos datos nunca quedan en desacuerdo.
- Vista consolidada (etapa 4): todo en pesos o todo en dólares, usando una **tasa de cambio cargada a
  mano** con fecha de inicio. Cada movimiento se convierte con la tasa vigente en su fecha; cambiar la
  tasa hoy no altera los meses anteriores. Si un período no tiene tasa, la vista avisa y no inventa.

## 4. Cuentas

Efectivo, cuenta bancaria, billetera virtual o tarjeta de crédito, cada una con su moneda. El tipo y la
moneda no se cambian después de crearla. Una cuenta con movimientos no se borra: se archiva.

Cada cuenta puede indicar su **banco o emisor**, y una tarjeta de crédito su **marca** (Visa, Mastercard…),
elegidos de una lista que arranca con los más comunes de Argentina y que el usuario amplía, renombra o
archiva en Más → Bancos y tarjetas. Uno en uso no se borra: se archiva.

Una tarjeta con saldo en pesos y en dólares son **dos cuentas** (por ejemplo "Visa" y "Visa USD") con el
mismo banco y marca. Comparten cierres: al cargar uno, la app ofrece aplicarlo a las dos.

## 5. Categorías y etiquetas

**Categorías**: árbol de hasta **tres niveles**, con listas separadas para ingresos y egresos. Se arman
sobre la marcha.

- Un movimiento se puede asignar a cualquier nivel.
- Los totales suben: lo cargado en "Luz" suma en "Servicios" y en "Vivienda".
- Dos categorías hermanas no pueden llamarse igual.
- Mover una categoría mueve su rama; no puede quedar dentro de sí misma ni pasar de tres niveles.
- Renombrar, mover o unir no obliga a recargar nada: los movimientos siguen a la categoría.
- Al unir dos categorías, un movimiento dividido que tenía una parte en cada una queda con una sola parte
  por la suma; si no le queda otra parte, deja de estar dividido.
- Una categoría archivada deja de ofrecerse, pero los movimientos viejos la conservan.

**Etiquetas**: marcas libres que cruzan categorías ("Vacaciones enero"). Un movimiento puede tener
varias o ninguna.

**Asignación de categoría** (etapa 2), por prioridad: regla del usuario para ese comercio; si la IA marca
el renglón como interés, impuesto o comisión, la categoría de egresos "Cargos financieros"; sugerencia
de la IA, que solo puede elegir entre las categorías existentes; sin categoría. Al corregir una, la app
pregunta si ese comercio va siempre ahí y, si se acepta, crea la regla.

"Cargos financieros" se busca por su nombre. Si el usuario la renombró o la archivó, no se crea ni se
fuerza nada: queda la sugerencia de la IA.

## 6. Documentos y lectura con IA (etapa 2)

1. El usuario saca la foto o elige el archivo. El backend lo guarda como `procesando` y responde al
   instante.
2. Se procesa en segundo plano. Al terminar pasa a `listo` o a `error`.
3. Aparece en **Pendientes**. La revisión muestra la imagen y, debajo, los datos extraídos con los
   campos dudosos marcados.
4. El usuario corrige, confirma o descarta.

- La huella (SHA-256) del archivo impide **contarlo** dos veces: solo se rechaza si ya fue confirmado y tiene
  movimientos vigentes. Subir de nuevo un archivo que estaba esperando revisión, o que falló, lo vuelve a
  leer desde cero.
- Un documento listo para revisar o con error se puede volver a leer sin subirlo otra vez.
- La **imagen se guarda solo mientras el documento está pendiente** y se borra al confirmar o
  descartar. La app avisa que hay que conservar la foto aparte si se necesita.
- Un documento que nadie revisó en 30 días se borra solo, con su imagen. Los confirmados no se tocan.
- Si la IA llega a su límite gratuito o no responde, el documento queda **esperando a la IA** y se vuelve
  a intentar solo, con esperas cada vez más largas (de 1 minuto a 8 horas, unas 16 horas en total).
  Pendientes muestra a qué hora es el próximo intento y permite intentar ya. Recién después de la última
  espera queda como error, con la foto guardada para reintentar a mano. El servidor gratuito se duerme
  sin uso: dormido no reintenta, y retoma al volver a abrir la app.
- A la IA se le pide que no devuelva números de tarjeta ni datos personales.
- **Resumen de tarjeta en PDF**, en dos pasos. Primero el servidor saca el texto del PDF (hasta 20 páginas;
  si tiene contraseña, se escribe y no se guarda) y tapa con `***` lo que reconoce: números de tarjeta y
  de cuenta, DNI, CUIT, mails y lo que sigue a "Titular:", "Domicilio:", "Teléfono:". No guarda nada. El
  usuario lee el texto, lo corrige y agrega palabras para tapar siempre (su nombre, su calle), que se
  recuerdan solo en su teléfono. Recién cuando aprieta "Mandar a la IA" se guarda ese texto y se lee como
  cualquier documento. El PDF no se guarda nunca. Un PDF escaneado, sin texto, se rechaza con aviso.
- Formatos: JPG, PNG y WEBP, hasta 10 imágenes por documento (un ticket largo en varias fotos). Los
  resúmenes de tarjeta llegan en PDF (ver abajo).
- Un documento descartado se borra entero y se puede volver a subir. Lo mismo vale para uno confirmado
  cuyos movimientos se borraron todos: ya no cuenta para nada, así que no bloquea una nueva subida. Uno confirmado se conserva, sin
  imágenes, para que su huella impida cargarlo dos veces.
- Borrar un documento confirmado pregunta qué hacer con sus movimientos: quedan como manuales o van a la
  papelera.
- El contrato de lo que devuelve la IA está en `shared/src/schemas/extraction.ts` (borrador, a ajustar
  con documentos reales).

## 7. Duplicados (etapa 3; detección simple en la importación desde la etapa 1)

| Caso                                                                                                                   | Tratamiento                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| El mismo archivo subido dos veces                                                                                      | Se rechaza por la huella                                                                                     |
| La misma compra por dos vías (ticket y resumen)                                                                        | Coincidencia por monto, fecha cercana y cuenta: la app propone unirlos                                       |
| Pago de la tarjeta                                                                                                     | Transferencia, no egreso                                                                                     |
| Fila de planilla igual a un movimiento existente                                                                       | Se marca en la vista previa y se excluye salvo que el usuario la incluya                                     |
| Movimiento leído de un documento con la misma fecha, monto y moneda que uno ya cargado, o que otro del mismo documento | En la revisión aparece con un aviso y sin marcar; el usuario lo tilda si es otro                             |
| Fotos o capturas que se superponen                                                                                     | Subidas juntas ("partes de un mismo ticket" o "de una misma lista"), la IA informa cada renglón una sola vez |

## 8. Tarjetas y cuotas (etapa 3)

**Hecho (carga a mano):**

- En Más → Tarjetas se cargan el **cierre y el vencimiento** de cada resumen, y opcionalmente su total y
  pago mínimo. Una compra con tarjeta se paga en el vencimiento del primer cierre igual o posterior a su
  fecha; mientras no haya un cierre que la cubra, cuenta en su propia fecha. Corregir o borrar un cierre
  reacomoda solas las compras afectadas.
- Por cada resumen la pantalla muestra lo que la app tiene cargado para ese vencimiento y, si se cargó el
  total del resumen, la diferencia: sirve para descubrir compras que faltan.
- Una compra con tarjeta se puede cargar **en cuotas** (2 a 24 en la pantalla, hasta 60 por la API): se
  crea un movimiento por mes, vinculados a un plan. La primera lleva la fecha de la compra; si la tarjeta
  tiene cierres cargados, las siguientes se fechan 15 días después del cierre que cubre la compra, un mes
  aparte, así cada una cae en su resumen aunque la compra sea justo antes del cierre (sin cierres, van un
  mes aparte de la compra). Las cuotas futuras quedan **proyectadas**: se ven en
  la lista, cuentan en el resumen de su tarjeta y no cuentan en el balance hasta que llega su fecha, cuando
  se confirman solas. Cada cuota se puede corregir (interés) o borrar sola; también se pueden mandar todas
  a la papelera juntas.

**Hecho (lectura del resumen, sin probar con uno real):**

- La IA lee del resumen los movimientos y el **período**: cierre, vencimiento, total y pago mínimo, y el
  próximo cierre y vencimiento si están. En la revisión se ofrecen los dos períodos, editables, para las
  tarjetas que el usuario marque (la de pesos y la de dólares del mismo banco y marca vienen marcadas). Se
  guardan junto con las compras, todo o nada; si ese cierre ya estaba cargado, la confirmación avisa.
- Las líneas en dólares van de entrada a la tarjeta en dólares, si existe.
- La revisión muestra cuánto suma lo marcado en la moneda del resumen contra su total.
- Una cuota que cobra el resumen ("cuota 3 de 6") se fecha el día del cierre: el resumen imprime la fecha
  de la compra original, y la cuota se paga en este resumen.
- Si esa compra no está cargada, la revisión ofrece (marcado de entrada) crear también las cuotas que
  faltan, de 4 a 6, por el mismo monto y proyectadas, con su plan. Las anteriores no se crean: se pagaron
  antes. Se fechan 15 días después del cierre y un mes aparte, para que cada una caiga en su resumen.
- Si la cuota ya está cargada (mismo número, total y monto, por ejemplo proyectada por el resumen anterior),
  aparece como repetida y sin marcar: no se vuelve a crear.
- Intereses, impuestos (IVA, sellos, percepciones) y comisiones se proponen en "Cargos financieros" (ver
  sección 5). Como toda sugerencia, se puede cambiar en la revisión.

**Devoluciones (hecho):**

- Una devolución es un **egreso marcado como devolución**, con monto positivo, en la categoría de lo que se
  compró. Resta del egreso del mes, del resumen de la tarjeta y del consumo (sus productos cuentan como
  devueltos, no como compras). No es un ingreso.
- Se marca al cargar o editar un egreso, en la revisión de lo leído (la IA la propone cuando el comprobante
  o el resumen dice "devolución", "reintegro", "anulación", "bonificación") y en la planilla, con el tipo
  `devolución`. Una devolución no va en cuotas.

**Pago del resumen (hecho):**

- En Más → Tarjetas, cada resumen tiene "Registrar un pago": de qué cuenta sale la plata, la fecha y el
  monto, que arranca en lo que falta pagar. Crea una **transferencia** desde esa cuenta a la tarjeta, ligada
  al resumen. No es un egreso: las compras ya cuentan.
- Se puede pagar en partes. El resumen muestra lo pagado y lo que falta, contra el total que dice el banco
  o, si no se cargó, contra lo que la app sumó.
- Si la plata sale de una cuenta en otra moneda (dólares de la tarjeta pagados con pesos) se piden los dos
  montos: lo que sale de la cuenta y lo que cubre del resumen.
- Una tarjeta se paga desde efectivo, banco o billetera, no desde otra tarjeta.
- El pago es un movimiento más: se edita o se manda a la papelera, y ahí deja de contar. Si se borra el
  cierre, sus pagos quedan como transferencias sueltas.

**Lo que sigue:**

- El cierre decide en qué resumen cae una compra y, por lo tanto, su fecha de pago.
- Una compra en cuotas genera **un movimiento por mes**, vinculados a un plan. Las futuras quedan como
  proyectadas y pasan a confirmadas cuando llega el resumen que las incluye.
- Con interés, vale el monto real de cada resumen, no el total dividido.
- Del resumen se ignoran saldo y pago anteriores; la suma de lo extraído se controla contra el total del
  resumen.

## 9. Movimientos fijos (etapa 4)

Cuando un comercio aparece con monto parecido en meses seguidos, la app lo señala como posible fijo
(regla del backend, no IA). El usuario lo marca o lo deja; también puede marcar cualquier movimiento a
mano. Un fijo se espera cada mes, entra en la proyección y avisa si no apareció o cambió mucho.

## 10. Informes (balance mensual en etapa 1; el resto en etapa 4)

Balance del mes por moneda; gasto por categoría con apertura del árbol; por cuenta; evolución mensual;
principales comercios; cuotas y fijos pendientes; buscador con filtros; exportación a Excel.

**Por categoría (hecho).** La pestaña Informes abre en "Por categoría": para el mes elegido y por cada
moneda, los ingresos y los egresos con su total y cada categoría principal con su monto y su porcentaje, de
mayor a menor. Una categoría con subcategorías se abre y muestra cada una, más lo cargado directo en ella.
Usa las mismas reglas que el balance del Inicio, así que los totales coinciden: cuenta por fecha de pago,
las devoluciones restan, un movimiento dividido reparte cada parte en su categoría, y las transferencias y
la papelera no entran. Lo que no tiene categoría aparece como "Sin categoría".

**Productos de un movimiento.** Todo egreso o ingreso puede llevar el detalle de lo comprado: nombre,
grupo, cantidad y monto por renglón. Se cargan a mano al crear o editar un movimiento, y en la revisión de
un ticket se corrige lo que leyó la IA. Son opcionales y no tienen que sumar el total: la pantalla muestra
la diferencia (descuentos, recargos o renglones que no son productos) pero deja guardar. Un descuento se
carga con monto negativo.

**Consumo (hecho).** La otra pestaña de Informes muestra qué se compró en el mes, a partir de los productos
leídos de los tickets: total por moneda, grupos (lácteos, almacén, limpieza…) con su porcentaje y, al
abrir un grupo, cada producto con cuántas veces se compró y la cantidad. Un buscador muestra todas las
compras de un producto con fecha, comercio y precio. Solo cuenta compras cargadas desde un ticket con
detalle o con productos cargados a mano; un pago de MercadoPago sin detalle no aporta productos.

## 11. Pantallas

Diseño para celular primero. Barra inferior: **Inicio, Movimientos, +, Informes, Más**.

| Pantalla                 | Qué muestra                                                                         | Etapa |
| ------------------------ | ----------------------------------------------------------------------------------- | ----- |
| Login                    | Usuario y contraseña; aviso si el servidor está despertando                         | 1     |
| Inicio                   | Balance del mes por moneda, últimos movimientos                                     | 1     |
| Movimientos              | Lista por mes con buscador y filtros; tocar uno lo edita                            | 1     |
| Agregar                  | Carga manual (etapa 1); foto o archivo (etapa 2)                                    | 1 y 2 |
| Más                      | Cuentas, tarjetas, categorías, bancos, etiquetas, papelera, respaldo e importación  | 1 y 3 |
| Contraseña               | En Más: cada usuario cambia la suya                                                 | 1     |
| Usuarios                 | En Más, solo para el administrador: crear, cambiar contraseña, activar o desactivar | 1     |
| Pendientes               | Bandeja única de todo lo que espera una decisión                                    | 2     |
| Revisión                 | Imagen y datos extraídos                                                            | 2     |
| Tarjetas                 | Compras desde el último cierre, cada resumen con lo cargado, alta de cierres        | 3     |
| Privacidad y condiciones | `/privacidad` y `/condiciones`: páginas públicas, se leen sin iniciar sesión        | 1     |
| Informes                 | Ver sección 10                                                                      | 4     |

Toda pantalla contempla: cargando, lista vacía con indicación de qué hacer, error con reintento y
servidor despertando.

## 12. Modelo de datos

MongoDB. Los nombres están en inglés; ver `GLOSARIO.md`.

| Colección          | Guarda                                      | Apunta a                                                                                       | Etapa |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| `accounts`         | Cuentas                                     |                                                                                                | 1     |
| `categories`       | Árbol de categorías                         | `categories` (padre)                                                                           | 1     |
| `tags`             | Etiquetas                                   |                                                                                                | 1     |
| `transactions`     | Movimientos, con ítems y divisiones adentro | `accounts`, `categories`, `tags`, `documents`, `installmentPlans`, `cardPeriods`, `recurrings` | 1     |
| `documents`        | Archivos subidos y su extracción            | `accounts`                                                                                     | 2     |
| `categoryRules`    | Comercio → categoría                        | `categories`                                                                                   | 2     |
| `installmentPlans` | Compras en cuotas                           | `accounts`                                                                                     | 3     |
| `cardPeriods`      | Períodos de tarjeta                         | `accounts`, `documents`                                                                        | 3     |
| `recurrings`       | Movimientos fijos                           | `accounts`, `categories`                                                                       | 4     |
| `exchangeRates`    | Tasas de cambio por fecha                   |                                                                                                | 4     |
| `migrations`       | Migraciones ya aplicadas                    |                                                                                                | 1     |
| `users`            | Quién puede entrar, y su permiso de Drive   |                                                                                                | 1     |

Todas las colecciones, salvo `migrations` y `users`, guardan datos de un usuario: cada documento lleva su
dueño (`userId`) y lo que no puede repetirse (el nombre de una cuenta, una regla por comercio) es único
dentro de los datos de cada usuario. `users` no entra en ningún respaldo.

Los modelos de las etapas 2 a 4 ya existen para que el respaldo tenga un formato estable; sus servicios
y pantallas se escriben en su etapa.

Los ítems y las divisiones van **dentro** del movimiento: no existen sin él y no pueden quedar sueltos.

## 13. Borrado

| Se borra                          | Resultado                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Categoría con movimientos o hijas | Bloqueado: se archiva, o se une con otra                                      |
| Cuenta con movimientos            | Bloqueado: se archiva                                                         |
| Etiqueta                          | Se quita de todos sus movimientos en la misma operación                       |
| Movimiento                        | Va a la papelera 30 días; se puede recuperar, o borrar del todo desde ahí     |
| Documento (etapa 2)               | Pregunta: borrar sus movimientos o conservarlos como manuales                 |
| Cuota o plan (etapa 3)            | Pregunta: solo esa cuota o el plan; las confirmadas piden confirmación aparte |
| Período de tarjeta (etapa 3)      | Sus movimientos quedan sin período y se recalcula la fecha de pago            |
| Fijo (etapa 4)                    | Los movimientos quedan, solo pierden la marca                                 |
| Usuario                           | No se borra: se desactiva. No puede entrar y sus datos quedan                 |

## 14. Edición

- Un movimiento confirmado se puede editar siempre.
- Cambiar la fecha o la cuenta recalcula la fecha de pago, salvo que se indique una.
- Una categoría archivada que el movimiento ya tenía puede quedarse; no se puede asignar una archivada nueva.
- La tasa de cambio no afecta nada guardado.

## 15. Validaciones

Todas se aplican en el backend; el frontend las repite para avisar antes.

- Monto: entero en centavos, mayor que cero.
- Fecha: día válido, no futura.
- Moneda igual a la de la cuenta.
- Categoría del mismo tipo que el movimiento; las transferencias no llevan.
- Transferencia: origen y destino distintos; entre monedas, los dos montos.
- División: las partes suman el total.
- Cuota: el número no supera el total.
- Nombres únicos dentro de los datos de cada usuario: cuenta, etiqueta y categoría entre hermanas (sin
  distinguir mayúsculas ni acentos). El nombre de usuario es único en toda la app.
- Contraseña nueva: al menos 8 caracteres.
- Archivo: tipo y tamaño permitidos (5 MB), huella no repetida.

## 16. Integridad

MongoDB no impide una referencia rota; lo hace el backend:

1. El frontend nunca toca la base: todo pasa por los servicios.
2. Cada referencia se verifica antes de escribir.
3. Las operaciones que tocan varias colecciones son transacciones: todo o nada.
4. Lo que tiene historia se archiva.
5. Los índices únicos rechazan duplicados aunque falle lo anterior.
6. **Más → Respaldo y datos → Chequeo de integridad** lista cualquier referencia rota.

## 17. Seguridad

**Usuarios.** Cada persona entra con su nombre de usuario y su contraseña. Hay dos tipos:

- **Usuario**: usa la app con sus propios datos.
- **Administrador**: además crea usuarios, les pone una contraseña nueva y los activa o desactiva, desde
  Más → Usuarios. **No ve los datos de nadie**: no hay pantalla ni ruta para eso.

No hay registro abierto: solo un administrador crea usuarios. Un usuario nuevo arranca con las categorías,
cuentas y bancos iniciales. El primer administrador sale de las variables `AUTH_USERNAME` y
`AUTH_PASSWORD_HASH` la primera vez que arranca el servidor; después esas variables no se leen más.

Un usuario no se borra: se desactiva. Deja de poder entrar, se cierran sus sesiones y sus datos quedan.
Nadie se desactiva a sí mismo.

**Aislamiento.** Cada dato pertenece a un usuario y solo él lo ve, lo cambia, lo exporta o lo respalda.
Pedir un dato ajeno por su id responde "no existe". El respaldo, la restauración, la exportación, la
lectura con IA y la copia en Drive trabajan solo sobre los datos de quien los pide.

**Contraseñas y sesiones.** Las contraseñas se guardan como hash (bcrypt) en la base; nunca salen en una
respuesta ni en un respaldo. Una contraseña nueva tiene al menos 8 caracteres. La sesión es un token (JWT)
que vence a los 30 días. Hay límite de intentos de login, el backend acepta pedidos solo desde el frontend
configurado, y la clave de la IA vive solo en el backend.

Las sesiones de un usuario se cierran todas juntas, incluida la del dispositivo que lo pide, cuando:

- toca "Cerrar sesión en todos los dispositivos" (en Más; sirve si pierde el celular);
- cambia su contraseña (Más → Cambiar mi contraseña), o el administrador le pone una nueva;
- el administrador lo desactiva.

Cerrar las sesiones de un usuario no toca las de los demás.

Lo que queda del lado del usuario, porque la app no puede hacerlo por él:

- **Respaldo.** Atlas gratuito no hace copias. La app guarda una copia completa de los datos de cada
  usuario en **su propio** Google Drive una vez por día mientras se usa (un solo archivo,
  `gastos-respaldo.json`; Drive guarda versiones anteriores). El administrador configura Google una sola
  vez (`docs/RESPALDO_DRIVE.md`) y después cada usuario conecta su Drive con un botón en Más → Respaldo y
  datos; puede desconectarlo cuando quiera. Si la copia falla o pasan más de 3 días sin copia, la pantalla
  principal se lo avisa a ese usuario. El permiso de cada uno se guarda cifrado y no lo ve nadie más. El
  respaldo manual desde Más sigue disponible. Restaurar un respaldo reemplaza los datos de quien lo
  restaura, no los de los demás; uno que tiene datos que hoy son de otro usuario se rechaza.
- **Contraseña de la base.** Atlas acepta conexiones desde cualquier dirección porque Render gratuito
  no tiene dirección fija; la contraseña de la base es la única barrera y tiene que ser larga y al azar.
- **Claves.** Una clave que se pegó en un chat, un mail o un repositorio se da por expuesta y se cambia.
- **Privacidad.** Las fotos de los tickets se envían a Google (Gemini) para leerlas. Qué se guarda, a quién
  se envía y cómo pedir que se borre está en la política de privacidad (`/privacidad`), y las reglas de uso
  en `/condiciones`. Las dos son públicas, están enlazadas desde el login y desde Más, y son las que se
  declaran en Google Cloud. Muestran el mail de contacto de `VITE_CONTACT_EMAIL` si está cargado.
- **Borrar un usuario y sus datos** no tiene pantalla: lo hace a mano quien administra, sobre la base.
- **Quién administra.** Quien tiene acceso a Render y a la base de datos puede, técnicamente, leer todo. El
  aislamiento entre usuarios es de la app, no contra quien la aloja. Y un administrador que le pone una
  contraseña nueva a un usuario podría entrar como él: el usuario lo nota, porque su contraseña deja de
  andar y se le cierran las sesiones.

## 18. Segunda versión

Presupuestos por categoría, notificaciones de vencimiento, compartir hacia la app desde Android, uso
sin conexión, saldos por cuenta, conservar comprobantes de forma permanente.
