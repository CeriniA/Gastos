# Lógica del negocio

Estado: **borrador acordado entre el 4 y el 5 de noviembre de 2026. Nada de esto está implementado.**
Describe cómo debería funcionar la app. Lo que la app hace hoy está en `ESPECIFICACION.md`; cuando un
punto de acá se implemente, se pasa a esa especificación y a `DECISIONES.md`, y se marca como hecho.

Los términos son los de `GLOSARIO.md` (cuenta, movimiento, categoría, etiqueta, comercio, producto).

## 1. Qué es la app

Una app de **gastos**. Lleva lo que entra a las cuentas del usuario y lo que sale, para ver en qué se
gasta y cuánto se va a gastar. Los ingresos están **en pausa**: hoy sirven para sumar plata a una cuenta y
ver el saldo (un sueldo, un pago recibido). No se diseñan ventas, clientes ni facturas.

## 2. Los tres tipos de movimiento

| Tipo              | Qué es                                                      | Cuenta en gastos o ingresos |
| ----------------- | ----------------------------------------------------------- | --------------------------- |
| **Ingreso**       | Entra plata a una cuenta desde afuera                       | Ingreso                     |
| **Egreso**        | Sale plata de una cuenta hacia afuera                       | Gasto                       |
| **Transferencia interna** | La plata pasa de una cuenta del usuario a otra cuenta suya  | Ninguno                     |

- Lo que decide el tipo es **adónde fue la plata**, no cómo se mandó. Pagar a una persona o a un
  servicio por transferencia bancaria es un egreso. En pantalla el tercer tipo se llama **transferencia
  interna** para que no se confunda con eso; en el código sigue siendo `transfer`. Cómo salió la plata (efectivo,
  transferencia, débito) no se registra aparte: lo dice la cuenta de la que salió, banco, billetera o efectivo.
- Una transferencia es **un solo movimiento** con origen y destino (con dos montos si las monedas
  difieren). No son dos movimientos que se compensan: así no infla ingresos ni egresos y no se puede
  borrar una sola punta.
- Una transferencia no lleva categoría, comercio ni productos.
- Una devolución es un egreso marcado como devolución, con monto positivo: resta de su categoría.

## 3. Las listas y los ids

**Regla central: todo lo que un informe agrupa es una lista administrada y se guarda por id, nunca por
nombre.** Las listas son: categorías, comercios, productos, etiquetas y cuentas.

- Un movimiento guarda el id. Renombrar "Leche" a "Lechita" vale para todo lo ya cargado.
- Cada lista se puede **crear en el momento** (donde se elige, sin ir a otra pantalla), **renombrar**,
  **archivar** y **unir** con otro elemento. Unir deja un solo elemento y reapunta lo viejo.
- Lo que se usó **no se borra, se archiva**: deja de ofrecerse y lo viejo lo conserva.
- Los nombres se comparan sin tildes, mayúsculas ni espacios de más (`nameKey`).
- Lo que no es una lista queda como texto libre: la **nota** y el **texto impreso** de un renglón.
- Un nombre que la app necesita reconocer (los cargos financieros) se marca con un **rol**, no se
  busca por su texto. Así se puede renombrar sin que la app lo pierda.

## 4. Qué lleva un egreso

| Campo                    | Tipo de dato                         | Para qué                                   |
| ------------------------ | ------------------------------------ | ------------------------------------------ |
| Fecha y fecha de pago    | fecha                                | La de pago decide el mes en los informes   |
| Monto y moneda           | entero en centavos, código           | Si fue en otra moneda, se guarda el original |
| Cuenta                   | lista                                | De dónde salió                             |
| Categoría                | lista (árbol)                        | En qué tipo de gasto cuenta                |
| Comercio                 | lista, **opcional**                  | Dónde fue                                  |
| Nota                     | texto libre                          | Algo para recordar. No entra en informes   |
| Etiquetas                | lista, varias                        | Un evento que cruza categorías             |
| Renglones                | opcional                             | Qué se compró (ver sección 5)              |

La **descripción desaparece**: era el comercio escrito a mano. Queda comercio (lista) y nota (libre).

## 5. Qué se compró: tres niveles

```
Categoría     Supermercado → Lácteos
Producto        Leche, Queso
Texto impreso     "LECHE LS 1L"
```

- **Categoría**: dónde se suma. Es el árbol del usuario.
- **Producto**: qué cosa es, genérico, sin marca ni tamaño ("Gaseosa", no "Coca-Cola 2,25 L"). Es una
  lista; **cada producto apunta a una categoría**.
- **Texto impreso**: lo que dijo el comercio. Se guarda tal cual y se puede buscar, pero no se suma.

Los 16 grupos de producto fijos desaparecen: pasan a ser categorías del usuario.
Se crea un producto solo cuando se quiere comparar ese gasto mes a mes; no hay un producto por marca.
Los productos solo van en **egresos** (devoluciones incluidas).

**Cómo cuentan los informes por categoría:**

1. Un egreso con renglones suma **cada renglón a la categoría de su producto**. Un remedio comprado en
   el súper cuenta en Farmacia.
2. Lo que los renglones no cubren (descuentos, impuestos, una línea sin leer) queda en la categoría del
   egreso entero. El total del mes **nunca cambia** por tener renglones.
3. Una devolución resta de la categoría de cada renglón devuelto.
4. Un egreso sin renglones cuenta entero en su categoría.

No hay división manual de un pago en varias categorías: la reemplazan los renglones.

Un renglón **sin producto** puede llevar su propia categoría. Sirve para lo que no se reconoció y para
migrar las divisiones viejas. La categoría de un renglón es la de su producto; si no tiene producto, la
suya; si tampoco, la del pago entero.

**Migración de las divisiones manuales ya cargadas:** cada parte de una división pasa a ser un renglón
sin producto, con su monto y su categoría, y el movimiento recupera su categoría de pago (la de la parte
más grande). Las partes sumaban el total, así que los renglones también, y los informes dan lo mismo
antes y después. Corre sola, una vez por usuario, y también sobre un respaldo viejo cuando se restaura.

**Dos formas de mirar lo mismo:** por categoría, bajando hasta los productos, y por producto en todo el
mes sin importar dónde ni en qué categoría se compró.

## 6. Categorías

- Árbol de hasta **3 niveles**, con ingresos y egresos en listas separadas. Los productos no son un nivel.
- Hoy cada usuario **nuevo** recibe de entrada 13 categorías de egresos planas (`starter.ts`). La lista
  de abajo la reemplaza para usuarios nuevos. A quien ya usa la app no se le aplica sola: se le ofrece
  un botón "Agregar categorías sugeridas" que suma las que falten sin tocar las suyas. En los dos casos
  el usuario las edita después como cualquier otra:

```
Supermercado   Almacén · Lácteos · Carnes · Verduras y frutas · Panadería · Bebidas · Congelados ·
               Limpieza · Perfumería
Hogar          Servicios (Luz, Gas, Agua, Internet) · Mantenimiento
Salud          Farmacia · Médicos
Comidas afuera
Transporte
Ocio
Impuestos y cargos   (rol "cargos financieros")
               Intereses · Impuestos (IVA, sellos, percepciones) · Mantenimiento y comisiones
Otros
```

- El rol marca la categoría padre y vale para todo su subárbol.

## 7. Comercios y productos

- Los dos son listas con **textos conocidos**: el texto que un ticket o un resumen imprime queda
  vinculado al elemento ("COTO CICSA 0123" → Coto; "YERB.PLAY 1000" → Yerba). La próxima vez se
  reconoce solo. Reemplazan a las reglas de comercio y a los productos corregidos de hoy.
- Un **comercio** puede tener una **categoría habitual**, que se sugiere al elegirlo. Cuando el usuario
  corrige una categoría y acepta "¿siempre va ahí?", se guarda como la habitual del comercio.
- El comercio es **opcional**. Si el comprobante lo muestra, la IA lo deja sugerido y editable; si no,
  el campo queda vacío.
- Un producto tiene nombre y categoría.

**La IA propone, el usuario decide.** Si lo que lee coincide con algo que ya existe (por `nameKey` o por
un texto conocido), lo usa. Lo que no existe aparece en la revisión marcado como **nuevo** para que el
usuario lo confirme, lo cambie o lo cree ahí mismo. En un resumen con muchos comercios nuevos se
muestran juntos, con un botón para aceptarlos todos. En una planilla importada, la vista previa avisa
cuántos comercios y productos se crearían y se crean recién al aprobar.

## 8. Cómo se carga

| Camino                         | Qué pasa                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------- |
| A mano                         | Se elige o crea comercio y categoría; los renglones son opcionales                |
| Foto de un ticket              | La IA propone comercio, categoría y producto por renglón; el usuario revisa       |
| Captura de pantalla            | Igual que la foto                                                                 |
| PDF de cualquier tipo          | Siempre pasa a texto, que el usuario revisa antes de mandarlo. Resumen de banco: ya existe. Ticket o factura: falta un tipo nuevo que use las instrucciones de comprobante (con renglones) |
| Resumen de tarjeta o de cuenta | Muchos movimientos sin renglones; la IA propone el comercio de cada fila          |
| Planilla Excel o CSV           | Los nombres se emparejan con las listas                                           |

Los caminos dejan el mismo tipo de movimiento. La imagen de un comprobante se borra al confirmar o
descartar (como hoy).

**Regla de privacidad:** lo que se pasa a texto (todo PDF, Excel o CSV) puede traer datos sensibles, así
que **se muestra al usuario para que lo revise, con los datos personales tapados, antes de mandarlo a la
IA**. Lo que se manda sin pasar a texto son imágenes de tickets y capturas, que no llevan datos
sensibles. Un PDF escaneado, sin texto, se rechaza con aviso: una factura o un resumen escaneados no
se mandan sin revisar; se pide otro archivo o una foto del ticket.

## 9. Duplicados: se avisa, no se bloquea

- Al **cargar a mano**, al **revisar un documento** y al **importar una planilla**, si hay un movimiento
  parecido, se avisa "Parece repetido de…" con el botón **Cargar igual**.
- **Parecido** es: mismo monto y moneda con una fecha a **±3 días**, o la misma cuota del mismo plan.
  La tolerancia de fecha va en una constante con nombre.
- Si el usuario carga igual, queda duplicado y puede mandar uno a la papelera. Nada se une solo.
- El mismo archivo subido dos veces se rechaza por su huella (como hoy).

## 10. Tarjetas de crédito

- La tarjeta es una **cuenta** de tipo crédito. Su saldo es lo que se debe (negativo). Una tarjeta con
  pesos y dólares son **dos cuentas que comparten sus fechas**.
- Un **resumen** tiene cierre, vencimiento, total y pago mínimo. Una compra se paga en el vencimiento del
  primer cierre igual o posterior a su fecha, y ese es el mes en que cuenta.
- Una compra en **cuotas** es un plan con un movimiento por mes. Las futuras quedan proyectadas y cuentan
  en el balance recién cuando llega su fecha.
- **Intereses, impuestos y mantenimiento** son egresos comunes de la cuenta de la tarjeta, en las
  subcategorías de "Impuestos y cargos". Si el mantenimiento se repite igual cada mes, se marca como fijo.
- El resumen trae "saldo anterior" y "pagos recibidos": **no son gastos** y no se cargan como tales.

### Pagar la tarjeta

- Pagar es una **transferencia** de una cuenta del usuario a la tarjeta, ligada al resumen; **no es un
  egreso**, porque las compras ya contaron. Se puede pagar en partes.
- Registrar el pago es **opcional con ayuda**:
  - se propone desde el **resumen de la cuenta** del banco (la línea "pago tarjeta");
  - se propone desde el **resumen de la tarjeta** ("pagos recibidos"), que es la otra punta de la misma
    transferencia: si ya está cargado aparece repetido y sin marcar;
  - se carga a mano.
- Sin pagos registrados la app funciona igual para gastos y proyección; solo quedan sin reflejar el saldo
  de la cuenta del banco y la deuda de la tarjeta.
- El **estado de cada resumen** (pagado, parcial, impago, vencido) **se calcula** comparando lo pagado con
  el total. No se guarda.
- **Recordatorio:** cuando un resumen venció sin pago completo, la app lo avisa dentro de la app
  ("Visa venció el día X y faltan $Y; el próximo resumen puede traer intereses"). No inventa los
  intereses: aparecen cuando se carga el siguiente resumen.
- **Control con el resumen siguiente:** se compara el saldo anterior y los pagos que trae con lo que la
  app tiene, y se avisa si no coinciden. Requiere que la lectura de la IA incluya esos dos datos.

### Proyección del mes que viene

Suma lo ya cargado que vence ese mes (compras de tarjeta incluidas), las cuotas que vienen y los
fijos esperados. Ya cuenta cada compra de tarjeta en el mes en que se paga, así que no depende de
registrar el pago.

## 11. Estructura de datos

Cada colección con datos del usuario lleva `ownedByUser` y registra su puerto de respaldo.

| Tabla                         | Cambio                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `merchant` (nueva)            | nombre, categoría habitual (opcional), archivado                                    |
| `merchantAlias` (nueva)       | **Implementado dentro de `merchant`** (`aliases`), ver `DECISIONES.md`              |
| `product` (nueva)             | nombre, categoría, archivado                                                        |
| `productAlias` (nueva)        | **Implementado dentro de `product`** (`aliases`)                                    |
| `category`                    | se agrega `role`                                                                    |
| `transaction`                 | sale `description` y `splits`; entra `merchantId`; cada renglón guarda `productId`  |
| `recurring`                   | `merchantKey` pasa a `merchantId`                                                   |
| `installmentPlan`             | `description` pasa a `merchantId`                                                   |
| `categoryRule`, `productRule` | desaparecen; las reemplazan la categoría habitual y los textos conocidos            |

Los renglones siguen **dentro** del movimiento: nunca se consultan sin su ticket.
Los vínculos los verifica el backend antes de escribir. Unir, archivar y todo lo que toca más de una
colección corre dentro de una transacción de base de datos.
La **migración** (`2026-11-10-merchants-products`, hecha) llena las listas sin tocar los movimientos; reapuntarlos es el paso 3. Crea comercios y productos desde lo ya cargado (juntando los que solo
difieren en tildes o mayúsculas) y convierte en categorías los grupos de producto que se usan (no los 16).

## 12. Lo que queda abierto

- **PDF de ticket o factura**: decidido que pasa a texto y se revisa (sección 8). Falta probar con
  documentos reales que el texto de un PDF conserve bien los renglones de un ticket. Al implementarlo,
  revisar si `legal.ts` debe nombrar también tickets y facturas en PDF.
- Etiquetas y monto original en moneda extranjera sobre una transferencia: hoy se permiten.
- Diseño de los **ingresos**: se define **después** de implementar lo pactado acá.
- Qué pasa con la pantalla "Lo que la app recuerda" cuando las reglas pasen a ser comercios y productos.

## 13. Orden previsto

1. **Auditoría** del código contra este documento y contra las reglas de `AGENTS.md`, incluida la
   revisión de textos repetidos que debieran ser constantes. Es un informe; no cambia código.
2. **Actualizar los demás documentos** (`ESPECIFICACION.md`, `GLOSARIO.md`, `ARQUITECTURA.md`,
   `API.md`, `DECISIONES.md`, `ROADMAP.md`) con lo pactado, antes de tocar código.
3. Implementación por partes chicas, cada una con prueba y commit, en este orden sugerido:
   listas base y rol → movimientos con ids y migración (incluida la de las divisiones) → informes por
   renglón → tarjetas (estado, recordatorio, control) → duplicados al cargar a mano → PDF de ticket o
   factura.
4. Recién entonces, el diseño de los **ingresos**.
