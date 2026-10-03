# VELZIA — MVP

Prototipo funcional inicial de la app VELZIA para organizar deudas, crear escenarios de pago y visualizar vencimientos.

La app usa Expo SDK 57. La pantalla de inicio nativa se configura mediante el plugin `expo-splash-screen`.

## Ejecutar

1. Instala Node.js LTS.
2. En esta carpeta ejecuta `npm install`.
3. Ejecuta `npx expo start`.
4. Escanea el QR con Expo Go o abre el simulador Android/iOS.

## Alcance V0.2
- Onboarding
- Registro de ingreso, nombre y gastos por categoría
- Alta, edición y eliminación de deudas
- Registro de pagos con reducción de capital declarada por el usuario
- Persistencia local de perfil, gastos, deudas, vencimientos, pagos y presupuesto
- Resumen financiero
- Orden de referencia por tasa anual
- Simulador mensual orientativo que considera tasa anual, cuotas mínimas y pagos tipo avalancha
- Calendario generado a partir del día de vencimiento de cada deuda
- Seguimiento del saldo respecto al saldo inicial registrado
- Validación de montos en pesos enteros, tasas anuales decimales y vencimientos entre los días 1 y 31

Los datos financieros se guardan en el dispositivo y se recuperan al volver a abrir la app. Los datos existentes de la versión anterior se migran; sus fechas de vencimiento quedan sin definir, ya que no estaban registradas. Los datos no se sincronizan entre dispositivos ni se respaldan en una cuenta; desinstalar la app puede borrarlos.

El calendario ajusta los vencimientos de los días 29, 30 o 31 al último día del mes cuando corresponde.

El simulador asume una tasa anual fija dividida en 12 meses y no incluye comisiones, seguros ni cambios de tasa. Al registrar un pago, ingresa la reducción de capital según el estado de cuenta; el importe pagado no se descuenta automáticamente del saldo. El calendario no envía notificaciones.

## Pruebas

Ejecuta `npm test` para validar cálculos, calendario, migración y persistencia.

Antes de producción siguen pendientes la protección adecuada de datos sensibles, autenticación, sincronización y copias de seguridad, notificaciones y monetización.

`npm audit --omit=dev` informa 24 vulnerabilidades transitivas (16 altas y 8 moderadas) en dependencias de Expo/Metro, entre ellas `node-forge`, `braces` y `uuid`. Las correcciones automáticas propuestas degradan Expo o React Native a versiones incompatibles con esta app; no se aplicaron overrides de criptografía ni esos downgrades. El informe no determina por sí solo si cada dependencia vulnerable es alcanzable en la app distribuida. No publiques hasta revisar los avisos y verificar una solución compatible; vuelve a ejecutar la auditoría antes de cada distribución.
