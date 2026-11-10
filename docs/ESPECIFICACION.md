# Especificación

Qué hace la app y bajo qué reglas. Es la referencia del proyecto: si el código y este documento no
coinciden, uno de los dos está mal y hay que resolverlo.

Cada sección indica en qué etapa se construye (`ROADMAP.md`). Lo marcado **etapa 1** ya está en esta base.

**Nota (7/11/2026):** la lógica nueva acordada (comercios y productos como listas, categorías por producto,
sin descripción ni divisiones, tarjetas con recordatorio) está en `LOGICA_NEGOCIO.md` y **todavía no está
implementada**. Este documento describe lo que la app hace hoy; cuando se implemente cada parte, se pasa acá.

## 1. Propósito y alcance

App web personal para registrar ingresos, egresos y transferencias, y ver el resultado de cada mes. Se usa
sobre todo desde el celular (Android), instalada como app.

Una misma instalación la usan varias personas, cada una con su usuario. **Cada usuario tiene sus propios
datos y no ve los de nadie más** (sección 17). Todo lo que sigue en este documento ("las cuentas", "los
movimientos", "el respaldo") se refiere a los del usuario que está usando la app.

Formas de cargar un movimiento:

| Vía                                                                 | Etapa |
| ------------------------------------------------------------------- | ----- |
| Carga manual                                                        | 1     |
| Importación de planilla (Excel o CSV)                               | 1     |
| Foto de ticket                                                      | 2     |
| Captura de MercadoLibre o MercadoPago                               | 2     |
| Resumen de tarjeta en PDF                                           | 3     |
| Resumen de cuenta (banco, MercadoPago, una app) en PDF, Excel o CSV | 4     |

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

Estados: `confirmado` (cuenta en los informes) y `proyectado` (cuota futura). Lo que se espera de un
movimiento fijo no se guarda como movimiento: la proyección lo calcula (sección 10). Lo que lee la IA no
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
- Vista consolidada (hecho, 17/10/2026): cada informe se puede ver con cada moneda por separado (como
  arranca), todo en pesos o todo en dólares, usando una **tasa de cambio cargada a mano** con fecha de
  inicio (Más → Tasas de cambio: cuántos pesos vale un dólar desde un día). Cada movimiento se convierte
  con la tasa vigente el día del movimiento, que es la última que empezó ese día o antes; cambiar la tasa
  hoy no altera los meses anteriores. Si un día no tiene tasa, el movimiento queda afuera y la vista avisa
  cuántos quedaron, con un enlace para cargar una: no inventa. Dos tasas no empiezan el mismo día. Una tasa
  se corrige o se borra cuando se quiere: no cambia nada guardado.

## 4. Cuentas

Efectivo, cuenta bancaria, billetera virtual o tarjeta de crédito, cada una con su moneda. El tipo y la
moneda no se cambian después de crearla. Una cuenta con movimientos no se borra: se archiva.

Cada cuenta puede indicar su **banco o emisor**, y una tarjeta de crédito su **marca** (Visa, Mastercard…),
elegidos de una lista que arranca con los más comunes de Argentina y que el usuario amplía, renombra o
archiva en Más → Bancos y tarjetas. Uno en uso no se borra: se archiva.

Una tarjeta con saldo en pesos y en dólares son **dos cuentas** (por ejemplo "Visa" y "Visa USD") con el
mismo banco y marca. Comparten cierres: al cargar uno, la app ofrece aplicarlo a las dos.

**Saldo (hecho, 17/10/2026).** Más → Cuentas muestra el saldo de hoy de cada cuenta. Cada una puede tener un
**saldo inicial**: lo que tenía al empezar un día, antes de sus movimientos, según el banco o la app (en una
tarjeta, lo que se debe, con signo menos). El saldo es ese monto más los movimientos confirmados desde ese
día, los de ese día incluidos: los ingresos y las
transferencias que llegan suman, los egresos y las que salen restan, y una devolución devuelve. Sin saldo
inicial, la cuenta arranca en cero con su primer movimiento. Las cuotas proyectadas y la papelera no
cuentan. Se calcula, no se guarda. Al revisar un resumen de cuenta, la app compara este saldo con el del
resumen (sección 6).

## 5. Categorías y etiquetas

**Categorías**: árbol de hasta **tres niveles**, con listas separadas para ingresos y egresos. Cada usuario nuevo
arranca con una lista inicial (`starter.ts`) y desde ahí las edita.

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

La categoría se reconoce por su rol `financial_charges`, no por el nombre. Si el usuario la archivó, no se crea ni se
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
- **Resumen de tarjeta**, en dos pasos. Primero el servidor saca el texto del archivo: un PDF de hasta 20
  páginas (si tiene contraseña, se escribe y no se guarda), un Excel (`.xlsx`) o un CSV y tapa con `***` lo que reconoce: números de tarjeta y
  de cuenta, DNI, CUIT, mails y lo que sigue a "Titular:", "Domicilio:", "Teléfono:". No guarda nada. El
  usuario lee el texto, lo corrige y agrega palabras para tapar siempre (su nombre, su calle), que se
  recuerdan solo en su teléfono. Recién cuando aprieta "Mandar a la IA" se guarda ese texto y se lee como
  cualquier documento. El PDF no se guarda nunca. Un PDF escaneado, sin texto, se rechaza con aviso.
- Formatos: JPG, PNG y WEBP, hasta 10 imágenes por documento (un ticket largo en varias fotos). Los
  resúmenes llegan en PDF, Excel (`.xlsx`) o CSV.
- **Resumen de cuenta** (hecho, 17/10/2026): los movimientos de una cuenta del banco, de MercadoPago, de
  Ualá o de cualquier app, también el de la cuenta de débito. Mismo camino que el de tarjeta: el archivo se
  pasa a texto (un Excel, fila por fila; un CSV, tal cual), se tapan los datos (también CBU, CVU y alias) y
  el usuario lo aprueba. Un Excel viejo (`.xls`) se rechaza con el pedido de guardarlo como `.xlsx` o CSV.
  - La IA lee ingresos, egresos y transferencias. Lo que decide el tipo es **adónde fue la plata**, no cómo
    se pagó: pagar un servicio o a una persona por transferencia es un egreso; recibir de otro, un ingreso;
    solo la plata que pasa entre dos cuentas del usuario (cargar MercadoPago desde el banco, pagar la
    tarjeta, comprar dólares, sacar del cajero) es transferencia. Ante la duda propone egreso o ingreso y lo
    marca como dudoso.
  - Una transferencia que entró a la cuenta llega con esa cuenta como destino, y el usuario elige de cuál
    salió; una que salió, al revés.
  - Lo que ya está cargado (el ticket del súper pagado con débito o QR, la otra punta de una transferencia
    ya cargada) aparece como repetido y sin marcar: misma fecha, monto y moneda, en cualquier cuenta.
  - Impuestos y comisiones del banco van a "Cargos financieros", como en la tarjeta.
  - **Control del saldo**: si el resumen trae el saldo final, la revisión lo compara con el saldo de la
    cuenta en la app ese día más lo marcado, y muestra la diferencia. Si la cuenta no tiene saldo inicial,
    ofrece empezarlo con el saldo inicial del resumen.
- Un documento descartado se borra entero y se puede volver a subir. Lo mismo vale para uno confirmado
  cuyos movimientos se borraron todos: ya no cuenta para nada, así que no bloquea una nueva subida. Uno confirmado se conserva, sin
  imágenes, para que su huella impida cargarlo dos veces.
- Borrar un documento confirmado pregunta qué hacer con sus movimientos: quedan como manuales o van a la
  papelera.
- El contrato de lo que devuelve la IA está en `shared/src/schemas/extraction.ts` (borrador, a ajustar
  con documentos reales).

## 7. Duplicados (etapa 3; detección simple en la importación desde la etapa 1)

| Caso                                                                                                                   | Tratamiento                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El mismo archivo subido dos veces                                                                                      | Se rechaza por la huella                                                                                                                                 |
| La misma compra por dos vías (ticket y resumen)                                                                        | Es el caso de la fila de abajo: mismo día, monto y moneda, en cualquier cuenta. Sale sin marcar y queda el del ticket, con sus productos. No se une nada |
| Pago de la tarjeta                                                                                                     | Transferencia, no egreso                                                                                                                                 |
| Fila de planilla igual a un movimiento existente                                                                       | Se marca en la vista previa y se excluye salvo que el usuario la incluya                                                                                 |
| Movimiento leído de un documento con la misma fecha, monto y moneda que uno ya cargado, o que otro del mismo documento | En la revisión aparece con un aviso y sin marcar; el usuario lo tilda si es otro                                                                         |
| Fotos o capturas que se superponen                                                                                     | Subidas juntas ("partes de un mismo ticket" o "de una misma lista"), la IA informa cada renglón una sola vez                                             |

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

## 9. Movimientos fijos (hecho, 17/10/2026)

Un fijo es un ingreso o egreso que se espera todos los meses por un monto parecido: alquiler, sueldo,
servicios, suscripciones. Se ven en Más → Movimientos fijos.

- **Sugerencia** (regla del backend, no IA): un comercio que se pagó **exactamente una vez por mes**, en al
  menos **3 meses seguidos**, por un monto que no se aleja más de un **20 %** del último, aparece en "Parecen
  fijos". La racha termina este mes o el anterior (el de este mes puede no haber llegado). El usuario toca
  "Es fijo" o "No es fijo"; nada se marca solo. Un comercio marcado como no fijo no se vuelve a sugerir, y
  queda en una lista donde se puede deshacer.
- **Marca a mano**: al abrir cualquier ingreso o egreso con descripción, "Es un movimiento fijo". El fijo
  toma el nombre (la descripción), el monto, la cuenta, la categoría y el día de pago de ese movimiento. Si
  su comercio ya es un fijo, el movimiento se suma a ese.
- **Cómo se reconoce cada mes**: por los movimientos marcados con él y por los de su mismo tipo, moneda y
  descripción (sin distinguir mayúsculas ni acentos) que no estén marcados con otro. Cuenta por **fecha de
  pago**, como el balance: una suscripción con tarjeta se espera en el mes en que se paga.
- **Estado del mes**: llegó; cambió mucho (más de un 20 % de diferencia con lo esperado, con un botón para
  usar el monto nuevo de ahí en más); no apareció (pasaron 5 días de su día); todavía no llegó; en pausa.
- **Aviso**: el Inicio avisa cuántos fijos no aparecieron o cambiaron mucho este mes.
- **Proyección**: los fijos activos que todavía no llegaron entran en "Próximos" de Informes (sección 10).
- Se edita el nombre, el monto esperado, el día, la cuenta (y con ella la moneda) y la categoría; se pausa o
  se borra. El nombre no se repite entre fijos del mismo tipo y moneda: "Netflix" en pesos y en dólares son
  dos. Borrarlo no toca los movimientos: solo pierden la marca. Una cuenta con un fijo no se borra; una
  categoría borrada deja al fijo sin categoría, y una unida a otra lo lleva con ella.

## 10. Informes (hecho)

Pestañas: **Categorías, Cuentas, Meses, Comercios, Próximos y Consumo**. Todas, salvo Consumo, se ven con
cada moneda por separado o todo en una (sección 3). Todas cuentan igual que el balance del Inicio: por fecha
de pago, las devoluciones restan, las transferencias no son ingreso ni egreso y la papelera no entra. El
buscador con filtros está en Movimientos y la exportación a Excel en Más → Respaldo y datos.

**Por cuenta.** Para el mes, cada cuenta en uso, se haya movido o no (y las archivadas que se movieron), con
su **saldo al final del mes** (hoy, si es el mes actual) y lo que entró y salió: ingresos, egresos y las
transferencias que recibió y que envió (pagar la tarjeta, comprar dólares), en su moneda. Una cuenta sin
movimientos muestra su saldo y "Sin movimientos este mes". Antes del día de su saldo inicial no se sabe qué
tenía: el informe lo dice en vez de mostrar un número (pedido del usuario, 17/10/2026).

**Meses.** Los 12 meses que terminan en el elegido, del más nuevo al más viejo: ingresos, egresos y balance
de cada uno, con barras para comparar y el egreso promedio de los meses con movimientos.

**Comercios.** Los egresos del mes agrupados por su descripción (sin distinguir mayúsculas ni acentos), de
mayor a menor, con cuántas compras fueron. Los 20 más grandes van uno por uno; el resto y lo que no tiene
descripción, juntos.

**Próximos (proyección).** Este mes y los dos siguientes. Por moneda: lo ya cargado que se paga en ese mes
(incluidas las compras con tarjeta hechas antes), lo esperado (cuotas proyectadas y fijos que todavía no
llegaron) y cómo terminaría el mes. Debajo, la lista de lo esperado con su fecha. Se calcula, no se guarda.

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

**Productos corregidos (hecho, 17/10/2026).** Si en la revisión de un ticket el usuario cambia el producto o el
grupo de un renglón que leyó la IA, la app ofrece "Recordar los productos que corregí" (viene tildado). En los
próximos tickets, el renglón con el mismo texto impreso (sin distinguir mayúsculas ni acentos) se propone con
ese producto y ese grupo. Sigue siendo una propuesta: la revisión lo muestra y se cambia. Recordar otra vez el
mismo texto reemplaza lo anterior. Se olvida en Más → Lo que la app recuerda.

**Consumo (hecho).** La otra pestaña de Informes muestra qué se compró en el mes, a partir de los productos
leídos de los tickets: total por moneda, grupos (lácteos, almacén, limpieza…) con su porcentaje y, al
abrir un grupo, cada producto con cuántas veces se compró y la cantidad. Un buscador muestra todas las
compras de un producto con fecha, comercio y precio. Solo cuenta compras cargadas desde un ticket con
detalle o con productos cargados a mano; un pago de MercadoPago sin detalle no aporta productos.

## 11. Pantallas

Diseño para celular primero. Barra inferior: **Inicio, Movimientos, +, Informes, Más**.

| Pantalla                 | Qué muestra                                                                                                | Etapa |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ----- |
| Login                    | Usuario y contraseña; aviso si el servidor está despertando                                                | 1     |
| Inicio                   | Balance del mes por moneda, últimos movimientos                                                            | 1     |
| Movimientos              | Lista por mes con buscador y filtros; tocar uno lo edita                                                   | 1     |
| Agregar                  | Carga manual; foto o captura; resumen de tarjeta o de cuenta (PDF, Excel o CSV)                            | 1 a 4 |
| Más                      | Cuentas, tarjetas, fijos, categorías, bancos, etiquetas, tasas, papelera, datos                            | 1 a 4 |
| Cuentas                  | En Más: cada cuenta con su saldo de hoy; su saldo inicial se edita                                         | 1 y 4 |
| Contraseña               | En Más: cada usuario cambia la suya                                                                        | 1     |
| Usuarios                 | En Más, solo para el administrador: crear, editar, cambiar contraseña, desactivar                          | 1     |
| Pendientes               | Bandeja única de todo lo que espera una decisión                                                           | 2     |
| Revisión                 | Imagen y datos extraídos                                                                                   | 2     |
| Tarjetas                 | Compras desde el último cierre, cada resumen con lo cargado, alta de cierres                               | 3     |
| Movimientos fijos        | En Más: cada fijo y cómo está este mes, sugerencias, los marcados como no fijos                            | 4     |
| Tasas de cambio          | En Más: pesos por dólar desde cada día, para ver los informes en una moneda                                | 4     |
| Lo que la app recuerda   | En Más: comercio → categoría, productos corregidos y documentos confirmados; cada uno se olvida o se borra | 2 y 4 |
| Privacidad y condiciones | `/privacidad` y `/condiciones`: páginas públicas, se leen sin iniciar sesión                               | 1     |
| Informes                 | Ver sección 10                                                                                             | 4     |

Toda pantalla contempla: cargando, lista vacía con indicación de qué hacer, error con reintento y
servidor despertando.

## 12. Modelo de datos

MongoDB. Los nombres están en inglés; ver `GLOSARIO.md`.

| Colección          | Guarda                                             | Apunta a                                                                                       | Etapa |
| ------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----- |
| `accounts`         | Cuentas, con su saldo inicial                      |                                                                                                | 1     |
| `categories`       | Árbol de categorías                                | `categories` (padre)                                                                           | 1     |
| `tags`             | Etiquetas                                          |                                                                                                | 1     |
| `merchants`        | Comercios, con su categoría habitual y sus textos conocidos | `categories`                                                                      | 5     |
| `products`         | Productos, con su categoría y sus textos conocidos | `categories`                                                                                   | 5     |
| `transactions`     | Movimientos, con ítems y divisiones adentro        | `accounts`, `categories`, `tags`, `merchants`, `products`, `documents`, `installmentPlans`, `cardPeriods`, `recurrings` | 1     |
| `documents`        | Archivos subidos y su extracción                   | `accounts`                                                                                     | 2     |
| `categoryRules`    | Comercio → categoría                               | `categories`                                                                                   | 2     |
| `productRules`     | Renglón de ticket → producto y grupo               |                                                                                                | 4     |
| `installmentPlans` | Compras en cuotas                                  | `accounts`                                                                                     | 3     |
| `cardPeriods`      | Períodos de tarjeta                                | `accounts`, `documents`                                                                        | 3     |
| `recurrings`       | Movimientos fijos, y comercios que no lo son       | `accounts`, `categories`                                                                       | 4     |
| `exchangeRates`    | Tasas de cambio por fecha                          |                                                                                                | 4     |
| `migrations`       | Migraciones ya aplicadas                           |                                                                                                | 1     |
| `users`            | Quién entra, su permiso de Drive y su límite de IA |                                                                                                | 1     |

Todas las colecciones, salvo `migrations` y `users`, guardan datos de un usuario: cada documento lleva su
dueño (`userId`) y lo que no puede repetirse (el nombre de una cuenta, una regla por comercio) es único
dentro de los datos de cada usuario. `users` no entra en ningún respaldo.

Todos los modelos tienen servicio y pantalla desde el 17/10/2026. Se crearon antes que sus pantallas para que
el respaldo tuviera un formato estable desde el principio.

Los ítems y las divisiones van **dentro** del movimiento: no existen sin él y no pueden quedar sueltos.

## 13. Borrado

| Se borra                          | Resultado                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Categoría con movimientos o hijas | Bloqueado: se archiva, o se une con otra                                      |
| Cuenta con movimientos            | Bloqueado: se archiva. También con cierres, planes de cuotas o fijos          |
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
  distinguir mayúsculas ni acentos); un fijo, entre los de su mismo tipo y moneda. El nombre de usuario es
  único en toda la app.
- Saldo inicial: un monto (con signo: negativo es deuda) y un día; los dos o ninguno.
- Tasa de cambio: mayor que cero; dos no empiezan el mismo día.
- Contraseña nueva: al menos 8 caracteres.
- Archivo: tipo y tamaño permitidos (5 MB), huella no repetida. Un resumen se reconoce por su contenido,
  no por el nombre: PDF (hasta 20 páginas), Excel `.xlsx` (hasta 5000 filas) o CSV, y hasta 100.000
  caracteres de texto. Un Excel viejo (`.xls`) se rechaza con el pedido de guardarlo como `.xlsx` o CSV.
- Lectura con IA: hasta el límite diario de cada usuario (sección 17).

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
- **Administrador**: además crea usuarios, les cambia el nombre y el tipo, les pone una contraseña nueva,
  los activa o desactiva y les fija el límite diario de lectura con IA, desde Más → Usuarios. **No ve los
  datos de nadie**: no hay pantalla ni ruta para eso. Un administrador no puede desactivarse ni cambiarse
  el tipo a sí mismo, así siempre queda uno.

**Límite de lectura con IA.** Todos los usuarios comparten el cupo gratuito de la misma clave de Gemini.
Para que uno no lo gaste entero, cada usuario puede mandar a leer una cantidad de documentos por día: 30, o
lo que diga la variable `AI_DAILY_READINGS`, salvo que el administrador le dé otro (0 lo deja sin IA).
Cuenta cada ticket, captura o resumen mandado a leer y cada "Volver a leer"; los reintentos automáticos
cuando la IA no tiene cupo no cuentan. Pasado el límite, la subida se rechaza con un aviso y no se guarda
nada; al día siguiente vuelve a cero. En Más → Usuarios se ve cuántas lleva cada uno hoy.

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
sin conexión, conservar comprobantes de forma permanente. (Los saldos por cuenta se adelantaron el
17/10/2026, a pedido del usuario.)
