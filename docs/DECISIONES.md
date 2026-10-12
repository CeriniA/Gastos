# Decisiones

Cada decisión tomada en el diseño, con su motivo. Una decisión nueva o que cambia se anota acá.

## Producto

| Decisión                                                        | Motivo                                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| App personal, un solo usuario                                   | Es de uso propio; simplifica acceso y datos                                                              |
| Ingresos, egresos y transferencias                              | Con ingresos se ve el resultado del mes; sin transferencias, pagar la tarjeta se contaría dos veces      |
| La app propone, el usuario decide                               | En un registro de plata, un dato mal leído que entra solo es peor que un paso de confirmación            |
| Pesos y dólares, cada movimiento en su moneda                   | Convertir al guardar deforma los datos con cada cambio de cotización                                     |
| Tasa de cambio manual, por fecha de inicio                      | En Argentina hay varias cotizaciones; el usuario elige la suya. Por fecha, para no alterar meses pasados |
| Cuotas como un movimiento por mes                               | Cada mes refleja lo que se paga ese mes                                                                  |
| Balance mensual por fecha de pago                               | Coherente con las cuotas: muestra cuándo sale la plata. La fecha de consumo queda para buscar            |
| Cierre y vencimiento leídos del resumen, editables              | El resumen ya los trae; a mano por si la lectura falla                                                   |
| Movimientos fijos: la app sugiere, el usuario marca             | Regla general del producto                                                                               |
| Categorías en árbol de hasta 3 niveles, armadas sobre la marcha | Más niveles hacen lenta la carga y empeoran las sugerencias; el tope es una constante                    |
| Etiquetas libres desde el inicio                                | Agrupan gastos que cruzan categorías (un viaje, un arreglo)                                              |
| Presupuestos en la segunda versión                              | Solo leen datos existentes; se agregan como módulo nuevo sin tocar nada                                  |
| Sin historial inicial                                           | El usuario arranca de cero; el formato de importación queda definido igual                               |

## Carga y documentos

| Decisión                                            | Motivo                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Cámara y galería como dos opciones                  | Ticket en la mano contra captura ya guardada                                                |
| Subida sin espera, con bandeja de Pendientes        | Permite cargar varios seguidos; un PDF largo tarda                                          |
| Estado del documento en la base, sin colas ni caché | Sobrevive a reinicios del servidor y funciona entre dispositivos                            |
| Revisión con la imagen a la vista                   | Corregir un monto sin ver el ticket obliga a ir y volver                                    |
| La imagen se borra al confirmar o descartar         | Pedido del usuario: no conservar comprobantes. Solo existe mientras hace falta para revisar |
| Compartir hacia la app: segunda versión             | Es un atajo; con cámara y galería la app está completa                                      |

## Tecnología

| Decisión                                        | Motivo                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| React + Vite + Tailwind                         | Liviano, sitio estático en Render, bueno en celular                                                     |
| App instalable (PWA)                            | Ícono, pantalla completa y apertura inmediata aunque el servidor duerma, sin tiendas                    |
| Node + Express                                  | Un solo lenguaje en todo el proyecto                                                                    |
| MongoDB Atlas M0                                | No se pausa por inactividad (Supabase gratuito sí) y el Postgres gratuito de Render vence a los 30 días |
| Gemini Flash como lector                        | Tiene plan gratuito; el usuario ya comprobó que lee bien sus documentos                                 |
| La IA corre fuera de Render                     | El plan gratuito da 512 MB y 0,1 de CPU: no alcanza para un modelo de visión                            |
| IA detrás de una interfaz                       | Los planes gratuitos cambian; cambiar de proveedor tiene que ser configuración                          |
| TypeScript estricto                             | Los errores de datos aparecen al compilar; importa más porque el usuario no revisa el código            |
| Código en inglés, pantalla en español           | Mezclar genera nombres inconsistentes; todo en español es imposible porque las librerías son en inglés  |
| Un usuario y contraseña en variables de entorno | Suficiente para uso personal; evita una colección de usuarios                                           |
| Token en cabecera, no cookies                   | Frontend y backend están en direcciones distintas de Render                                             |
| Zod 3                                           | Versión estable con la que se probó `shared`                                                            |

## Arquitectura y datos

| Decisión                                                              | Motivo                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Módulos por funcionalidad, con capas adentro                          | Agregar una función es agregar una carpeta                                                     |
| Módulos conectados en `wiring.ts` por funciones                       | Evita dependencias fuertes y ciclos                                                            |
| Los services reciben `runInTransaction` en vez de importar la base    | Se prueban completos en memoria, sin MongoDB                                                   |
| Reglas de arquitectura en el lint                                     | Una regla que nadie controla se rompe                                                          |
| Esquemas, tipos y constantes en `shared`                              | Única fuente de la verdad entre frontend y backend                                             |
| Dinero en centavos enteros                                            | Los decimales acumulan errores de redondeo                                                     |
| Fechas como texto `YYYY-MM-DD`                                        | Un gasto del 31 a la noche no cae en el mes siguiente por la zona horaria                      |
| Ítems y divisiones dentro del movimiento                              | No existen sin él; no pueden quedar huérfanos                                                  |
| Integridad en el backend: verificación, transacciones, índices únicos | MongoDB no tiene claves foráneas                                                               |
| Archivar en vez de borrar lo que tiene historia                       | Los informes viejos no se rompen                                                               |
| Papelera de 30 días para movimientos                                  | Un borrado por error se recupera                                                               |
| Puertos de colección                                                  | Respaldo e integridad cubren los módulos nuevos sin código adicional                           |
| Respaldo en JSON extendido, restauración todo o nada                  | Es la única copia de seguridad en un plan gratuito; no puede dejar la base a medias            |
| Exportación e importación con un mismo formato                        | Lo que la app exporta se puede volver a importar                                               |
| Validación con `parse()` en el controller, no en un middleware        | En Express 5 la consulta es de solo lectura; así los datos validados quedan tipados sin trucos |
| Pruebas con el ejecutor de Node sobre un backend en memoria           | Sin dependencias extra; corren sin base de datos ni red                                        |
| Modelos de etapas futuras ya creados                                  | El formato del respaldo queda estable desde el principio                                       |

## Lectura con IA (etapa 2)

| Decisión                                                                                 | Motivo                                                                                                    |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Lo leído vive en el documento hasta que se confirma; no se crean movimientos en borrador | Nada sin revisar puede colarse en un informe, y descartar no deja restos                                  |
| Gemini por HTTPS, sin su librería                                                        | Una dependencia menos en 512 MB, y el proveedor se prueba con una red simulada                            |
| El formato de la respuesta se pide en las instrucciones y se valida en el código         | Las opciones de formato de la API cambiaron de nombre entre versiones; esto funciona con cualquiera       |
| Montos pedidos al modelo como texto decimal y convertidos a centavos en el código        | Evita errores de multiplicación del modelo; el único conversor sigue siendo `money.ts`                    |
| Lo que no se puede leer queda vacío y marcado como dudoso                                | Un dato inventado es peor que un campo para completar                                                     |
| Modelo configurable con `GEMINI_MODEL`                                                   | Los planes gratuitos y los modelos cambian seguido                                                        |
| Un documento a la vez                                                                    | Cuida el cupo gratuito y la memoria del servidor                                                          |
| Si la lectura falla, el documento queda con error y se reintenta a mano                  | El proveedor ya reintenta solo ante límite; un bucle automático gastaría el cupo                          |
| Hasta 10 imágenes por documento                                                          | Un ticket largo no entra en una foto                                                                      |
| Un documento descartado se borra entero                                                  | Así se puede volver a subir el mismo archivo                                                              |
| Un documento confirmado se conserva sin imágenes                                         | Su huella impide cargar dos veces el mismo comprobante                                                    |
| La regla del comercio gana sobre la sugerencia de la IA                                  | Es una decisión que el usuario ya tomó                                                                    |
| Los repetidos los detecta la app, no la IA                                               | La IA solo ve las fotos que recibe; la app compara fecha, monto y moneda contra lo ya cargado y es exacta |
| Un movimiento que parece repetido viene sin marcar, con aviso                            | La app propone y el usuario decide; dos compras iguales el mismo día existen                              |
| Las reglas siguen a la categoría al unirla y se borran con ella                          | Son preferencias, no historia                                                                             |

## Otras monedas y productos

| Decisión                                                                                                                 | Motivo                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un comprobante en otra moneda (reales) se guarda en la moneda de la cuenta, con el monto original y el cambio anotados   | La plata sale de una cuenta en pesos: ese es el movimiento real. El ticket en reales queda como referencia                                             |
| La app propone un cambio y el usuario lo confirma o corrige                                                              | Regla general del producto. Propone, en este orden: el que el usuario ya usó ese mismo día, la cotización pública de referencia, o el último que usó   |
| Cotización de referencia de exchangerate-api.com, sin clave                                                              | Cubre cualquier par de monedas y es gratuita. Es de mercado: lo que cobra un medio de pago puede diferir, por eso no se aplica sola                    |
| A Gemini no se le pide el cambio                                                                                         | No conoce cotizaciones actuales y daría un número inventado                                                                                            |
| Se guarda el cambio que resulta de dividir el monto final por el original                                                | Si el usuario corrige el total a mano, el cambio anotado sigue siendo verdadero                                                                        |
| Las cuentas siguen siendo solo en pesos o dólares                                                                        | Reales no es una moneda en la que el usuario tenga cuentas                                                                                             |
| Los productos de un ticket se guardan en la moneda del movimiento                                                        | Un solo criterio para sumar consumo, venga de donde venga el ticket                                                                                    |
| Cada producto guarda el texto del ticket, un nombre genérico y un grupo de una lista fija                                | El texto del ticket cambia de un comercio a otro; el nombre genérico permite sumar "leche" compre donde compre, y la lista fija evita grupos repetidos |
| El consumo se calcula al consultarlo, a partir de los movimientos                                                        | Única fuente de la verdad: si se borra o corrige un movimiento, el informe cambia solo                                                                 |
| El consumo nunca suma monedas distintas                                                                                  | Igual que el balance                                                                                                                                   |
| Borrar del todo solo se puede desde la papelera                                                                          | Dos pasos para lo que no tiene vuelta atrás; un movimiento vivo nunca se borra de un toque                                                             |
| En la importación, apuntar una cuenta o categoría a una existente reescribe las filas y las vuelve a revisar el servidor | El servidor sigue siendo el único que decide qué fila es válida; no hay una segunda copia de las reglas en la pantalla                                 |
| El cambio guardado es siempre monto ÷ original, calculado en el backend                                                  | Una sola regla en un solo lugar: no puede quedar un cambio que no coincide con los montos, se edite lo que se edite                                    |
| Los documentos sin revisar vencen a los 30 días                                                                          | Las imágenes ocupan lugar en una base de 512 MB y un pendiente olvidado no le sirve a nadie                                                            |
| "Cerrar sesión en todos lados" guarda un momento de corte; no hay lista de sesiones                                      | Con un solo usuario alcanza: toda sesión anterior al corte deja de valer                                                                               |
| La colección `authState` no entra en el respaldo                                                                         | Es estado de seguridad, no datos del usuario: restaurar un respaldo viejo no debe revivir sesiones cerradas                                            |

## Abiertas

| Tema                                                           | Cuándo se define               |
| -------------------------------------------------------------- | ------------------------------ |
| Cómo guardar una devolución (hoy el monto es siempre positivo) | Al empezar la etapa 3          |
| Contrato exacto de la IA por tipo de documento                 | Etapa 2, con documentos reales |
| Margen de días para considerar duplicada una compra            | Etapa 3                        |
| Qué cotización usar como referencia                            | La carga el usuario a mano     |
