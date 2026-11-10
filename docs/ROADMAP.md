# Hoja de ruta

Cada etapa termina en algo que funciona. Si una se complica, lo anterior ya sirve.

## Estado de la base

| Qué                                                          | Estado                                                                                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` (tipos, lint, auditoría de código y pruebas) | Pasa en la PC del usuario el 17/10/2026 (210 pruebas)                                                                                                                                   |
| Usuarios y datos por usuario contra MongoDB Atlas            | Funciona en Render desde el 13/10/2026; la migración de dueños corrió sin errores                                                                                                       |
| Etapa 4, resúmenes de cuenta y saldos contra MongoDB Atlas   | **Sin probar.** Escritos el 17/10/2026 y probados en memoria y por HTTP; corren contra Atlas por primera vez con el push de `d48d0e8` y `2743d8a`                                       |
| Pantallas en un navegador                                    | Etapas 1 a 3 recorridas el 13/10/2026 y lo del 17/10/2026 (usuarios, informes, tasas, fijos, resumen de cuenta, saldos) el mismo día, con la demo, tamaño celular. Sin mirar el aspecto |
| Lectura de resúmenes                                         | De tarjeta (12/10/2026) y de cuenta (17/10/2026) sin ningún resumen real a mano: el tapado y las instrucciones a la IA se ajustan con el primero verdadero                              |
| Compilación de backend y frontend (`npm run build`)          | Render compiló los dos el 11/10/2026; se repite en cada push                                                                                                                            |
| Etapa 1 corriendo contra MongoDB Atlas                       | Dada por cerrada por el usuario                                                                                                                                                         |
| Lectura real con Gemini                                      | Usada por el usuario con tickets y capturas de MercadoPago. La clasificación de productos (instrucciones versión 5) dio bien en el primer uso real, el 11/10/2026                       |
| Consumo por producto contra MongoDB y Gemini reales          | Funciona en Render con datos reales desde el 11/10/2026                                                                                                                                 |
| `render.yaml`                                                | Desplegado en Render el 11/10/2026: backend y sitio en línea. Atlas necesita `0.0.0.0/0` en Network Access                                                                              |

Las versiones de `package.json` se escribieron sin acceso al registro de npm; la instalación funcionó.

## Dónde quedamos (17/10/2026)

Para retomar. Se borra o se reescribe al empezar la próxima sesión.

**Desde el 4/11/2026** se pensó la lógica nueva y no se tocó código: ver "Etapa 5". `npm run check` pasa el
7/11/2026 con 217 pruebas.

**Subido (push del 17/10/2026):** todo hasta `f72812a`: usuarios con límite de IA, la etapa 4, resúmenes de
cuenta, saldos, la hoja "Productos" del Excel, los productos corregidos que se recuerdan, Más → Lo que la app
recuerda y el informe por cuenta con el saldo de cada una. Falta confirmar en el celular que Render lo publicó.

**Hecho después (commit `ccc3819`, ya en `origin/main`):** el estilo nuevo en toda la app (fondo lavanda, tarjetas blancas, violeta,
íconos, modo oscuro revisado). Ver `DECISIONES.md`, "Estilo nuevo". No cambia datos ni rutas: no trae
migraciones. Suma la dependencia `lucide-react` al frontend. 217 pruebas.

**Para subirlo:**

1. Ya está en `origin/main`; confirmar que Render lo publicó. En Render no hace falta ninguna variable nueva: `AI_DAILY_READINGS` es opcional (30 si no está;
   `render.yaml` ya la trae).
2. Al arrancar corren solas las migraciones nuevas: `2026-10-17-recurring-merchant`,
   `2026-10-17-account-opening-balance`, `2026-10-17-recurring-name-index` (rehace un índice) y
   `2026-10-17-user-ai-limit`. Si el despliegue de `c611087` salió bien, ya corrieron; lo nuevo no trae ninguna.
3. Después: Más → Usuarios muestra "Lecturas con IA hoy"; Informes tiene seis pestañas; Más → Cuentas muestra
   el saldo de cada cuenta; Agregar → Leer un resumen ofrece "Banco o app".

**Pendiente del usuario (no es código):**

- Cargar `VITE_CONTACT_EMAIL` en el sitio de Render y poner las direcciones de `/privacidad` y
  `/condiciones` en Google Cloud.
- Configurar Google una vez con `docs/RESPALDO_DRIVE.md` y probar "Copiar ahora" con un Drive de verdad.
- Probar resúmenes reales: uno de tarjeta (qué quedó sin tapar, si la suma da igual al total, si los cargos
  salen en "Cargos financieros") y uno de MercadoPago y uno de un banco, en Excel o CSV si se puede (si las
  transferencias entre cuentas propias salen como transferencia y si el saldo final coincide).
- Cargar el saldo inicial de cada cuenta (Más → Cuentas → Editar), o usar el que ofrece el primer resumen.

**Lo próximo que se puede programar:**

- Separar Movimientos por día ("Hoy", "Ayer", "15 de octubre"), la única mejora visual propuesta que falta.

- Ajustar el tapado y las instrucciones con el primer resumen real, de tarjeta y de cuenta.
- Comparar el precio de un mismo producto a lo largo del tiempo.
- Uso sin conexión: está en la segunda versión; el usuario decidió no adelantarlo por ahora.

**Cómo se trabaja (recordatorio para el asistente):**

- Leer `AGENTS.md`, `docs/ARQUITECTURA.md` y `docs/ESPECIFICACION.md` antes de programar.
- Escribir los archivos directo en la carpeta del usuario; no mandar zips.
- Antes de usar una librería nueva, leer sus tipos instalados en la PC del usuario, no escribirla de memoria.
- Antes de entregar: formato, `npm run audit:code`, pruebas y tipos, y decir qué se corrió.
- Un problema que se encuentra se arregla en el momento, no se anota como deuda sin avisar.
- No leer `backend/.env`.
- Antes de entregar, repasar lo propio línea por línea: cada línea con un motivo, sin atajos de tipos
  (`as never`, `!` que no hacen falta), sin líneas de prueba que no prueban nada. Un cambio en lo guardado
  lleva migración, también en `users`; un índice que cambia, una que lo rehaga.
- Al terminar, anotar en "Errores encontrados y corregidos" lo que salió mal.

## Errores encontrados y corregidos (17/10/2026)

Para que quede a la vista qué salió mal y cómo se arregló. Todos tienen prueba salvo los de texto.

En la revisión del usuario de `d48d0e8` (corregidos en `2743d8a`):

1. **El límite de IA se controlaba después de borrar el pendiente que una subida reemplaza.** Sin cupo, se
   perdía el documento que esperaba revisión. Ahora se controla antes de tocar nada.
2. **Un fijo con el mismo nombre en otra moneda daba "ya existe"** (Netflix en pesos y en dólares). El
   nombre es único por tipo y moneda; la migración `2026-10-17-recurring-name-index` rehace el índice, porque
   crear el nuevo no borra el viejo.
3. **El promedio de Meses redondeaba dinero en la pantalla.** Ahora usa `averageCents` de `money.ts`.
4. **`AI_DAILY_READINGS` no figuraba en `.env.example` ni en `render.yaml`.**
5. **El límite de IA dependía de una variable asignada después del armado** (`container!`). Ahora es una pieza
   propia, `aiAllowance`, que se arma primero.

En el repaso propio (corregidos en `2743d8a`):

6. El chequeo de "es un PDF" tenía el punto sin escapar: un archivo llamado `informepdf` pasaba por PDF.
7. Al lector de Excel se le pasaba un nombre de archivo inventado para que no lo tomara por CSV. Ahora hay
   una función propia, `readWorkbook`.
8. El aviso "demasiado texto" hablaba de "PDF" también para un Excel o un CSV.
9. Los campos nuevos de usuarios (límite de IA) no tenían migración: la regla del proyecto la pide. Se agregó
   `2026-10-17-user-ai-limit`.
10. Dos pruebas tenían líneas sin sentido (una comparación que siempre daba lo mismo, una variable usada solo
    para que el compilador no se quejara) y otra escondía sus tipos con `as never`.
11. Un filtro de transferencias quedó duplicado en las sugerencias de fijos; se reemplazó por un tipo que lo
    dice una sola vez.

Al recorrer la demo, antes del commit:

12. La revisión de un resumen de cuenta mostraba "Fechas del resumen", que es solo de tarjetas.
13. Con "todo en dólares" y sin tasas, un informe decía "no hay egresos" además del aviso de que faltaban tasas.
14. "Se taparon 1 dato" y "Se taparon 0 datos": textos corregidos.
15. Se colaron caracteres invisibles (una marca de orden de bytes) en el código fuente; el lint los marcó y se
    cambiaron por su forma escrita.

En el repaso visual (17/10/2026, demo en tamaño celular, modo claro y oscuro):

16. **Cuentas:** los tres botones al costado dejaban la información en una columna finita ("Mercad / oPago", el
    saldo en ocho renglones). Lo empeoró la línea del saldo agregada ese día. Ahora los botones van debajo.
17. **Bancos y tarjetas:** lo mismo, peor, desde antes: "Banc / o / Ciud / ad". Mismo arreglo. También en
    Usuarios.
18. **Los botones "Borrar" y "Desactivar" se veían verdes, no rojos**, en 13 lugares: el color rojo agregado
    encima perdía contra el verde del botón. Ahora hay una variante propia, `quietDanger`.
19. **El ámbar de "atención" como texto** ("Cambió mucho", "Esperando a la IA") tenía contraste 3,1 en modo claro;
    la norma pide 4,5. Pasó de `#b98a0c` a `#8a6508` (5,3).

## Mejoras visuales propuestas (17/10/2026)

Del mismo repaso. No son errores: son cambios de diseño que conviene decidir antes de hacer. Con el estilo
nuevo (ver `DECISIONES.md`, "Estilo nuevo") quedaron hechas todas menos la 5, que sigue abierta.

1. **Bordes de los campos para escribir muy suaves** (contraste 1,3; la norma pide 3 para el borde de un control).
   Al sol, en el celular, cuesta ver dónde se escribe. Un borde más oscuro solo para los campos.
2. **Barra de abajo sin íconos**, y la pestaña activa se distingue solo por el color. Ícono más una marca debajo
   de la activa.
3. **Dos selectores de mes distintos**: en Movimientos es una barra con las flechas adentro; en Informes, dos
   botones cuadrados. Usar uno solo.
4. **La categoría se corta con "…"** en Inicio y Movimientos, porque va después de la fecha y la cuenta. Ponerla
   primero, o en su propio renglón.
5. **Movimientos sin separación por día**: encabezados "Hoy", "Ayer", "15 de octubre", con el total del día.
6. **Más tiene 13 opciones seguidas**: agruparlas (Mis cuentas, Configuración, Datos, Mi usuario).
7. **Informes:** el selector "Mostrar" ocupa lugar en todas las pestañas; un control chico al lado del mes
   alcanza. Y los egresos, que es lo que más se mira, podrían ir antes que los ingresos.
8. **Agregar:** "Elegir de la galería" ocupa dos renglones al lado de "Sacar foto"; los dos botones quedan de
   distinto alto.

## Resúmenes de cuenta y saldos (17/10/2026)

Hecho, probado en memoria y por HTTP y recorrido en la demo, sin probar con un resumen real:

- Resumen de cuenta (`account_statement`): PDF, Excel o CSV, reconocido por su contenido; tapado también de
  CBU, CVU y alias; ingresos, egresos y transferencias con su dirección (instrucciones versión 9).
- Lo ya cargado sale como repetido y sin marcar: así se resuelve la misma compra por dos vías.
- Saldo de cada cuenta (saldo inicial más los movimientos confirmados desde ese día) y control contra el
  saldo final del resumen, con la opción de usar su saldo inicial.

Falta: un Excel viejo (`.xls`) se rechaza con aviso; leerlo pediría otra librería.

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
- Medir memoria y tiempo en Render gratuito.

### Consumo por producto (hecho)

Los productos se cargan, editan y borran a mano en cualquier movimiento, y se corrigen en la revisión de
un ticket. La IA devuelve por producto un nombre genérico ("Yerba"), un grupo de una lista fija y la cantidad
(instrucciones versión 5). La pestaña Informes muestra el consumo del mes por grupo y producto, y un
buscador de compras por producto. Los tickets confirmados antes de la versión 5 aparecen en "Sin clasificar"; se les puede
poner grupo editando el movimiento.

Falta:

- Comparar el precio de un mismo producto a lo largo del tiempo.

Hecho (17/10/2026): recordar el producto y el grupo corregidos de un renglón para los próximos tickets
(`productRules`), la hoja "Productos" en el Excel exportado y la pantalla Más → Lo que la app recuerda (reglas de
categoría, productos corregidos y documentos confirmados).

## Deuda conocida

Revisión del 11/10/2026. No bloquea el uso; conviene no perderla de vista.

Desde el 12/10/2026 `npm run check` incluye una auditoría (`scripts/audit.mjs`) que rechaza código
copiado, exports sin uso y números sueltos, y el lint rechaza textos escritos en las pantallas. Lo que
sigue en esta lista es lo que esos controles no cubren.

- **Las pantallas no tienen pruebas automáticas.** Las reglas del backend y sus rutas HTTP sí. Las pantallas
  se recorrieron a mano con `npm run demo` el 13/10/2026 (etapas 1 a 3) y el 17/10/2026 (lo nuevo): flujo y
  textos, no el aspecto.
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
- **Una prueba tarda 5 segundos** (`statement.test.ts`, el PDF con demasiado texto): no se midió por qué. Ya
  tardaba eso antes del 17/10/2026; no afecta a la app.

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
- La misma compra cargada por dos vías (ticket y resumen): resuelta el 17/10/2026 sin unir. El renglón del
  resumen con la misma fecha, monto y moneda que algo ya cargado sale como repetido y sin marcar.

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

## Etapa 5: lógica nueva y base de calidad (acordada el 7/11/2026)

**Hecho hasta ahora:** la confirmación de documentos ya no puede correr dos veces ni chocar con un borrado
(`markConfirmed` toma el documento dentro de la transacción solo si sigue "listo"; borrar lo vuelve a leer
adentro). Tiene tres pruebas nuevas. Del grupo B de `AUDITORIA.md` están corregidos 3, 7, 8, 10 y 11. También se cerraron
los huecos F1, F2 y F4 del manejo de errores (sección 9.F). Falta el resto del paso 1: errores 5 y 9, hueco F3
(pantallas sin `useAction`), desvíos, barriles y lint. La auditoría de cumplimiento del 7/11/2026
(`AUDITORIA.md`, sección 11) agrega los desvíos D1 a D13 a ese paso. Ya están corregidos D1, D3, D4, D5, D6, D7, D9, D13 y D14; D10 resultó un falso positivo. **El frente de calidad (paso 1) está cerrado.** D8 también está corregido: la categoría tiene `role` (`financial_charges`), con su migración. Quedan el error #5 (probar el restore en Atlas) y D12 (mover el client_secret). El lint ya exige tamaño, complejidad y useAction, con `lint-exceptions.js` como lista temporal.

**Paso 2, en curso (10/11/2026).** Hecho: el rol de categoría (`financial_charges`) con su migración, y los módulos
`merchants` y `products` (listas con categoría y textos conocidos dentro de cada elemento, API en `API.md`,
puertos de respaldo, pruebas). Falta la migración que los llena desde lo ya cargado y convierte los 16 grupos en
categorías, con el respaldo a Drive antes del primer arranque. Todavía no hay pantallas ni movimientos que los usen.

**Lo demás, sin implementar.** Lo acordado está en `LOGICA_NEGOCIO.md`, lo medido en `AUDITORIA.md` y el criterio de
código en `ESTANDARES_CODIGO.md`. Orden previsto, cada paso con pruebas y su commit:

1. **Base de calidad:** corregir primero la confirmación de documentos (doble confirmación y confirmar contra
   borrar: `AUDITORIA.md`, sección 9), luego los demás errores de esa sección, los tres desvíos, quitar los archivos barril de los módulos,
   activar las reglas nuevas del lint con su lista temporal de excepciones y ajustar los números permitidos.
2. Listas nuevas (comercios, productos, textos conocidos, rol de categoría) y su migración, sin cambiar todavía
   las pantallas. Antes del primer arranque, un respaldo a Drive.
3. Movimientos con ids, sin descripción ni divisiones; migración de ambas. Se parten al tocarlos los archivos
   grandes que cambian.
4. Informes por renglón (categoría, consumo, comercios).
5. Tarjetas: estado del resumen, recordatorio dentro de la app y control con el resumen siguiente.
6. Aviso de movimiento parecido al cargar a mano.
7. PDF de ticket o factura.
8. Recién entonces, el diseño de los ingresos.

El recordatorio de resumen vencido (paso 5) se adelanta de la segunda versión porque el usuario lo pidió.

## Segunda versión

Presupuestos por categoría, notificaciones de vencimiento, compartir hacia la app desde Android, uso
sin conexión, conservar comprobantes de forma permanente. Los saldos por cuenta se adelantaron el 17/10/2026.
