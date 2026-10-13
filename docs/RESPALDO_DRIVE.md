# Copia automática del respaldo en Google Drive

Una vez por día, cuando se usa la app, el servidor guarda el respaldo completo en tu Google Drive como
`gastos-respaldo.json`. Es siempre el mismo archivo: cada copia reemplaza a la anterior y Drive guarda las
versiones anteriores por un tiempo. La app solo puede ver y tocar los archivos que ella misma crea; el resto
de tu Drive le queda vedado.

Se configura una sola vez. Lleva unos 20 a 30 minutos. Los nombres de los menús de Google cambian cada
tanto: si alguno no coincide, buscá el más parecido.

## 1. Crear el proyecto en Google Cloud

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com) con la cuenta de Google donde
   querés guardar el respaldo.
2. Arriba, en el selector de proyectos, elegí **Proyecto nuevo**. Nombre: `Gastos`. Crear.
3. Con el proyecto `Gastos` elegido, buscá **Google Drive API** en la barra de búsqueda y tocá
   **Habilitar**.

## 2. Configurar la pantalla de permiso

Es la pantalla que te va a preguntar "¿Dejás que Gastos use tu Drive?". En el menú aparece como
**Google Auth Platform** (antes, "Pantalla de consentimiento de OAuth").

1. Tocá **Comenzar**. Nombre de la app: `Gastos`. Correo de asistencia: el tuyo.
2. Público: **Externo**. Correo de contacto: el tuyo. Aceptá y creá.
3. En **Público** (Audience), tocá **Publicar app** y confirmá, para que quede **En producción**.
   Importante: si queda "En prueba", Google corta el permiso a los 7 días y la copia deja de andar.
   Con el permiso que usa la app (`drive.file`, solo sus propios archivos) no hace falta que Google la
   verifique.

## 3. Crear la credencial

1. En **Clientes** (o **Credenciales → Crear credenciales → ID de cliente de OAuth**), creá un cliente.
2. Tipo de aplicación: **App de escritorio**. Nombre: `Gastos backup`. Crear.
3. Copiá el **ID de cliente** y el **Secreto del cliente**.
4. Agregalos en `backend/.env` (lo editás vos; no los pegues en ningún chat):

   ```
   DRIVE_CLIENT_ID=el-id-de-cliente
   DRIVE_CLIENT_SECRET=el-secreto
   ```

## 4. Dar el permiso

1. En una terminal, en la carpeta del proyecto:

   ```
   npm run drive-auth -w backend
   ```

2. Aparece un enlace. Abrilo en el navegador de la PC, elegí tu cuenta y aceptá. Puede aparecer
   "Google no verificó esta app": tocá **Avanzado → Ir a Gastos**. Es tu propia app.
3. El navegador dice "Listo" y la terminal muestra un texto largo. Ese es el `DRIVE_REFRESH_TOKEN`.
   Agregalo en `backend/.env`:

   ```
   DRIVE_REFRESH_TOKEN=el-texto-largo
   ```

Este paso se repite solo si Google rechaza el permiso más adelante (la app lo avisa).

## 5. Cargarlo en Render

1. En Render, entrá al servicio `gastos-api` → **Environment**.
2. Agregá las tres variables: `DRIVE_CLIENT_ID`, `DRIVE_CLIENT_SECRET` y `DRIVE_REFRESH_TOKEN`, con los mismos
   valores de `backend/.env`.
3. Guardá. Render reinicia el servicio solo.

## 6. Probar

1. Abrí la app → **Más → Respaldo y datos → Copia automática en Google Drive → Copiar ahora**.
2. Tiene que decir "Última copia: …" con la hora de ahora.
3. En tu Drive aparece `gastos-respaldo.json`.

## Recuperar un respaldo

1. En Drive, descargá `gastos-respaldo.json`. Para una copia de un día anterior: clic derecho →
   **Información del archivo → Administrar versiones** y descargá la que quieras.
2. En la app: **Más → Respaldo y datos → Restaurar un respaldo** y elegí ese archivo.

## Si algo falla

- La pantalla principal muestra "La copia en Google Drive no se está haciendo" cuando falló o cuando pasaron
  más de 3 días sin copia mientras se usa la app. En **Más → Respaldo y datos** dice el motivo.
- "Google rechazó el permiso": repetí el paso 4 y cambiá `DRIVE_REFRESH_TOKEN` en Render.
- Para quitarle el permiso a la app: [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  → Gastos → Quitar acceso.
