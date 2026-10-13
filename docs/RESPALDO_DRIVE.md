# Copia automática del respaldo en Google Drive

Una vez por día, cuando se usa la app, el servidor guarda el respaldo completo de cada usuario en **su
propio** Google Drive como `gastos-respaldo.json`. Es siempre el mismo archivo: cada copia reemplaza a la
anterior y Drive guarda las versiones anteriores por un tiempo. La app solo puede ver y tocar los archivos
que ella misma crea; el resto del Drive le queda vedado.

Tiene dos partes:

- **Una sola vez, quien administra la app** (pasos 1 a 4): le da a la app sus credenciales de Google.
  Lleva unos 20 minutos. Los nombres de los menús de Google cambian cada tanto: si alguno no coincide,
  buscá el más parecido.
- **Cada usuario, cuando quiera** (paso 5): conecta su Drive desde la app, con un botón.

## 1. Crear el proyecto en Google Cloud

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com) con una cuenta de Google tuya. No
   tiene que ser la del Drive donde se guardan las copias: eso lo elige cada usuario al conectar.
2. Arriba, en el selector de proyectos, elegí **Proyecto nuevo**. Nombre: `Gastos`. Crear.
3. Con el proyecto `Gastos` elegido, buscá **Google Drive API** en la barra de búsqueda y tocá
   **Habilitar**.

## 2. Configurar la pantalla de permiso

Es la pantalla que le pregunta a cada usuario "¿Dejás que Gastos use tu Drive?". En el menú aparece como
**Google Auth Platform** (antes, "Pantalla de consentimiento de OAuth").

1. Tocá **Comenzar**. Nombre de la app: `Gastos`. Correo de asistencia: el tuyo.
2. Público: **Externo**. Correo de contacto: el tuyo. Aceptá y creá.
3. En **Información de la marca** (Branding), Google pide tres direcciones. Usá la del sitio de la app
   (no la del backend):
   - Página principal: `https://TU-SITIO.onrender.com`
   - Política de Privacidad: `https://TU-SITIO.onrender.com/privacidad`
   - Condiciones del Servicio: `https://TU-SITIO.onrender.com/condiciones`

   En **Dominios autorizados** van el del sitio y el del backend, sin `https://`. **No subas un logotipo**:
   con logotipo Google exige verificar la marca y la publicación se traba.

4. En **Público** (Audience), tocá **Publicar app** y confirmá, para que quede **En producción**.
   Importante: si queda "En prueba", Google corta el permiso a los 7 días y la copia deja de andar, y además
   solo podrían conectarse las cuentas que agregues a mano.
   Con el permiso que usa la app (`drive.file`, solo sus propios archivos) no hace falta que Google la
   verifique.

## 3. Crear la credencial

1. En **Clientes** (o **Credenciales → Crear credenciales → ID de cliente de OAuth**), creá un cliente.
2. Tipo de aplicación: **Aplicación web**. Nombre: `Gastos backup`.
3. En **URIs de redireccionamiento autorizados** agregá la dirección de tu backend seguida de
   `/api/v1/backup/drive/callback`. Tiene que ser exacta, sin barra al final:

   ```
   https://gastos-api.onrender.com/api/v1/backup/drive/callback
   ```

   Usá la dirección real de tu servicio en Render. Para probar en tu PC, agregá también
   `http://localhost:4000/api/v1/backup/drive/callback`.

4. Crear. Copiá el **ID de cliente** y el **Secreto del cliente**. No los pegues en ningún chat.

## 4. Cargarlo en Render

1. En Render, entrá al servicio `gastos-api` → **Environment**.
2. Agregá tres variables:
   - `DRIVE_CLIENT_ID`: el ID de cliente.
   - `DRIVE_CLIENT_SECRET`: el secreto.
   - `PUBLIC_API_URL`: la dirección del backend, sin barra al final ni `/api/v1`
     (por ejemplo `https://gastos-api.onrender.com`). Es la misma que usaste en el paso 3.
3. Guardá. Render reinicia el servicio solo.

Para probar en tu PC, las mismas tres van en `backend/.env`, con `PUBLIC_API_URL=http://localhost:4000`.

Si tenías la variable `DRIVE_REFRESH_TOKEN` de la versión anterior, borrala: ya no se usa.

## 5. Conectar el Drive (cada usuario)

1. En la app: **Más → Respaldo y datos → Copia automática en Google Drive → Conectar mi Google Drive**.
2. Se abre la página de Google. Elegí tu cuenta y aceptá. Puede aparecer "Google no verificó esta app":
   tocá **Avanzado → Ir a Gastos**.
3. Volvés solo a la app, que dice "Drive conectado" y la hora de la primera copia.
4. En tu Drive aparece `gastos-respaldo.json`.

Desde ahí la copia se hace sola una vez por día. "Copiar ahora" la hace en el momento y "Desconectar"
hace que la app se olvide del permiso (las copias que ya están en tu Drive quedan).

El permiso de cada usuario se guarda cifrado en la base de datos. No viaja en ningún respaldo y nadie más
lo ve, tampoco el administrador.

## Recuperar un respaldo

1. En Drive, descargá `gastos-respaldo.json`. Para una copia de un día anterior: clic derecho →
   **Información del archivo → Administrar versiones** y descargá la que quieras.
2. En la app: **Más → Respaldo y datos → Restaurar un respaldo** y elegí ese archivo. Reemplaza tus datos,
   no los de otros usuarios.

## Si algo falla

- La pantalla principal muestra "La copia en Google Drive no se está haciendo" cuando falló o cuando pasaron
  más de 3 días sin copia mientras se usa la app. En **Más → Respaldo y datos** dice el motivo.
- "Esta instalación todavía no tiene Google Drive configurado": faltan las variables del paso 4.
- "Google rechazó el permiso": tocá **Desconectar** y volvé a conectar tu Drive.
- Google muestra `redirect_uri_mismatch`: la dirección del paso 3 no es igual a `PUBLIC_API_URL` seguida de
  `/api/v1/backup/drive/callback`. Revisá que no sobre una barra ni falte la `s` de `https`.
- Si cambiás `JWT_SECRET` en Render, los permisos guardados dejan de poder leerse: cada usuario desconecta
  y vuelve a conectar su Drive.
- Para quitarle el permiso a la app desde Google:
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions) → Gastos → Quitar acceso.
