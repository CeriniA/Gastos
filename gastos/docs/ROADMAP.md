# Hoja de ruta

Cada etapa termina en algo que funciona. Si una se complica, lo anterior ya sirve.

## Estado de la base

Lo que hay en este repositorio y cuánto se pudo comprobar. La base se escribió en un entorno **sin
acceso al registro de npm**, así que no se pudieron instalar las dependencias.

| Qué                                                                        | Estado                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Paquete `shared`                                                           | Tipos verificados con el compilador; 27 pruebas pasando                         |
| Reglas de negocio del backend (services)                                   | 35 pruebas pasando, sobre repositorios en memoria                               |
| Importación y exportación en CSV                                           | Probadas de punta a punta, incluido reimportar lo exportado                     |
| Coherencia interna de tipos (backend y frontend)                           | Verificada con el compilador, tratando las librerías externas como desconocidas |
| Sintaxis e imports de backend y frontend                                   | Verificados empaquetando con esbuild                                            |
| Tipos contra Express, Mongoose, React, TanStack Query, Vite                | **Sin verificar**                                                               |
| Consultas reales a MongoDB (repositories, respaldo, chequeo de integridad) | **Sin ejecutar**                                                                |
| Rutas HTTP, login, subida de archivos                                      | **Sin ejecutar**                                                                |
| Lectura y escritura de Excel (.xlsx)                                       | **Sin ejecutar**                                                                |
| Interfaz en el navegador y como app instalada                              | **Sin ver**                                                                     |
| Lint (reglas de arquitectura)                                              | **Sin ejecutar**                                                                |
| Versiones de `package.json`                                                | Escritas de memoria; puede haber que ajustar alguna                             |
| `render.yaml`                                                              | Sin probar contra Render                                                        |

### Primer paso al retomar

1. `npm install` y subir el `package-lock.json` que genera.
2. `npm run check` y `npm run build`. Corregir lo que marque: se esperan ajustes de tipos en los
   repositories (Mongoose) y quizá en algún componente, no cambios de diseño.
3. Configurar `backend/.env` con una base `gastos-dev`, correr `npm run seed -w backend` y levantar
   backend y frontend.
4. Recorrer a mano: login, crear cuenta y categoría, cargar un movimiento, ver el balance, exportar a
   Excel, importar ese mismo archivo, descargar un respaldo y restaurarlo, chequeo de integridad.
5. Agregar pruebas de integración contra la base de pruebas para lo que hoy está sin ejecutar.

## Etapa 1: base usable (este repositorio)

Hecho:

- Estructura, capas, esquemas compartidos, errores, configuración, migraciones.
- Login de un usuario.
- Cuentas, categorías en árbol (crear, renombrar, mover, archivar, unir, borrar) y etiquetas.
- Movimientos manuales: alta, edición, papelera y restauración; transferencias y divisiones en la API.
- Balance mensual por moneda según fecha de pago.
- Respaldo completo, restauración y chequeo de integridad.
- Exportación a Excel y CSV; importación con vista previa.
- App instalable; aviso de servidor despertando.
- Datos iniciales (categorías y cuentas de arranque).

Falta para cerrar la etapa:

- La verificación de la sección anterior.
- Pantallas que la API ya soporta y la interfaz todavía no: renombrar, mover y unir categorías;
  renombrar y borrar etiquetas; dividir un movimiento entre categorías; papelera; filtros y buscador en
  Movimientos; paginado más allá de 200 por mes.
- En la importación: elegir a qué cuenta o categoría existente corresponde una desconocida.

## Etapa 2: lectura con IA

- Probar primero un script con cinco o seis documentos reales (ticket, captura de MercadoPago, captura
  de MercadoLibre) y ajustar el contrato de `shared/src/schemas/extraction.ts`.
- Proveedor Gemini detrás de `AiExtractor`: salida JSON validada, reintentos ante límite, versión de
  instrucciones guardada en cada documento.
- Módulo `documents`: subida (cámara y galería), huella contra duplicados, compresión en el navegador,
  procesamiento en segundo plano, reanudación de los que quedaron a medias al arrancar.
- Bandeja de Pendientes y pantalla de revisión con la imagen a la vista; borrado de la imagen al
  confirmar o descartar.
- Reglas comercio → categoría (`category-rules`).
- Medir memoria y tiempo en Render gratuito.

## Etapa 3: tarjetas, cuotas y duplicados

- Definir cómo se guarda una devolución.
- Resúmenes en PDF: movimientos, cierre, vencimiento, total; control de la suma contra el total.
- Períodos de tarjeta (`card-periods`) y fecha de pago calculada desde el cierre (`resolvePaymentDate`
  ya recibe ese dato).
- Planes de cuotas (`installment-plans`): un movimiento por mes, proyectados y confirmados.
- Detección de duplicados entre vías y propuesta de unión.
- Pantalla de Tarjetas.

## Etapa 4: informes, fijos y monedas

- Informes por categoría (con el árbol), por cuenta, evolución mensual, comercios.
- Tasas de cambio manuales (`exchange-rates`) y vista consolidada.
- Movimientos fijos (`recurrings`): sugerencia, marca manual, proyección y avisos.
- Proyección de cuotas y fijos.

## Segunda versión

Presupuestos por categoría, notificaciones de vencimiento, compartir hacia la app desde Android, uso
sin conexión, saldos por cuenta, conservar comprobantes de forma permanente.
