import {
  DRIVE_BACKUP_FILE_NAME,
  MIN_PASSWORD_LENGTH,
  PENDING_DOCUMENT_RETENTION_DAYS,
  SESSION_DAYS,
  TRASH_RETENTION_DAYS,
} from '@gastos/shared';

/**
 * The privacy policy and the terms of use: public pages, readable without
 * signing in. Like es.ts, this is text and nothing else, so wording is changed
 * here. Whatever it says the app does has to be true: when a feature changes
 * what is stored, sent or deleted, this changes with it, and so does `updated`.
 */

/** Shown in this order: the lead, the list, then the paragraphs. */
export interface LegalSection {
  title: string;
  /** A sentence that introduces the list. */
  lead?: string;
  items?: string[];
  paragraphs?: string[];
}

export interface LegalDocument {
  /** Where the page lives. Registered in Google Cloud as the app's policy or terms. */
  path: string;
  title: string;
  /** The day the text last changed, as YYYY-MM-DD. */
  updated: string;
  intro: string[];
  sections: LegalSection[];
}

const UPDATED = '2026-10-13';

const privacy: LegalDocument = {
  path: '/privacidad',
  title: 'Política de privacidad',
  updated: UPDATED,
  intro: [
    'Gastos es una aplicación para llevar un registro personal de ingresos y egresos. No es un servicio comercial: cada instalación la administra una persona, que es quien crea los usuarios y responde por los datos que se guardan en ella.',
    'Esta página explica qué datos guarda la aplicación, para qué los usa, a quién se envían y cómo podés pedir que se corrijan o se borren. Está escrita para que se entienda, no para cubrirnos: si algo no queda claro, escribinos.',
  ],
  sections: [
    {
      title: 'Qué datos guarda',
      items: [
        'Tu nombre de usuario y tu contraseña. La contraseña se guarda cifrada con un algoritmo de un solo sentido (bcrypt): nadie puede leerla, tampoco quien administra la instalación.',
        'Lo que vos cargás: cuentas, categorías, etiquetas, movimientos con sus montos, fechas y descripciones, productos de tus compras, cierres y vencimientos de tus tarjetas.',
        `Las fotos de tickets y capturas que subís para que se lean, solo hasta que confirmás o descartás lo leído. En ese momento se borran. Las que no revisás se borran solas a los ${PENDING_DOCUMENT_RETENTION_DAYS} días.`,
        'El texto de un resumen de tarjeta que aprobás para su lectura, solo hasta que confirmás lo leído. El archivo PDF y su contraseña no se guardan nunca.',
        'Si conectás tu Google Drive, el permiso que le diste a la aplicación, guardado cifrado.',
      ],
      paragraphs: [
        'La aplicación no pide ni guarda tu nombre real, tu documento, tu domicilio, tu teléfono ni los números de tus tarjetas o cuentas bancarias. Si aparecen en un comprobante, se le indica a la lectura automática que no los devuelva.',
      ],
    },
    {
      title: 'Para qué se usan',
      paragraphs: [
        'Únicamente para que la aplicación funcione para vos: mostrarte tus movimientos, calcular tus totales, leer tus comprobantes y hacer tu copia de seguridad. No se usan para publicidad, no se venden, no se ceden y no se arman perfiles con ellos. La aplicación no tiene anuncios ni herramientas de seguimiento o de estadísticas de uso.',
      ],
    },
    {
      title: 'Quién puede verlos',
      items: [
        'Vos, entrando con tu usuario y tu contraseña.',
        'Ningún otro usuario de la instalación. Cada usuario ve solamente sus propios datos.',
        'Quien administra la instalación puede crear usuarios, ponerles una contraseña nueva y desactivarlos. La aplicación no le ofrece ninguna pantalla para ver los datos de otro usuario.',
      ],
      paragraphs: [
        'Hay un límite que es honesto decir: quien administra la instalación tiene acceso técnico a la base de datos donde se guarda todo, y si te pone una contraseña nueva podría entrar con tu usuario (lo notarías, porque tu contraseña dejaría de funcionar). Usá la aplicación solo si confiás en esa persona.',
      ],
    },
    {
      title: 'A quién se envían',
      lead: 'Para funcionar, la aplicación se apoya en servicios de otras empresas. Cada una recibe solo lo necesario:',
      items: [
        'MongoDB Atlas (MongoDB, Inc.) guarda la base de datos.',
        'Render (Render Services, Inc.) aloja la aplicación y el servidor.',
        'Google Gemini (Google LLC) recibe las fotos, capturas y textos de resúmenes que mandás a leer, y devuelve lo que entendió. En el plan gratuito de ese servicio, Google puede usar lo que recibe para mejorar sus productos. Por eso, antes de mandar un resumen de tarjeta, la aplicación te muestra el texto con los datos personales tapados y solo lo envía cuando lo aprobás.',
        'Google Drive (Google LLC), solo si lo conectás, guarda tu copia de seguridad en tu propia cuenta.',
        'Un servicio público de cotizaciones recibe únicamente el pedido de la cotización entre dos monedas. No recibe ningún dato tuyo.',
      ],
    },
    {
      title: 'Google Drive y los datos de tu cuenta de Google',
      paragraphs: [
        'Conectar tu Google Drive es opcional. Si lo hacés, la aplicación pide un único permiso, el más acotado que existe para Drive: ver y administrar solamente los archivos que ella misma crea. No puede ver, leer, modificar ni borrar ningún otro archivo o carpeta de tu Drive, ni accede a tu correo, tus contactos o cualquier otro dato de tu cuenta de Google.',
        `Con ese permiso hace una sola cosa: guardar una vez por día tu copia de seguridad en un archivo llamado ${DRIVE_BACKUP_FILE_NAME}, y consultar cuándo se guardó por última vez. Ese archivo contiene tus datos de la aplicación y queda en tu cuenta; la aplicación no lo comparte con nadie.`,
        'El permiso se guarda cifrado y se usa únicamente para eso. Podés quitarlo cuando quieras con el botón "Desconectar", en Más → Respaldo y datos, o desde tu cuenta de Google (myaccount.google.com/permissions). Las copias que ya estén en tu Drive quedan ahí hasta que las borres vos.',
        'El uso que hace la aplicación de la información recibida de las APIs de Google cumple con la Política de datos de usuario de los servicios de API de Google, incluidos los requisitos de uso limitado. En particular: esos datos no se transfieren a terceros, no se usan para publicidad y ninguna persona los lee.',
      ],
    },
    {
      title: 'Cuánto tiempo se guardan',
      items: [
        'Tus datos se guardan mientras tengas usuario en la instalación.',
        `Lo que mandás a la papelera se borra definitivamente a los ${TRASH_RETENTION_DAYS} días, o antes si la vaciás.`,
        'Las imágenes y los textos de los comprobantes se borran al confirmar o descartar la lectura, como se explicó arriba.',
        'Si tu usuario se desactiva, no podés entrar pero tus datos se conservan hasta que pidas que se borren.',
      ],
    },
    {
      title: 'Cómo se protegen',
      items: [
        'La conexión entre tu dispositivo y el servidor va siempre cifrada (HTTPS).',
        `Las contraseñas tienen un mínimo de ${MIN_PASSWORD_LENGTH} caracteres, se guardan cifradas y hay un límite de intentos de ingreso.`,
        `La sesión vence a los ${SESSION_DAYS} días. Podés cerrarla en todos tus dispositivos a la vez desde Más, por ejemplo si perdés el teléfono.`,
        'Tu dispositivo guarda la sesión abierta y, si las cargaste, las palabras que elegiste tapar en los resúmenes. Esas palabras no salen de tu dispositivo.',
      ],
      paragraphs: [
        'Ningún sistema es infalible. La aplicación corre sobre planes gratuitos de los servicios mencionados, que no garantizan copias de seguridad: por eso te recomendamos conectar tu Drive o descargar tu respaldo cada tanto.',
      ],
    },
    {
      title: 'Tus derechos',
      lead: 'Los datos son tuyos. En cualquier momento podés:',
      items: [
        'Verlos y corregirlos desde la propia aplicación.',
        'Llevártelos completos: en Más → Respaldo y datos podés descargar todo en un archivo, o exportar tus movimientos a una planilla.',
        'Pedir que se borren tu usuario y todos tus datos, escribiendo a quien administra la instalación. Hoy ese borrado no es un botón: lo hace a mano el administrador.',
      ],
    },
    {
      title: 'Si usás la aplicación desde Argentina',
      paragraphs: [
        'La Ley 25.326 de Protección de los Datos Personales te reconoce los derechos de acceso, rectificación, actualización y supresión de tus datos. Para ejercerlos escribí a quien administra la instalación. Si no recibís respuesta, podés reclamar ante la Agencia de Acceso a la Información Pública, que es el órgano de control de esa ley.',
        'Los servicios que usa la aplicación guardan los datos en servidores ubicados fuera de la Argentina.',
      ],
    },
    {
      title: 'Menores de edad',
      paragraphs: [
        'La aplicación no está pensada para menores de 18 años y no hay registro abierto: cada usuario lo crea quien administra la instalación.',
      ],
    },
    {
      title: 'Cambios en esta política',
      paragraphs: [
        'Si cambia lo que la aplicación guarda, envía o borra, esta página se actualiza y cambia la fecha del comienzo. Si el cambio es importante, quien administra la instalación te lo va a avisar.',
      ],
    },
  ],
};

const terms: LegalDocument = {
  path: '/condiciones',
  title: 'Condiciones de uso',
  updated: UPDATED,
  intro: [
    'Gastos es una herramienta personal para registrar ingresos y egresos. Se ofrece gratis y sin fines comerciales, a las personas a las que quien administra cada instalación decide darles un usuario.',
    'Al usarla aceptás estas condiciones. Son pocas y están escritas para leerse.',
  ],
  sections: [
    {
      title: 'Tu usuario',
      items: [
        'El usuario te lo crea quien administra la instalación. No hay registro abierto.',
        'Tu usuario es personal: no lo compartas, y cambiá la contraseña que te dieron la primera vez que entres.',
        'Sos responsable de lo que se haga con tu usuario. Si creés que alguien más lo usó, cerrá la sesión en todos los dispositivos y cambiá la contraseña.',
      ],
    },
    {
      title: 'Qué podés esperar y qué no',
      items: [
        'La aplicación es un registro. No es un banco ni una billetera, no mueve plata y no se conecta con tus cuentas reales.',
        'No da asesoramiento financiero, contable ni impositivo. Los totales y los informes salen de lo que vos cargaste.',
        'La lectura automática de tickets, capturas y resúmenes puede equivocarse. Por eso la aplicación siempre propone y vos decidís: nada de lo leído se guarda hasta que lo revisás y lo confirmás. Revisar es tu parte.',
        'Funciona sobre servicios gratuitos: puede tardar en responder, estar caída un rato o dejar de ofrecerse. No hay garantía de disponibilidad.',
      ],
    },
    {
      title: 'Tus datos y tus copias',
      paragraphs: [
        'Lo que cargás es tuyo. Cómo se trata está explicado en la Política de privacidad.',
        'Guardar una copia es tu responsabilidad: conectá tu Google Drive para que se haga sola, o descargá tu respaldo cada tanto desde Más → Respaldo y datos. Si se pierden datos por una falla de los servicios donde corre la aplicación y no tenías copia, no se pueden recuperar.',
      ],
    },
    {
      title: 'Uso aceptable',
      items: [
        'Usala para tu registro personal o familiar.',
        'No intentes acceder a datos de otros usuarios, eludir las medidas de seguridad ni sobrecargar el servicio.',
        'No subas contenido que no tengas derecho a usar, ni comprobantes de terceros sin su permiso.',
        'La lectura automática tiene un cupo diario que comparten todos los usuarios de la instalación: no lo uses para otra cosa que tus propios comprobantes.',
      ],
    },
    {
      title: 'Suspensión y baja',
      paragraphs: [
        'Quien administra la instalación puede desactivar un usuario, por ejemplo si se incumplen estas condiciones o si deja de ofrecer la aplicación. Tus datos no se borran al desactivarlo: podés pedir una copia o que se eliminen.',
        'Podés dejar de usar la aplicación cuando quieras, y pedir que se borren tu usuario y tus datos.',
      ],
    },
    {
      title: 'Responsabilidad',
      paragraphs: [
        'La aplicación se ofrece tal como está, sin garantías de ningún tipo. En la medida en que la ley lo permita, quien la administra no responde por pérdidas de datos, errores en los cálculos o en la lectura automática, ni por decisiones tomadas a partir de lo que la aplicación muestra. Nada de esto limita los derechos que la ley te reconoce y que no se pueden renunciar.',
      ],
    },
    {
      title: 'Cambios',
      paragraphs: [
        'Estas condiciones pueden cambiar. Cuando cambien, se actualiza la fecha del comienzo, y si el cambio es importante quien administra la instalación te lo va a avisar. Seguir usando la aplicación después de un cambio significa que lo aceptás.',
      ],
    },
    {
      title: 'Ley aplicable',
      paragraphs: ['Estas condiciones se rigen por las leyes de la República Argentina.'],
    },
  ],
};

export const legal = {
  privacy,
  terms,
  updatedOn: (date: string) => `Última actualización: ${date}`,
  contactTitle: 'Contacto',
  contactWith: 'Para cualquier consulta sobre tus datos o sobre estas páginas, escribí a',
  contactWithout:
    'Para cualquier consulta sobre tus datos o sobre estas páginas, escribile a la persona que te dio tu usuario: es quien administra esta instalación.',
  back: 'Volver a la aplicación',
  seeAlso: 'Ver también:',
};
