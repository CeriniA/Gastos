import { createServer } from 'node:http';
import { env } from '../config/env';
import { authorizationUrl, exchangeCode } from '../providers/drive/googleDrive';

/**
 * Gets the permission for the automatic backup to Google Drive, once.
 * Usage: npm run drive-auth -w backend
 * Needs DRIVE_CLIENT_ID and DRIVE_CLIENT_SECRET in backend/.env, and prints the
 * DRIVE_REFRESH_TOKEN to put in Render and in backend/.env. See docs/RESPALDO_DRIVE.md.
 */

/** Google sends the browser back here after consent; desktop OAuth clients accept any local port. */
const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;
const NOT_FOUND = 404;

const clientId = env.DRIVE_CLIENT_ID;
const clientSecret = env.DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Faltan DRIVE_CLIENT_ID y DRIVE_CLIENT_SECRET en backend/.env. Ver docs/RESPALDO_DRIVE.md.');
  process.exit(1);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', REDIRECT_URI);
  const code = url.searchParams.get('code');
  const refused = url.searchParams.get('error');
  if (!code && !refused) {
    // The browser also asks for an icon: nothing to do with it.
    response.statusCode = NOT_FOUND;
    response.end();
    return;
  }
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const finish = (pageText: string) => {
    response.end(pageText);
    server.close();
  };
  if (!code) {
    console.error(`Google no dio el permiso (${refused}).`);
    process.exitCode = 1;
    finish('Google no dio el permiso. Podés cerrar esta pestaña y volver a intentar.');
    return;
  }
  exchangeCode({ clientId, clientSecret, code, redirectUri: REDIRECT_URI })
    .then((refreshToken) => {
      console.log('\nListo. Copiá este valor como DRIVE_REFRESH_TOKEN en Render y en backend/.env.');
      console.log('No lo pegues en ningún chat: da acceso a los archivos de la app en tu Drive.\n');
      console.log(refreshToken);
      finish('Listo. Volvé a la terminal; ya podés cerrar esta pestaña.');
    })
    .catch((error: unknown) => {
      console.error('No se pudo obtener el permiso:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
      finish('Algo falló. Mirá el mensaje en la terminal.');
    });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Abrí este enlace en el navegador, entrá con tu cuenta de Google y aceptá el permiso:\n');
  console.log(authorizationUrl(clientId, REDIRECT_URI));
  console.log('\nEsperando la respuesta de Google…');
});
