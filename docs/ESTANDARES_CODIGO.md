# Estándares de código

Estado: **aprobado el 7 de noviembre de 2026 y resumido en `AGENTS.md`. Desde el mismo día el lint hace cumplir
el tamaño, la complejidad, los módulos que no se importan y el `useAction()` en pantallas; los archivos que todavía
no cumplen están en `lint-exceptions.js` (esa lista solo se achica).**
Es lo que se exige a cualquier cambio de código, antes de empezar a implementar `LOGICA_NEGOCIO.md`.
Complementa las reglas de `AGENTS.md`; no las reemplaza.

## 1. Constantes

- Un valor con **significado de negocio** (un límite, un tipo, un estado, un plazo) va en `shared/` y se
  importa de ahí. Una lista de valores es **una sola**; el tipo se deriva de ella.
- Un valor **técnico que usa un solo archivo** (la dirección de un proveedor, un tiempo de espera) es una
  constante con nombre al principio de ese archivo, con un comentario que diga por qué vale eso.
- Un valor que usan **dos o más archivos** deja de ser local y se sube a `shared/` o a `config/`.
- Las claves de caché del frontend se definen en un solo archivo, no se repiten como listas sueltas en
  cada pantalla.
- Un valor por defecto no se escribe dos veces. Si el script y la configuración necesitan el mismo
  modelo de IA, lo toman de una constante.
- Prohibido: un número con significado escrito en medio del código, una dirección web sin nombre, un
  texto de usuario fuera de `es.ts`, y **buscar algo de una lista por su nombre** (se usa un id o un rol).

## 2. Tamaño y responsabilidad

- Un archivo hace **una cosa**. Si para describirlo hace falta una "y", son dos archivos.
- Límites propuestos (a ajustar al activarlos): archivo hasta **400 líneas**, función hasta **80**,
  complejidad hasta **15**, hasta **4 parámetros** (con más, un objeto con nombre), anidado hasta
  **4 niveles**.
- Un repositorio se divide por **propósito** (escribir, listar, reportes, exportar), no se vuelve la caja
  donde cae toda consulta nueva.
- Una pantalla se divide en: la pantalla, su estado y validación, y sus partes visuales.
- No se parte un archivo por partirlo: se parte el que el cambio toca.

## 3. Sin archivos barril

- Un `index.ts` que solo reexporta **no se escribe**. Se importa desde el archivo que define lo que se
  necesita.
- Un módulo no importa a otro. Solo la raíz de composición (`composition.ts`, `wiring.ts`,
  `container.ts`, `app.ts`) importa archivos de varios módulos.
- Excepción en estudio: la entrada pública del paquete `shared`.
- Un archivo que lista cosas para registrarlas (como las migraciones) no es un barril.

## 4. Dependencias

- Los servicios son funciones que **reciben lo que necesitan** (`createXService(deps)`). Solo la raíz de
  composición construye y conecta.
- Se inyecta lo que **varía o necesita un reemplazo en las pruebas**: el acceso a datos, la red, el
  reloj, lo aleatorio, los archivos, los proveedores externos.
- **No se inyecta** lo que es una función pura o una constante: sería ceremonia sin beneficio.
- Sin librería de inyección, sin clases creadas solo para inyectar.
- Los proveedores externos van detrás de una interfaz chica, y el código nunca llama a `fetch` ni a
  `process.env` por su cuenta.
- El reloj se inyecta en los servicios cuya lógica depende de la hora.

## 5. Pruebas

- Cada regla nueva tiene prueba, como pide `AGENTS.md`.
- El backend en memoria se organiza **por módulo**, para que agregar un repositorio no haga crecer un
  único archivo.
- Para los informes: una prueba que compara el total antes y después de cada cambio.

## 6. Cómo se hace cumplir

| Regla | Quién la cumple |
| ----- | --------------- |
| Capas, módulos que no se importan, `shared` sin código de plataforma | Lint (ya existe) |
| Textos en `es.ts`, `'es-AR'` y `'ARS'` | Lint (ya existe) |
| Números sueltos, código copiado, exports sin uso | `npm run audit:code` (ya existe; los tiempos y los códigos HTTP ya no están permitidos sueltos: viven en `dates.ts` y `status.ts`) |
| Tamaño de archivo (400 líneas), de función (80), complejidad (15), parámetros (4), anidado (4) | Lint (ya existe): reglas que trae ESLint, con la **lista temporal de excepciones** `lint-exceptions.js` para los archivos de hoy que no cumplen, que se achica a medida que se parten. Las líneas en blanco y los comentarios no cuentan |
| `useAction()` en vez de `try/catch` propio en pantallas | Lint (ya existe, en `features/**/*.tsx`). Un `try/catch` que no guarda nada (leer el almacenamiento del navegador, validar un archivo) se deja con `eslint-disable` y el motivo |
| Buscar una categoría, comercio o producto por su nombre | Lint (regla nueva) |
| Archivos barril de los módulos | Ya no existen, y el lint prohíbe que un módulo importe a otro. `shared/src/index.ts` queda como decisión abierta |

## 7. Alcance

Se aplica a lo que se toca. Un cambio no reorganiza archivos que no necesita tocar. Lo que quede fuera
se anota en `AUDITORIA.md`.
