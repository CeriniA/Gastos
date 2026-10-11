import type { AccountType, CategoryKind, ErrorCode, ImportIssueCode, TransactionType } from '@gastos/shared';

/**
 * Every text the user reads lives in this file. Components never hard-code
 * Spanish strings, so wording is changed in one place.
 */
export const es = {
  appName: 'Gastos',

  nav: { home: 'Inicio', transactions: 'Movimientos', add: 'Agregar', reports: 'Informes', more: 'Más' },

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
  },

  accounts: {
    title: 'Cuentas',
    empty: 'Todavía no hay cuentas. Creá la primera para empezar a cargar movimientos.',
    name: 'Nombre',
    type: 'Tipo',
    currency: 'Moneda',
    newTitle: 'Nueva cuenta',
    fixedHint: 'El tipo y la moneda no se pueden cambiar después.',
  },

  categories: {
    title: 'Categorías',
    empty: 'No hay categorías de este tipo.',
    name: 'Nombre',
    parent: 'Dentro de',
    rootOption: 'Nivel principal',
    newTitle: 'Nueva categoría',
    depthHint: 'Hasta tres niveles.',
  },

  reports: {
    title: 'Informes',
    pending:
      'Los informes por categoría, cuenta y evolución mensual se construyen en la etapa 4. El balance del mes ya está en Inicio.',
  },

  more: {
    title: 'Más',
    accounts: 'Cuentas',
    categories: 'Categorías',
    data: 'Respaldo, importación y exportación',
  },

  data: {
    title: 'Respaldo y datos',
    backupTitle: 'Respaldo completo',
    backupText:
      'Una copia exacta de todo, para restaurar. El plan gratuito no hace copias por vos: bajá una cada tanto.',
    backupDownload: 'Descargar respaldo',
    restoreTitle: 'Restaurar un respaldo',
    restoreText: 'Reemplaza todos los datos actuales por los del archivo. No se puede deshacer.',
    restoreConfirm: 'Entiendo que se reemplazan todos los datos actuales',
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
    RATE_LIMITED: 'Demasiados intentos. Probá de nuevo en unos minutos.',
    PAYLOAD_TOO_LARGE: 'El archivo es demasiado grande.',
    INVALID_BACKUP: 'El archivo no es un respaldo de esta app, o es de una versión más nueva.',
    INTEGRITY: 'El respaldo tiene datos que apuntan a cosas que no incluye. No se restauró nada.',
    AI_PROVIDER: 'El servicio de lectura no respondió. Probá de nuevo.',
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
    unknown_account: 'la cuenta no existe: creala antes de importar',
    archived_account: 'la cuenta está archivada',
    currency_mismatch: 'la moneda no es la de la cuenta',
    unknown_category: 'la categoría no existe',
    unknown_tag: 'la etiqueta no existe',
    destination_amount_required: 'falta el monto destino (monedas distintas)',
    destination_amount_not_allowed: 'el monto destino solo va entre monedas distintas',
  } satisfies Record<ImportIssueCode, string>,
};
