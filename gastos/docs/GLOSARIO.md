# Glosario

Cada concepto con su nombre en pantalla y en el código. Usar siempre estos términos.

| En pantalla                                                         | En el código                                                 | Notas                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| Movimiento                                                          | `transaction`                                                |                                               |
| Ingreso / Egreso / Transferencia                                    | `income` / `expense` / `transfer`                            | `TransactionType`                             |
| Monto                                                               | `amountCents`                                                | Entero en centavos                            |
| Moneda                                                              | `currency`                                                   | `ARS`, `USD`                                  |
| Fecha                                                               | `date`                                                       | Día del consumo o ingreso                     |
| Fecha de pago                                                       | `paymentDate`                                                | Base del balance mensual                      |
| Cuenta                                                              | `account`                                                    |                                               |
| Cuenta destino                                                      | `toAccountId`                                                | Solo transferencias                           |
| Monto destino                                                       | `toAmountCents`                                              | Solo entre monedas distintas                  |
| Efectivo / Cuenta bancaria / Billetera virtual / Tarjeta de crédito | `cash` / `bank` / `wallet` / `credit_card`                   | `AccountType`                                 |
| Categoría                                                           | `category`                                                   |                                               |
| Categoría padre                                                     | `parentId`                                                   |                                               |
| Nivel                                                               | `depth`                                                      | 1 a 3; se calcula, no se guarda               |
| Tipo de categoría                                                   | `kind`                                                       | `income` o `expense`                          |
| Etiqueta                                                            | `tag`                                                        |                                               |
| División                                                            | `split`                                                      | Parte de un movimiento con su categoría       |
| Ítem                                                                | `item`                                                       | Renglón de un ticket                          |
| Descripción                                                         | `description`                                                |                                               |
| Nota                                                                | `note`                                                       |                                               |
| Borrador / Confirmado / Proyectado                                  | `draft` / `confirmed` / `projected`                          | `TransactionStatus`                           |
| Origen                                                              | `source`                                                     | `manual`, `document`, `import`, `installment` |
| Editado                                                             | `edited`                                                     |                                               |
| Papelera                                                            | `deletedAt`                                                  |                                               |
| Archivada                                                           | `archived`                                                   |                                               |
| Documento                                                           | `document`                                                   | Archivo subido                                |
| Ticket / Captura / Resumen de tarjeta                               | `receipt` / `screenshot` / `card_statement`                  | `DocumentKind`                                |
| Procesando / Listo / Confirmado / Descartado / Error                | `processing` / `ready` / `confirmed` / `discarded` / `error` | `DocumentStatus`                              |
| Extracción                                                          | `extraction`                                                 | Lo que devuelve la IA                         |
| Lector de documentos                                                | `AiExtractor`                                                |                                               |
| Comercio                                                            | `merchant`                                                   |                                               |
| Regla de categoría                                                  | `categoryRule`                                               | Comercio → categoría                          |
| Cuota                                                               | `installment`                                                | `number` de `total`                           |
| Plan de cuotas                                                      | `installmentPlan`                                            |                                               |
| Período de tarjeta                                                  | `cardPeriod`                                                 |                                               |
| Cierre                                                              | `closingDate`                                                |                                               |
| Vencimiento                                                         | `dueDate`                                                    |                                               |
| Pago mínimo                                                         | `minimumPaymentCents`                                        |                                               |
| Movimiento fijo                                                     | `recurring`                                                  |                                               |
| Tasa de cambio                                                      | `exchangeRate`                                               | `arsPerUsd`, `validFrom`                      |
| Balance del mes                                                     | `MonthSummary`                                               |                                               |
| Respaldo                                                            | `backup`                                                     |                                               |
| Chequeo de integridad                                               | `integrity`                                                  |                                               |
| Referencia rota                                                     | `BrokenReference`                                            |                                               |
| Importación / Exportación                                           | `import` / `export`                                          | Módulo `spreadsheet`                          |
| Vista previa                                                        | `preview`                                                    |                                               |
| Duplicado                                                           | `duplicate`                                                  |                                               |
| Pendientes                                                          | `pending`                                                    | Bandeja de decisiones                         |
| Presupuesto                                                         | `budget`                                                     | Segunda versión                               |
| Migración                                                           | `migration`                                                  |                                               |
| Datos iniciales                                                     | `seed`                                                       |                                               |
