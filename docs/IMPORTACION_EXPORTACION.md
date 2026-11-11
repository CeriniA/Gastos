# Importación y exportación

Hay dos formatos, para dos usos distintos.

|                 | Planilla (Excel o CSV)                   | Respaldo completo (JSON)          |
| --------------- | ---------------------------------------- | --------------------------------- |
| Para qué        | Leer, analizar, traer datos de otro lado | Copia de seguridad y restauración |
| Contiene        | Movimientos confirmados                  | Todas las colecciones, tal cual   |
| Se edita a mano | Sí                                       | No                                |
| Al importar     | Agrega movimientos                       | Reemplaza todo                    |

Los dos están en **Más → Respaldo y datos**.

## Planilla

Una fila por movimiento. La definición única está en `shared/src/importFormat.ts`: la exportación
escribe estas columnas y la importación las lee, así que un archivo exportado se puede volver a importar.

| Columna        | Obligatoria                  | Ejemplo                      | Notas                                                                     |
| -------------- | ---------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Fecha          | Sí                           | `2026-10-05`                 | También `05/10/2026` o una fecha de Excel. No puede ser futura            |
| Tipo           | Sí                           | `egreso`                     | `egreso`, `ingreso`, `transferencia` o `devolución` (un egreso que resta) |
| Monto          | Sí                           | `15400,50`                   | Mayor que cero. Acepta `15.400,50` y números de Excel                     |
| Moneda         | Sí                           | `ARS`                        | `ARS` o `USD`. Tiene que ser la de la cuenta                              |
| Cuenta         | Sí                           | `Visa Banco X`               | Tiene que existir en la app                                               |
| Categoría      | No                           | `Vivienda > Servicios > Luz` | Niveles separados por `>`; hasta tres                                     |
| Descripción    | No                           | `Edesur`                     |                                                                           |
| Etiquetas      | No                           | `casa, fijo`                 | Separadas por coma                                                        |
| Nota           | No                           |                              |                                                                           |
| Cuota          | No                           | `3/6`                        | También `3 de 6`                                                          |
| Fecha de pago  | No                           | `2026-11-10`                 | Solo se usa en cuentas de tarjeta de crédito                              |
| Cuenta destino | Solo transferencias          | `MercadoPago`                | Distinta de la cuenta de origen                                           |
| Monto destino  | Solo entre monedas distintas | `100,00`                     | Lo que llega a la cuenta destino                                          |

- Los encabezados no distinguen mayúsculas ni acentos. Se aceptan `Importe` por Monto y `Detalle` o
  `Concepto` por Descripción. Las columnas que la app no conoce se ignoran y se avisa.
- CSV: separado por punto y coma, coma o tabulación (se detecta solo), en UTF-8.
- Límites: 5 MB y 2000 filas por archivo.

### Cómo funciona la importación

1. **Vista previa.** Se sube el archivo y la app muestra, fila por fila, qué entraría y qué problema
   tiene cada una. No se guarda nada.
2. Se marcan las filas que coinciden con un movimiento existente (misma fecha, monto y cuenta). Quedan
   afuera salvo que se elija incluirlas.
3. Se listan las categorías y etiquetas que el archivo menciona y no existen. Se crean solo si se acepta.
   Para cada categoría se puede elegir, en cambio, una que ya existe.
4. Se listan las cuentas que el archivo menciona y no existen. Para cada una se elige a qué cuenta
   existente corresponde; si no se elige, sus filas no se importan. Después de cada elección la app
   vuelve a revisar las filas (moneda, duplicados) antes de dejar confirmar.
5. **Confirmación.** Entran todas las filas válidas juntas, o ninguna: si una falla al guardar, no queda
   media importación.

Un resumen que un banco o una app deja bajar en Excel o CSV **no se importa por acá**: cada banco arma sus
columnas distinto. Va por **Agregar → Leer un resumen**, donde la IA lo entiende y se revisa como cualquier
documento (ver `ESPECIFICACION.md`, sección 6).

Las **cuentas no se crean solas**: hay que crearlas antes o apuntarlas a una existente, porque el archivo no dice si son tarjeta,
banco o efectivo, y eso cambia cómo se calcula la fecha de pago.

### Lo que la planilla no conserva

- Un gasto con renglones que tienen categoría se exporta como una fila por parte: primero cada renglón y al final lo que queda en la categoría del movimiento.
- No incluye borradores, proyectados, papelera, reglas, fijos, tasas de cambio, saldos iniciales ni
  períodos de tarjeta.
- La cuota se guarda como dato (`3/6`) sin vincularla a un plan.
- Los productos van en una hoja aparte del Excel, que no se importa (ver "Hoja de productos" abajo). El CSV
  no los lleva.

Para una copia exacta, usar el respaldo.

### Hoja de productos

Desde el 17/10/2026 la exportación a Excel trae una segunda hoja, **Productos**, con una fila por producto de
cada compra. Las columnas están definidas una sola vez, en `PRODUCT_COLUMNS` (`shared/src/importFormat.ts`):

| Columna      | Ejemplo        | De dónde sale                                  |
| ------------ | -------------- | ---------------------------------------------- |
| Fecha        | `2026-10-05`   | La fecha de la compra                          |
| Comercio     | `Coto`         | La descripción del movimiento                  |
| Producto     | `Leche`        | El nombre genérico                             |
| En el ticket | `LECHE ENT 1L` | El texto del renglón                           |
| Grupo        | `Lácteos`      | El grupo, en español                           |
| Cantidad     | `2`            | Vacía si el ticket no la dice                  |
| Monto        | `2400,00`      | Negativo en una devolución, como en el Consumo |
| Moneda       | `ARS`          | La del movimiento                              |

- La primera hoja no cambia: la importación lee solo la primera hoja, así que un archivo exportado se
  sigue pudiendo volver a importar. Los productos no se importan.
- El CSV queda como está: un CSV tiene una sola tabla.
- Mismo rango de fechas que la exportación de movimientos; solo movimientos confirmados.

## Respaldo completo

Un archivo JSON:

```json
{
  "app": "gastos",
  "formatVersion": 1,
  "exportedAt": "2026-10-10T18:00:00.000Z",
  "collections": {
    "accounts": [],
    "categories": [],
    "transactions": []
  }
}
```

Cada documento va en JSON extendido canónico de MongoDB, para que identificadores y fechas vuelvan
exactamente iguales.

### Restauración

1. Se comprueba que sea un respaldo de esta app y de una versión que el backend entiende.
2. En una sola transacción se reemplazan todas las colecciones y se corre el chequeo de integridad.
3. Si el respaldo tiene una referencia a algo que no incluye, se cancela todo y la base queda como estaba.
4. Después se aplican las migraciones pendientes, para que un respaldo viejo quede al día.

Restaurar **reemplaza todos los datos actuales**. La pantalla pide confirmarlo.

### Versiones

`formatVersion` sube cuando cambia la forma del archivo. Un backend no restaura un respaldo de versión
mayor a la suya. Los cambios en los datos guardados van como migraciones, que se aplican al restaurar.
