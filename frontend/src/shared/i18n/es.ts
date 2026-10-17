import {
  MIN_PASSWORD_LENGTH,
  PRODUCT_GROUP_LABELS,
  type AccountType,
  type CategoryKind,
  type Currency,
  type DocumentErrorCode,
  type DocumentKind,
  type DriveBackupError,
  type DriveConnectResult,
  type DocumentStatus,
  type ErrorCode,
  type ImportIssueCode,
  type InstitutionKind,
  type StatementFileType,
  type StatementKind,
  type RecurringState,
  type TransactionType,
  type UncertainField,
  type UploadableDocumentKind,
  type UserRole,
} from '@gastos/shared';

/**
 * Every text the user reads lives in this file. Components never hard-code
 * Spanish strings, so wording is changed in one place.
 */
export const es = {
  appName: 'Gastos',

  nav: {
    main: 'Principal',
    home: 'Inicio',
    transactions: 'Movimientos',
    add: 'Agregar',
    reports: 'Informes',
    more: 'Más',
  },

  common: {
    save: 'Guardar',
    saving: 'Guardando…',
    cancel: 'Cancelar',
    delete: 'Borrar',
    add: 'Agregar',
    loading: 'Cargando…',
    retry: 'Reintentar',
    archive: 'Archivar',
    unarchive: 'Desarchivar',
    archived: 'Archivada',
    back: 'Volver',
    edit: 'Editar',
    rename: 'Renombrar',
    close: 'Cerrar',
    optional: 'opcional',
    none: 'Ninguna',
  },

  server: {
    waking: 'Despertando el servidor. La primera carga puede tardar cerca de un minuto.',
  },

  auth: {
    title: 'Entrar',
    username: 'Usuario',
    password: 'Contraseña',
    submit: 'Entrar',
    submitting: 'Entrando…',
    logout: 'Cerrar sesión',
    logoutAll: 'Cerrar sesión en todos los dispositivos',
    logoutAllHint: 'Usalo si perdiste el celular o entraste desde una computadora ajena.',
    logoutAllConfirm:
      'Se cierra la sesión en todos los dispositivos, también en este. Vas a tener que volver a entrar con tu contraseña.',
    signedInAs: (username: string) => `Entraste como ${username}.`,
  },

  password: {
    title: 'Cambiar mi contraseña',
    text: 'Al cambiarla se cierra la sesión en todos tus dispositivos, también en este, y volvés a entrar con la nueva.',
    current: 'Contraseña actual',
    next: 'Contraseña nueva',
    hint: (length: number) => `Al menos ${length} caracteres.`,
    submit: 'Cambiar contraseña',
  },

  users: {
    title: 'Usuarios',
    text: 'Cada usuario entra con su nombre y su contraseña y ve solo sus propios datos: cuentas, movimientos, categorías y respaldo. Vos tampoco ves los de ellos.',
    roles: { admin: 'Administrador', user: 'Usuario' } satisfies Record<UserRole, string>,
    you: 'vos',
    inactive: 'Desactivado',
    newTitle: 'Nuevo usuario',
    newText:
      'Empieza con las categorías y cuentas iniciales. Pasale el nombre y la contraseña; después la cambia desde Más.',
    username: 'Nombre de usuario',
    password: 'Contraseña',
    role: 'Tipo',
    resetPassword: 'Cambiar contraseña',
    newPassword: (username: string) => `Contraseña nueva para ${username}`,
    resetDone: (username: string) =>
      `Contraseña de ${username} cambiada. Se cerraron sus sesiones: pasale la nueva.`,
    deactivate: 'Desactivar',
    activate: 'Activar',
    edit: 'Editar',
    editTitle: (username: string) => `Editar a ${username}`,
    ownRole: 'Tu propio tipo no lo podés cambiar: lo cambia otro administrador.',
    aiUsage: (used: number, limit: number) => `Lecturas con IA hoy: ${used} de ${limit}`,
    aiLimit: 'Lecturas con IA por día',
    aiLimitHint:
      'Cuántos tickets o resúmenes puede mandar a leer por día. Vacío: el mismo límite que todos. 0: no puede usar la IA.',
    saved: (username: string) => `Cambios de ${username} guardados.`,
    deactivateConfirm: (username: string) =>
      `${username} deja de poder entrar y se cierran sus sesiones. Sus datos no se borran; lo podés volver a activar.`,
  },

  types: { expense: 'Egreso', income: 'Ingreso', transfer: 'Transferencia' } satisfies Record<
    TransactionType,
    string
  >,
  kinds: { expense: 'Egresos', income: 'Ingresos' } satisfies Record<CategoryKind, string>,
  accountTypes: {
    cash: 'Efectivo',
    bank: 'Cuenta bancaria',
    wallet: 'Billetera virtual',
    credit_card: 'Tarjeta de crédito',
  } satisfies Record<AccountType, string>,

  home: {
    income: 'Ingresos',
    expense: 'Egresos',
    balance: 'Balance',
    emptyMonth: 'Todavía no hay movimientos pagados en este mes.',
    recent: 'Últimos movimientos',
    seeAll: 'Ver todos',
    addFirst: 'Cargar un movimiento',
  },

  transactions: {
    title: 'Movimientos',
    newTitle: 'Nuevo movimiento',
    editTitle: 'Editar movimiento',
    empty: 'No hay movimientos en este mes.',
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    noDescription: 'Sin descripción',
    noCategory: 'Sin categoría',
    transferTo: (account: string) => `Transferencia a ${account}`,
    installment: (number: number, total: number) => `Cuota ${number} de ${total}`,
    refund: 'Es una devolución',
    refundHint:
      'Te devolvieron plata de una compra: resta del gasto de su categoría y del resumen de la tarjeta.',
    refundTag: 'devolución',
    count: (count: number) => (count === 1 ? '1 movimiento' : `${count} movimientos`),
    loadMore: 'Cargar más',
    filters: {
      search: 'Buscar en descripción o nota',
      toggle: (active: number) => (active === 0 ? 'Filtros' : `Filtros (${active})`),
      all: 'Todos',
      allFeminine: 'Todas',
      categoryHint: 'Incluye sus subcategorías.',
      allTime: 'Buscar en todos los meses',
      clear: 'Quitar filtros',
      noResults: 'Ningún movimiento coincide con lo que buscás.',
    },
    split: {
      title: 'Dividido entre categorías',
      start: 'Dividir entre varias categorías',
      stop: 'No dividir',
      addPart: 'Agregar parte',
      removePart: 'Quitar esta parte',
      balanced: 'Las partes suman el total.',
      missing: (amount: string) => `Falta asignar ${amount}.`,
      excess: (amount: string) => `Las partes superan el total por ${amount}.`,
      incomplete: 'Cada parte necesita una categoría y un monto.',
      needTwo: 'Para dividir hacen falta al menos dos partes. Si es una sola categoría, tocá "No dividir".',
      mismatch: 'Las partes tienen que sumar exactamente el monto total.',
      summary: (count: number) => `Dividido en ${count} categorías`,
    },
    fields: {
      type: 'Tipo',
      amount: 'Monto',
      date: 'Fecha',
      account: 'Cuenta',
      toAccount: 'Cuenta destino',
      toAmount: 'Monto que llega a destino',
      category: 'Categoría',
      paymentDate: 'Fecha de pago',
      paymentDateHint:
        'Vencimiento del resumen donde entra esta compra. Si la dejás vacía se usa la fecha de la compra.',
      description: 'Descripción',
      note: 'Nota',
      tags: 'Etiquetas',
      newTag: 'Nueva etiqueta',
    },
    needAccount: 'Antes de cargar movimientos, creá una cuenta en Más → Cuentas.',
    deleteConfirm: 'El movimiento va a la papelera y se borra del todo en 30 días.',
    moveToTrash: 'Mover a la papelera',
    rateHint: (amount: string) =>
      `En el comprobante: ${amount}. Al cambiar el cambio se recalcula el monto, y al cambiar el monto se recalcula el cambio.`,
  },

  accounts: {
    balance: (amount: string) => `Saldo hoy: ${amount}`,
    balanceSince: (date: string) => `desde el saldo inicial del ${date}`,
    balanceFromZero: 'sin saldo inicial: cuenta desde cero',
    opening: 'Saldo inicial',
    openingAmount: 'Monto',
    openingDate: 'Al día',
    openingHint:
      'Lo que tenía la cuenta al empezar ese día, antes de sus movimientos, según el banco o la app. Desde ahí la app suma y resta tus movimientos, los de ese día incluidos. En una tarjeta, lo que debés va con signo menos. Vacío: cuenta desde cero.',
    openingInvalid: 'Escribí el monto (con signo menos si es deuda) y el día.',
    title: 'Cuentas',
    empty: 'Todavía no hay cuentas. Creá la primera para empezar a cargar movimientos.',
    name: 'Nombre',
    type: 'Tipo',
    currency: 'Moneda',
    newTitle: 'Nueva cuenta',
    fixedHint: 'El tipo y la moneda no se pueden cambiar después.',
    bank: 'Banco o emisor',
    network: 'Tarjeta',
    cardHint:
      'Si la tarjeta tiene saldo en pesos y en dólares, creá dos cuentas (por ejemplo "Visa" y "Visa USD") con el mismo banco y tarjeta: así comparten los cierres.',
    deleteConfirm: (name: string) => `¿Borrar la cuenta "${name}"?`,
  },

  institutions: {
    title: 'Bancos y tarjetas',
    text: 'La lista para elegir el banco de cada cuenta y la marca de cada tarjeta. Agregá las que falten.',
    kinds: { bank: 'Bancos y emisores', network: 'Tarjetas' } satisfies Record<InstitutionKind, string>,
    name: 'Nombre',
    newName: { bank: 'Nuevo banco o emisor', network: 'Nueva tarjeta' } satisfies Record<
      InstitutionKind,
      string
    >,
    empty: 'La lista está vacía.',
    deleteConfirm: (name: string) => `¿Borrar "${name}"?`,
  },

  cards: {
    title: 'Tarjetas',
    noCards: 'No hay tarjetas de crédito. Creá una cuenta de tipo "Tarjeta de crédito" en Más → Cuentas.',
    openSince: (date: string) => `Compras desde el cierre del ${date}`,
    openNoClosing: 'Compras con esta tarjeta',
    firstHint:
      'Cargá el cierre y el vencimiento de tu último resumen: cada compra pasa a contar en el mes en que la pagás.',
    purchases: (count: number) => (count === 1 ? '1 movimiento' : `${count} movimientos`),
    dueOn: (date: string) => `Vence el ${date}`,
    closedOn: (date: string) => `Cerró el ${date}`,
    statementTotal: (amount: string) => `El resumen dice ${amount}.`,
    difference: (amount: string) => `Diferencia: ${amount}; puede faltar cargar algo.`,
    matches: 'Coincide.',
    minimumIs: (amount: string) => `Pago mínimo: ${amount}`,
    newTitle: 'Nuevo cierre',
    newText:
      'Copiá las fechas del resumen. Las compras hasta el cierre se pagan en ese vencimiento; si después corregís las fechas, se reacomodan solas.',
    closing: 'Cierre',
    due: 'Vencimiento',
    total: 'Total del resumen',
    minimum: 'Pago mínimo',
    alsoFor: 'Aplicar también a',
    datesRequired: 'Completá el cierre y el vencimiento.',
    deleteConfirm:
      'Se borra este cierre y sus compras vuelven a contar en su propia fecha. Los pagos que le registraste quedan como transferencias. ¿Seguir?',
    paid: (amount: string) => `Pagado: ${amount}.`,
    remaining: (amount: string) => `Falta pagar ${amount}.`,
    paidInFull: 'Está pago.',
    pay: 'Registrar un pago',
    payText:
      'Es una transferencia desde tu cuenta a la tarjeta. No cuenta como gasto: las compras ya están contadas.',
    payFrom: 'Desde la cuenta',
    payDate: 'Fecha del pago',
    payAmount: (currency: string) => `Monto que sale de la cuenta (${currency})`,
    payReaches: (currency: string) => `Monto que cubre del resumen (${currency})`,
    paySubmit: 'Registrar pago',
    noOtherAccounts: 'Para registrar un pago necesitás otra cuenta desde la que salga la plata.',
  },

  installments: {
    label: 'Cuotas',
    hint: 'Se crea un movimiento por mes. Los de meses futuros quedan proyectados hasta que llega su fecha.',
    single: 'En un pago',
    option: (count: number) => `${count} cuotas`,
    projected: 'proyectada',
    editHint: 'Podés corregir el monto de esta cuota si el resumen dice otro (por ejemplo, con interés).',
    deleteAll: 'Borrar todas las cuotas de esta compra',
    deleteAllConfirm: 'Todas las cuotas de esta compra van a la papelera. ¿Seguir?',
  },

  categories: {
    title: 'Categorías',
    empty: 'No hay categorías de este tipo.',
    name: 'Nombre',
    parent: 'Dentro de',
    rootOption: 'Nivel principal',
    newTitle: 'Nueva categoría',
    depthHint: 'Hasta tres niveles.',
    moveHint: 'Al cambiarlo, la categoría se mueve con todas sus subcategorías.',
    mergeTitle: 'Unir con otra categoría',
    mergeText: 'Todos sus movimientos y reglas pasan a la categoría que elijas, y esta se borra.',
    mergeBlocked: 'Tiene subcategorías. Movelas o unilas primero para poder unir esta.',
    mergeAction: 'Unir',
    mergeConfirm: (source: string, target: string) =>
      `Todos los movimientos de "${source}" van a pasar a "${target}" y "${source}" se borra. No se puede deshacer.`,
    deleteConfirm: (name: string) => `¿Borrar la categoría "${name}"?`,
  },

  tags: {
    title: 'Etiquetas',
    text: 'Una etiqueta marca movimientos de cualquier categoría: un viaje, una obra, un evento.',
    empty: 'Todavía no hay etiquetas.',
    name: 'Nombre',
    newTitle: 'Nueva etiqueta',
    deleteConfirm: (name: string) =>
      `La etiqueta "${name}" se borra y se quita de todos sus movimientos. Los movimientos no se borran.`,
  },

  trash: {
    title: 'Papelera',
    text: 'Lo que borraste queda acá 30 días y después se borra solo. Mientras tanto no cuenta en ningún total.',
    empty: 'La papelera está vacía.',
    restore: 'Restaurar',
    deleteForever: 'Borrar del todo',
    deleteConfirm: 'El movimiento se borra del todo. No se puede deshacer.',
    emptyAction: (count: number) => `Vaciar la papelera (${count})`,
    emptyConfirm: (count: number) =>
      count === 1
        ? 'Se borra del todo 1 movimiento. No se puede deshacer.'
        : `Se borran del todo ${count} movimientos. No se puede deshacer.`,
  },

  add: {
    title: 'Agregar',
    photoTitle: 'Con una foto',
    photoText: 'La app lee el ticket o la captura y te muestra lo que entendió para que lo confirmes.',
    takePhoto: 'Sacar foto',
    chooseFiles: 'Elegir de la galería',
    kind: 'Qué es',
    kinds: {
      receipt: 'Ticket o factura',
      screenshot: 'Captura de una app',
      card_statement: 'Resumen de tarjeta',
      account_statement: 'Resumen de cuenta',
    } satisfies Record<DocumentKind, string>,
    account: 'Cuenta con la que pagaste',
    accountLater: 'La elijo al revisar',
    groupQuestion: 'Elegiste varias fotos',
    separate: {
      receipt: (count: number) => `Son ${count} tickets distintos`,
      screenshot: (count: number) => `Son ${count} capturas de cosas distintas`,
    } satisfies Record<UploadableDocumentKind, (count: number) => string>,
    together: {
      receipt: 'Son partes de un mismo ticket largo',
      screenshot: 'Son partes de una misma lista de movimientos',
    } satisfies Record<UploadableDocumentKind, string>,
    selected: (count: number) => (count === 1 ? '1 imagen elegida' : `${count} imágenes elegidas`),
    upload: 'Subir',
    uploading: 'Subiendo…',
    tooMany: (max: number) =>
      `Juntas se pueden leer hasta ${max} fotos. Si son cosas distintas, elegí esa opción y se suben todas.`,
    keepPhoto: 'La imagen no se conserva después de confirmar. Guardá la foto si la necesitás.',
    duplicate:
      'Ese archivo ya está cargado y tiene movimientos guardados. Para leerlo de nuevo, borrá primero esos movimientos.',
    partial: (ok: number, total: number) =>
      `Se subieron ${ok} de ${total}. Las demás ya estaban subidas o no se pudieron leer.`,
    manualTitle: 'A mano',
    manual: 'Cargar un movimiento',
    statementTitle: 'Un resumen',
    statementText:
      'De una tarjeta de crédito, de una cuenta del banco, de MercadoPago o de cualquier app: en PDF, Excel o CSV. Antes de mandarlo a la IA vas a ver el texto y podés tapar lo que quieras.',
    statement: 'Leer un resumen',
  },

  statement: {
    title: 'Leer un resumen',
    intro:
      'La app saca el texto del archivo y tapa los números de tarjeta y de cuenta, CBU, alias, documentos, mails y lo que sigue a "Titular:" o "Domicilio:". A la IA solo le llega el texto que apruebes, nunca el archivo.',
    kind: 'De qué es',
    kinds: {
      card_statement: 'Tarjeta de crédito',
      account_statement: 'Banco o app',
    } satisfies Record<StatementKind, string>,
    kindHints: {
      card_statement: 'El resumen mensual de una tarjeta: compras, cuotas, intereses, cierre y vencimiento.',
      account_statement:
        'Los movimientos de una cuenta del banco, de MercadoPago, Ualá o cualquier app: lo que entró y lo que salió. Para el débito, el de la cuenta del banco.',
    } satisfies Record<StatementKind, string>,
    file: 'Archivo del resumen',
    fileHint: 'PDF, Excel (.xlsx) o CSV, como lo baja el banco o la app.',
    choose: 'Elegir el archivo',
    chosen: (name: string) => `Elegido: ${name}`,
    password: 'Contraseña del PDF',
    passwordHint: 'Solo si el banco lo protege (a veces es el DNI). No se guarda.',
    accounts: { card_statement: 'Tarjeta', account_statement: 'Cuenta' } satisfies Record<
      StatementKind,
      string
    >,
    read: 'Leer el archivo',
    reading: 'Leyendo el archivo…',
    found: (fileType: StatementFileType, pages: number, hidden: number) =>
      [
        fileType === 'pdf' ? (pages === 1 ? '1 página.' : `${pages} páginas.`) : null,
        hidden === 0
          ? 'No hizo falta tapar ningún dato.'
          : hidden === 1
            ? 'Se tapó 1 dato.'
            : `Se taparon ${hidden} datos.`,
      ]
        .filter(Boolean)
        .join(' '),
    check:
      'Leé el texto antes de mandarlo. Si queda tu nombre, tu dirección u otro dato tuyo, borralo o agregalo abajo para taparlo siempre.',
    words: 'Tapar siempre',
    wordsHint:
      'Tu nombre, tu apellido, tu calle. Se tapan en este y en los próximos resúmenes, y solo se recuerdan en este teléfono.',
    wordPlaceholder: 'Por ejemplo, tu apellido',
    addWord: 'Tapar',
    removeWord: (word: string) => `Dejar de tapar ${word}`,
    text: 'Texto que se manda a la IA',
    send: 'Mandar a la IA',
    sending: 'Mandando…',
    another: 'Elegir otro archivo',
    keepText: 'El texto no se conserva después de confirmar. El archivo no se guarda nunca.',
  },

  documents: {
    pendingTitle: 'Pendientes',
    empty: 'No hay nada esperando tu revisión.',
    expiry: (days: number) => `Lo que no revises en ${days} días se descarta solo, con su imagen o texto.`,
    banner: (count: number) =>
      count === 1 ? '1 documento espera tu revisión' : `${count} documentos esperan tu revisión`,
    statuses: {
      processing: 'Leyendo…',
      ready: 'Listo para revisar',
      error: 'No se pudo leer',
      confirmed: 'Confirmado',
      discarded: 'Descartado',
    } satisfies Record<DocumentStatus, string>,
    found: (count: number) => (count === 1 ? '1 movimiento' : `${count} movimientos`),
    waiting: 'Esperando a la IA',
    waitingText: (time: string, tries: number) =>
      `La IA llegó a su límite o no respondió. Se vuelve a intentar sola a las ${time} (intento ${tries + 1}). Lo subido queda guardado.`,
    retryNow: 'Intentar ahora',
    review: 'Revisar',
    retry: 'Reintentar',
    reread: 'Volver a leer',
    discard: 'Descartar',
    discardConfirm: 'Se descarta el documento y su imagen. No se carga ningún movimiento.',
    errors: {
      rate_limited: 'Se llegó al límite gratuito de lecturas. Probá de nuevo más tarde.',
      unavailable: 'El servicio de lectura no respondió.',
      not_configured: 'La lectura con IA no está configurada: falta la clave o fue rechazada.',
      blocked: 'El servicio de lectura rechazó la imagen.',
      unreadable: 'No se pudo entender la imagen. Probá con una foto más nítida.',
    } satisfies Record<DocumentErrorCode, string>,
    balance: {
      title: 'Saldo de la cuenta',
      chooseAccount: 'Elegí a qué cuenta corresponde el resumen para comparar su saldo.',
      statement: (date: string) => `Saldo según el resumen, el ${date}`,
      inApp: (account: string) => `Saldo de ${account} en la app, con lo marcado`,
      matches: 'Coinciden: no falta ni sobra ningún movimiento.',
      differs: (amount: string) =>
        `Diferencia: ${amount}. Puede faltar un movimiento, estar dos veces, o la cuenta no tener cargado su saldo inicial.`,
      noOpening: (account: string) =>
        `${account} todavía no tiene saldo inicial: la app lo cuenta desde cero. Podés empezarlo con el del resumen.`,
      useOpening: (amount: string, date: string) => `Empezar con ${amount} el ${date}`,
    },
    rememberProducts: (count: number) =>
      count === 1
        ? 'Recordar el producto que corregí para los próximos tickets'
        : `Recordar los ${count} productos que corregí para los próximos tickets`,
    reviewTitle: 'Revisar lo leído',
    sentText: 'Texto que se mandó a la IA',
    periodsTitle: 'Fechas del resumen',
    periodsText:
      'Con el cierre y el vencimiento guardados, cada compra cuenta en el mes en que la pagás. Las podés corregir después en Más → Tarjetas.',
    thisPeriod: 'Este resumen',
    nextPeriod: 'Próximo resumen',
    savePeriod: 'Guardar estas fechas',
    periodCards: 'Para las tarjetas',
    periodCardsMissing: 'Elegí al menos una tarjeta.',
    periodExists:
      'Ese cierre ya está cargado para esa tarjeta. Destildá "Guardar estas fechas" o corregilo en Más → Tarjetas.',
    continuePlan: (from: number, total: number) =>
      from === total
        ? `Crear también la cuota ${total}, que queda proyectada`
        : `Crear también las cuotas ${from} a ${total}, que quedan proyectadas`,
    continuePlanHint:
      'Usalo si esta compra no está cargada. Las cuotas siguientes van por el mismo monto; si cambian, las corregís.',
    statementSum: (sum: string, total: string) => `Lo marcado suma ${sum}; el resumen dice ${total}.`,
    statementGap: (difference: string) =>
      `Diferencia: ${difference}. Puede ser saldo anterior, pagos, o algo que la IA no leyó.`,
    nothingFound: 'No se encontró ningún movimiento en la imagen.',
    imageAlt: (index: number) => `Imagen ${index} del documento`,
    accountForAll: 'Cuenta para todos',
    movement: (index: number, total: number) => `Movimiento ${index} de ${total}`,
    include: 'Cargar este movimiento',
    merchant: 'Comercio',
    doubtful: (fields: string) => `Revisá: ${fields}`,
    uncertain: {
      type: 'tipo',
      date: 'fecha',
      amount: 'monto',
      currency: 'moneda',
      merchant: 'comercio',
      category: 'categoría',
      installment: 'cuota',
    } satisfies Record<UncertainField, string>,
    currencyMismatch: (read: string, account: string) =>
      `El comprobante se leyó en ${read} y se carga en ${account}, sin convertir.`,
    foreign: (amount: string, account: string) =>
      `El comprobante dice ${amount}. Se guarda en ${account} con el cambio que indiques; el monto original queda anotado.`,
    rate: (from: string, to: string) => `Cambio: 1 ${from} en ${to}`,
    notForeign: (currency: string) => `No convertir: el monto ya está en ${currency}`,
    convertAgain: (from: string, to: string) => `Convertir de ${from} a ${to}`,
    rateHint: 'Tu medio de pago puede haber aplicado otro: corregí el cambio o el monto final si hace falta.',
    lastRate: (rate: string, date: string) => `Último cambio que usaste: ${rate} (${date}).`,
    referenceRate: (rate: string, source: string) => `Cotización de referencia: ${rate} (${source}).`,
    rateMissing: 'Cargá el cambio del día o el monto final.',
    duplicate: {
      existing:
        'Parece repetido: ya hay un movimiento cargado con esa fecha y ese monto. Viene sin marcar; tildalo si es otro.',
      repeated:
        'Parece repetido: hay otro movimiento igual más arriba en este mismo documento. Viene sin marcar; tildalo si es otro.',
    } satisfies Record<'existing' | 'repeated', string>,
    fromRule: 'Categoría según tu regla para este comercio.',
    remember: (merchant: string) => `Usar siempre esta categoría para ${merchant}`,
    confirm: (count: number) => (count === 1 ? 'Confirmar 1 movimiento' : `Confirmar ${count} movimientos`),
    noneIncluded: 'Marcá al menos un movimiento para cargar, o descartá el documento.',
    fixErrors: 'Hay datos para completar en los movimientos marcados.',
  },

  consumption: {
    title: 'Consumo',
    total: 'Productos comprados en',
    empty:
      'Este mes no hay productos cargados. Aparecen cuando confirmás un ticket que tiene el detalle de lo comprado.',
    scope: 'Solo cuenta las compras cargadas desde un ticket con detalle de productos.',
    ungrouped: 'Sin clasificar',
    purchases: (count: number) => (count === 1 ? '1 vez' : `${count} veces`),
    quantity: (amount: string) => `cantidad ${amount}`,
    searchPlaceholder: 'Buscar un producto (leche, café…)',
    searchEmpty: 'No hay compras de ese producto.',
  },

  reports: {
    title: 'Informes',
    tabs: {
      categories: 'Categorías',
      accounts: 'Cuentas',
      evolution: 'Meses',
      merchants: 'Comercios',
      projection: 'Próximos',
      consumption: 'Consumo',
    },
    showIn: 'Mostrar',
    eachCurrency: 'Cada moneda por separado',
    allIn: { ARS: 'Todo en pesos', USD: 'Todo en dólares' } satisfies Record<Currency, string>,
    leftOut: (count: number) =>
      count === 1
        ? 'Un movimiento quedó afuera porque no hay una tasa de cambio para su fecha.'
        : `${count} movimientos quedaron afuera porque no hay una tasa de cambio para su fecha.`,
    loadRate: 'Cargar una tasa de cambio',
    convertedWith: 'Cada movimiento se convierte con tu tasa de cambio del día en que se hizo.',
    accounts: {
      empty: 'Este mes ninguna cuenta tuvo movimientos pagados.',
      income: 'Ingresos',
      expense: 'Egresos',
      transfersIn: 'Transferencias recibidas',
      transfersOut: 'Transferencias enviadas',
      scope:
        'Las transferencias son plata que pasó de una cuenta a otra (pagar la tarjeta, comprar dólares): no son ingreso ni egreso.',
    },
    evolution: {
      empty: 'No hay ingresos ni egresos pagados en estos meses.',
      months: (count: number) => `Últimos ${count} meses`,
      average: (amount: string) => `Egreso promedio por mes: ${amount}`,
      noData: 'Sin movimientos',
    },
    merchants: {
      empty: 'Este mes no hay egresos pagados.',
      total: (currency: string) => `Egresos en ${currency}`,
      count: (count: number) => (count === 1 ? '1 compra' : `${count} compras`),
      others: 'Otros y sin descripción',
      scope:
        'Agrupa los egresos por su descripción, sin distinguir mayúsculas ni acentos. Las devoluciones restan.',
    },
    projection: {
      text: 'Lo que ya está cargado para cada mes, más lo que se espera: las cuotas que faltan y los movimientos fijos que todavía no aparecieron.',
      empty: 'No hay nada cargado ni esperado para estos meses.',
      confirmed: 'Ya cargado',
      expected: 'Esperado',
      balance: 'Así terminaría el mes',
      entries: 'Lo que se espera',
      kinds: { installment: 'Cuota', recurring: 'Fijo' },
      noFixed: 'Marcá tus movimientos fijos (alquiler, sueldo, servicios) para que entren en la proyección.',
      goFixed: 'Ir a Movimientos fijos',
    },
    totalIn: (kind: string, currency: string) => `${kind} en ${currency}`,
    directly: (category: string) => `Directo en ${category}`,
    empty: 'Este mes no hay ingresos ni egresos pagados.',
    scope:
      'Cuenta cada movimiento en el mes en que se paga, igual que el balance del Inicio. Las devoluciones restan y las transferencias no entran.',
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
  },

  remembered: {
    title: 'Lo que la app recuerda',
    text: 'Lo que le enseñaste al revisar tus documentos. Si algo quedó mal, olvidalo acá: la próxima vez se propone como lo lee la IA.',
    forget: 'Olvidar',
    categoryRulesTitle: 'Comercio → categoría',
    categoryRulesText: 'Cada movimiento de ese comercio se propone en esa categoría.',
    categoryRulesEmpty:
      'Todavía nada. Al revisar un ticket, tildá "Recordar" junto a la categoría de un comercio.',
    productRulesTitle: 'Productos corregidos',
    productRulesText: 'Cada renglón del ticket con ese texto se propone con ese producto y ese grupo.',
    productRulesEmpty: 'Todavía nada. Al revisar un ticket, corregí un producto y dejá tildado "Recordar".',
    documentsTitle: 'Documentos confirmados',
    documentsText:
      'Se guardan sin la imagen para que el mismo archivo no se cargue dos veces. Si lo borrás, lo podés volver a subir.',
    documentsEmpty: 'Todavía no confirmaste ningún documento.',
    uploaded: (moment: string) => `Subido el ${moment}`,
    keep: 'Borrar y conservar sus movimientos',
    delete: 'Borrar y mandar sus movimientos a la papelera',
    keepConfirm:
      'Se borra el documento. Sus movimientos quedan como si los hubieras cargado a mano, y el archivo se puede volver a subir.',
    deleteConfirm: (days: number) =>
      `Se borra el documento y sus movimientos van a la papelera, de donde se pueden recuperar durante ${days} días.`,
  },

  rates: {
    title: 'Tasas de cambio',
    text: 'Cuántos pesos vale un dólar, desde un día. Los informes las usan para mostrar todo en pesos o todo en dólares: cada movimiento se convierte con la tasa vigente el día en que se hizo. Cambiar una tasa no toca nada guardado.',
    empty: 'Todavía no cargaste ninguna tasa. Sin tasas, los informes muestran cada moneda por separado.',
    validFrom: 'Desde el',
    arsPerUsd: 'Pesos por dólar',
    arsPerUsdHint: 'La cotización que elijas: oficial, MEP, la de tu tarjeta.',
    row: (rate: string) => `${rate} pesos por dólar`,
    newTitle: 'Nueva tasa',
    invalid: 'Escribí cuántos pesos vale un dólar, por ejemplo 1250,50.',
    deleteConfirm: 'Se borra la tasa. Los informes dejan de usarla.',
    duplicate: 'Ya hay una tasa que empieza ese día: corregí esa.',
  },

  recurrings: {
    title: 'Movimientos fijos',
    text: 'Lo que pagás o cobrás todos los meses: alquiler, sueldo, servicios, suscripciones. La app avisa si uno no apareció o cambió mucho, y los suma a la proyección de Informes.',
    empty:
      'Todavía no marcaste ningún movimiento fijo. Abrí un movimiento y tocá "Es un movimiento fijo", o aceptá una sugerencia cuando aparezca.',
    states: {
      seen: 'Llegó',
      changed: 'Cambió mucho',
      late: 'No apareció',
      expected: 'Todavía no llegó',
      paused: 'En pausa',
    } satisfies Record<RecurringState, string>,
    expectedOn: (date: string, amount: string) => `Se espera el ${date}, por ${amount}`,
    seenAmount: (amount: string) => `Este mes: ${amount}`,
    useSeen: 'Usar este monto de ahora en más',
    pause: 'Pausar',
    resume: 'Reanudar',
    deleteConfirm: (name: string) =>
      `Se borra el fijo "${name}". Sus movimientos quedan como están, solo pierden la marca.`,
    name: 'Nombre',
    expectedAmount: 'Monto esperado',
    day: 'Día del mes',
    dayHint: 'El día en que se paga. En los meses más cortos vale el último día.',
    suggestionsTitle: 'Parecen fijos',
    suggestionsText: 'Se pagaron una vez por mes, por un monto parecido, varios meses seguidos. Vos decidís.',
    suggestion: (amount: string, months: number) => `${amount} · ${months} meses seguidos`,
    accept: 'Es fijo',
    reject: 'No es fijo',
    ignoredTitle: 'No son fijos',
    ignoredText: 'Los marcaste como no fijos: no se vuelven a sugerir.',
    unignore: 'Volver a sugerir',
    attention: (count: number) =>
      count === 1
        ? 'Un movimiento fijo no apareció o cambió mucho'
        : `${count} movimientos fijos no aparecieron o cambiaron mucho`,
    mark: 'Es un movimiento fijo',
    markHint: 'Se espera todos los meses por este monto. Te avisa si no aparece o cambia mucho.',
    marked: 'Marcado como movimiento fijo.',
    isFixed: 'Es un movimiento fijo.',
    seeFixed: 'Ver movimientos fijos',
  },

  items: {
    title: (count: number) => (count === 1 ? 'Productos: 1' : `Productos: ${count}`),
    add: 'Agregar el detalle de productos',
    addLine: 'Agregar producto',
    remove: 'Quitar este producto',
    product: 'Producto',
    group: 'Grupo',
    quantity: 'Cantidad',
    quantityShort: 'Cant.',
    amount: 'Monto',
    onReceipt: (text: string) => `En el ticket: ${text}`,
    sum: (amount: string) => `Suman ${amount}.`,
    difference: (amount: string) =>
      `Diferencia con el total: ${amount} (descuentos o renglones que no son productos).`,
    incomplete: 'Cada producto necesita un nombre y un monto. Un descuento va con signo menos.',
  },

  productGroups: PRODUCT_GROUP_LABELS,

  more: {
    title: 'Más',
    accounts: 'Cuentas',
    categories: 'Categorías',
    cards: 'Tarjetas: cierres y vencimientos',
    institutions: 'Bancos y tarjetas',
    tags: 'Etiquetas',
    trash: 'Papelera',
    pending: 'Pendientes de revisión',
    data: 'Respaldo, importación y exportación',
    password: 'Cambiar mi contraseña',
    users: 'Usuarios',
    recurrings: 'Movimientos fijos',
    remembered: 'Lo que la app recuerda',
    rates: 'Tasas de cambio',
  },

  data: {
    title: 'Respaldo y datos',
    backupTitle: 'Respaldo completo',
    backupText:
      'Una copia exacta de todo, para restaurar. Además de la copia automática en Drive, podés bajar una cuando quieras.',
    backupDownload: 'Descargar respaldo',
    drive: {
      title: 'Copia automática en Google Drive',
      text: (fileName: string) =>
        `Una vez por día, cuando usás la app, el respaldo completo se guarda en tu Drive como ${fileName}. Es siempre el mismo archivo; Drive guarda las versiones anteriores por un tiempo.`,
      unavailable:
        'Esta instalación todavía no tiene Google Drive configurado. Lo configura una sola vez quien administra la app, siguiendo docs/RESPALDO_DRIVE.md.',
      notConnected:
        'Todavía no conectaste tu Drive. Vas a la página de Google, elegís tu cuenta y aceptás; la app solo puede ver y tocar el archivo que ella misma crea.',
      connect: 'Conectar mi Google Drive',
      connecting: 'Abriendo Google…',
      disconnect: 'Desconectar',
      disconnectConfirm:
        'La app deja de copiar tu respaldo a Drive. Las copias que ya están en tu Drive quedan ahí.',
      results: {
        connected: 'Drive conectado. Ya se guardó la primera copia.',
        refused: 'No diste el permiso en Google, así que no se conectó nada.',
        failed: 'No se pudo conectar con Google Drive. Probá de nuevo.',
      } satisfies Record<DriveConnectResult, string>,
      lastCopy: (when: string) => `Última copia: ${when}.`,
      noCopy: 'Todavía no hay ninguna copia en Drive.',
      copyNow: 'Copiar ahora',
      copying: 'Copiando…',
      errors: {
        not_authorized:
          'Google rechazó el permiso: puede haberse vencido o revocado. Desconectá y volvé a conectar tu Drive.',
        unavailable: 'No se pudo llegar a Google Drive. Se vuelve a intentar sola en una hora.',
      } satisfies Record<DriveBackupError, string>,
      attention: 'La copia en Google Drive no se está haciendo',
    },
    restoreTitle: 'Restaurar un respaldo',
    restoreText:
      'Reemplaza todos tus datos actuales por los del archivo. Los de otros usuarios no se tocan. No se puede deshacer.',
    restoreConfirm: 'Entiendo que se reemplazan todos mis datos actuales',
    restoreAction: 'Restaurar',
    restoreDone: (count: number) => `Respaldo restaurado: ${count} registros.`,
    integrityTitle: 'Chequeo de integridad',
    integrityText: 'Busca datos que apunten a algo que ya no existe.',
    integrityAction: 'Revisar',
    integrityOk: 'Todo en orden: no hay referencias rotas.',
    integrityBroken: (count: number) => `Se encontraron ${count} referencias rotas.`,
    exportTitle: 'Exportar movimientos',
    exportText: 'Para abrir en Excel o analizar por tu cuenta. El mismo formato sirve para importar.',
    exportXlsx: 'Descargar Excel',
    exportCsv: 'Descargar CSV',
    importTitle: 'Importar movimientos',
    importText:
      'Desde un Excel o CSV con las columnas de la plantilla. Primero ves una vista previa; no se guarda nada hasta que confirmes.',
    template: 'Descargar plantilla',
    chooseFile: 'Elegir archivo',
    preview: {
      summary: (valid: number, total: number) => `${valid} de ${total} filas listas para importar`,
      missingHeaders: (headers: string) => `Faltan columnas obligatorias: ${headers}`,
      unknownHeaders: (headers: string) => `Columnas que se ignoran: ${headers}`,
      duplicates: (count: number) => `${count} filas coinciden con movimientos que ya existen`,
      includeDuplicates: 'Importar también las filas que parecen duplicadas',
      newCategories: (names: string) => `Categorías nuevas: ${names}`,
      newTags: (names: string) => `Etiquetas nuevas: ${names}`,
      createMissing: 'Crear las categorías y etiquetas que faltan',
      accountsTitle: 'Cuentas que no existen',
      accountsText:
        'El archivo nombra cuentas que la app no tiene. Decí a cuál corresponde cada una; si no, esas filas no se importan.',
      accountIs: (name: string) => `"${name}" es`,
      accountSkip: 'No importar esas filas',
      categoriesTitle: 'Categorías que no existen',
      categoriesText: 'Podés crearlas como vienen o usar una categoría que ya tenés.',
      categoryIs: (path: string, kind: string) => `"${path}" (${kind.toLowerCase()})`,
      categoryCreate: 'Crearla nueva',
      line: (line: number) => `Fila ${line}`,
      confirm: (count: number) => `Importar ${count} movimientos`,
      nothing: 'No hay filas para importar.',
    },
    importDone: (count: number) => `Se importaron ${count} movimientos.`,
  },

  /** What to show for each error code the API can return. */
  errors: {
    VALIDATION: 'Hay datos que revisar.',
    NOT_FOUND: 'Eso ya no existe. Actualizá la pantalla.',
    CONFLICT: 'No se puede hacer en este momento.',
    DUPLICATE: 'Ya existe uno con ese nombre.',
    IN_USE: 'Está en uso y no se puede borrar. Podés archivarlo.',
    UNAUTHORIZED: 'La sesión venció. Volvé a entrar.',
    INVALID_CREDENTIALS: 'Usuario o contraseña incorrectos.',
    FORBIDDEN: 'Eso solo lo puede hacer un administrador.',
    RATE_LIMITED: 'Demasiados intentos. Probá de nuevo en unos minutos.',
    PAYLOAD_TOO_LARGE: 'El archivo es demasiado grande.',
    INVALID_BACKUP:
      'El archivo no es un respaldo de esta app, es de una versión más nueva, o tiene datos que hoy son de otro usuario.',
    INTEGRITY: 'El respaldo tiene datos que apuntan a cosas que no incluye. No se restauró nada.',
    AI_PROVIDER: 'El servicio de lectura no respondió. Probá de nuevo.',
    AI_LIMIT:
      'Ya mandaste a leer todos los documentos que podés por hoy. Mañana se renueva; si necesitás más, pedíselo a quien administra la app.',
    INTERNAL: 'Algo falló en el servidor. Probá de nuevo.',
    NETWORK: 'No hay conexión con el servidor.',
  } satisfies Record<ErrorCode | 'NETWORK', string>,

  /** Field-level messages. Keys are the English messages the shared rules produce. */
  fieldMessages: {
    required: 'Completá este campo.',
    invalid: 'Revisá este campo.',
    amount: 'Escribí un monto mayor que cero, por ejemplo 15400,50.',
    'A transfer needs a destination account': 'Elegí la cuenta destino.',
    'Origin and destination must differ': 'La cuenta destino tiene que ser otra.',
    'Date cannot be in the future': 'La fecha no puede ser futura.',
    'Currency must match the account currency': 'La moneda tiene que ser la de la cuenta.',
    'A transfer between currencies needs both amounts': 'Entre monedas distintas hacen falta los dos montos.',
    'Account is archived': 'La cuenta está archivada.',
    'Category is archived': 'La categoría está archivada.',
    'Category is of a different kind': 'La categoría no corresponde a este tipo de movimiento.',
    'Categories can be nested up to 3 levels': 'Las categorías admiten hasta tres niveles.',
    'Institution does not exist': 'Ese banco o tarjeta no existe.',
    'Institution is archived': 'Ese banco o tarjeta está archivado.',
    'Only credit cards have a card brand': 'Solo las tarjetas de crédito llevan marca.',
    'Account is not a credit card': 'La cuenta no es una tarjeta de crédito.',
    'The due date must be after the closing date': 'El vencimiento tiene que ser después del cierre.',
    'Only purchases go in installments': 'Solo un egreso se paga en cuotas.',
    'A purchase in installments cannot be split': 'Una compra en cuotas no se divide entre categorías.',
    'Installments are for credit cards': 'Las cuotas son para tarjetas de crédito.',
    'A transfer cannot have products': 'Una transferencia no lleva productos.',
    'Attach the statement file': 'Elegí el archivo del resumen.',
    'Only PDF, Excel (.xlsx) and CSV files are accepted':
      'El archivo tiene que ser PDF, Excel (.xlsx) o CSV.',
    'Old Excel files (.xls) are not accepted: save it as .xlsx or CSV':
      'Es un Excel viejo (.xls). Abrilo y guardalo como .xlsx o CSV, o bajalo de nuevo en otro formato.',
    'The spreadsheet could not be read': 'No se pudo abrir el Excel. Probá bajarlo de nuevo o en CSV.',
    'The file has too many rows for a statement': 'El archivo tiene demasiadas filas para ser un resumen.',
    'The file has no text': 'El archivo está vacío.',
    'The PDF is protected with a password': 'El PDF tiene contraseña: escribila abajo.',
    'The PDF password is wrong': 'La contraseña del PDF no es correcta.',
    'The PDF has too many pages for a statement': 'El PDF tiene demasiadas páginas para ser un resumen.',
    'The PDF could not be read': 'No se pudo abrir el PDF. Probá descargarlo de nuevo del banco.',
    'The PDF has no text: it is a scanned image':
      'El PDF es una imagen escaneada, sin texto. Podés sacar capturas solo de la parte de los consumos y subirlas como "Captura de una app".',
    'The file has too much text for a statement': 'El archivo tiene demasiado texto para ser un resumen.',
    'Only a card statement brings closing dates': 'Solo un resumen de tarjeta trae fechas de cierre.',
    'Only an expense can be a refund': 'Solo un egreso puede ser una devolución.',
    'A refund is not paid in installments': 'Una devolución no va en cuotas.',
    'There are no installments left to create': 'Esa es la última cuota: no quedan cuotas por crear.',
    'Password is too short': `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    'Wrong password': 'Esa no es tu contraseña actual.',
    'Account does not exist': 'Esa cuenta no existe.',
    'Category does not exist': 'Esa categoría no existe.',
    'Only an income or an expense can be fixed': 'Solo un ingreso o un egreso puede ser fijo.',
    'Give the transaction a description to mark it as fixed':
      'Ponele una descripción al movimiento (por ejemplo, el comercio) para marcarlo como fijo.',
  } as Record<string, string>,

  importIssues: {
    required: 'falta el dato',
    invalid_date: 'fecha inválida',
    future_date: 'fecha futura',
    invalid_type: 'tipo desconocido (egreso, ingreso o transferencia)',
    invalid_amount: 'monto inválido',
    invalid_currency: 'moneda desconocida (ARS o USD)',
    invalid_installment: 'cuota inválida (por ejemplo 3/6)',
    category_too_deep: 'más de tres niveles',
    transfer_needs_destination: 'falta la cuenta destino',
    transfer_has_category: 'una transferencia no lleva categoría',
    destination_without_transfer: 'solo las transferencias tienen cuenta destino',
    same_account: 'origen y destino son la misma cuenta',
    unknown_account: 'la cuenta no existe: elegí arriba a cuál corresponde, o creala antes de importar',
    archived_account: 'la cuenta está archivada',
    currency_mismatch: 'la moneda no es la de la cuenta',
    unknown_category: 'la categoría no existe',
    unknown_tag: 'la etiqueta no existe',
    destination_amount_required: 'falta el monto destino (monedas distintas)',
    destination_amount_not_allowed: 'el monto destino solo va entre monedas distintas',
  } satisfies Record<ImportIssueCode, string>,
};
