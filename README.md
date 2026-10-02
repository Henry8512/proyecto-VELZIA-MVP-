# VELZIA — MVP

Prototipo funcional inicial de la app VELZIA para organizar deudas, crear escenarios de pago y visualizar vencimientos.

## Ejecutar

1. Instala Node.js LTS.
2. En esta carpeta ejecuta `npm install`.
3. Ejecuta `npx expo start`.
4. Escanea el QR con Expo Go o abre el simulador Android/iOS.

## Alcance V0.1
- Onboarding
- Registro de ingreso/gastos
- Alta de deudas
- Persistencia local de ingresos, gastos, deudas y monto mensual del plan
- Resumen financiero
- Orden de referencia por intereses
- Simulador básico
- Calendario de pagos
- Progreso

Los datos financieros se guardan en el dispositivo y se recuperan al volver a abrir la app. No se sincronizan entre dispositivos ni se respaldan en una cuenta; desinstalar la app puede borrarlos. El registro de pagos individuales todavía no forma parte de este prototipo: se conserva la cuota mensual asociada a cada deuda.

Los cálculos son demostrativos; antes de producción hay que implementar fórmulas financieras exactas, protección adecuada de datos sensibles, autenticación, notificaciones, registro de pagos y monetización.
