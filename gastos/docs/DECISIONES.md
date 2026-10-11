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

## Abiertas

| Tema                                                           | Cuándo se define               |
| -------------------------------------------------------------- | ------------------------------ |
| Cómo guardar una devolución (hoy el monto es siempre positivo) | Al empezar la etapa 3          |
| Contrato exacto de la IA por tipo de documento                 | Etapa 2, con documentos reales |
| Margen de días para considerar duplicada una compra            | Etapa 3                        |
| Qué cotización usar como referencia                            | La carga el usuario a mano     |
