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
- Alta, edición y eliminación de deudas, con vencimiento opcional
- Registro de pagos con reducción de capital declarada por el usuario
- Persistencia local de perfil, gastos, deudas, vencimientos, pagos y presupuesto
- Resumen financiero
- Orden de referencia por tasa anual
- Simulador mensual orientativo que considera tasa nominal o efectiva anual, cuotas mínimas y estrategias avalancha o bola de nieve
- Calendario generado a partir del día de vencimiento de cada deuda
- Seguimiento del saldo respecto al saldo inicial registrado
- Validación de montos en pesos enteros, tasas anuales decimales y vencimientos entre los días 1 y 31

Los datos financieros se guardan en el dispositivo y se recuperan al volver a abrir la app. Los datos existentes de la versión anterior se migran; sus fechas de vencimiento quedan sin definir, ya que no estaban registradas. Los datos no se sincronizan entre dispositivos ni se respaldan en una cuenta; desinstalar la app puede borrarlos. La pantalla inicial informa esta limitación.

El calendario ajusta los vencimientos de los días 29, 30 o 31 al último día del mes cuando corresponde.

El simulador convierte las tasas nominales anuales dividiéndolas entre 12 y las tasas efectivas anuales a su equivalente mensual; el plan ordena las deudas usando esa tasa mensual equivalente. El método avalancha es la opción predeterminada y prioriza la tasa mayor; bola de nieve prioriza el saldo menor. Ambas estrategias cubren primero las cuotas mínimas registradas. El cálculo no incluye comisiones, seguros ni cambios de tasa y muestra una advertencia si el presupuesto supera el dinero disponible después de gastos. Ingresa la tasa de interés indicada por el acreedor, no la CAE como si fuera una tasa de interés. Al registrar un pago, ingresa la reducción de capital según el estado de cuenta; el importe pagado no se descuenta automáticamente del saldo. El progreso compara los saldos actuales con los saldos iniciales registrados y no atribuye cambios a pagos, intereses o cargos automáticamente. El calendario no envía notificaciones.

## Pruebas

Ejecuta `npm test` para validar cálculos, calendario, migración y persistencia. La suite incluye escenarios sintéticos de comparación de tasas, estrategias y liquidación de varias deudas. Aún no se han contrastado los resultados con cartolas reales anonimizadas; las cuotas, los ciclos, los cargos y el redondeo de cada acreedor pueden diferir del modelo mensual.

### Pruebas de interfaz móvil desde Windows

- Para probar Android sin un teléfono, instala Android Studio, configura un dispositivo virtual (AVD) e inicia `npx expo start`; presiona `a` para abrir el proyecto en el emulador. La guía oficial está en [Expo: Android Studio Emulator](https://docs.expo.dev/workflow/android-studio-emulator/). Si el proyecto usa módulos nativos fuera de Expo Go, crea una development build en vez de usar Expo Go.
- `npm run web` permite revisar navegación y diseño adaptable en el navegador, pero no sustituye una prueba Android/iOS nativa.
- Windows no puede ejecutar localmente el iOS Simulator: requiere Xcode en macOS. Para probar iOS sin Mac, se puede crear una build de simulador con [EAS Build](https://docs.expo.dev/build-reference/simulators/) y ejecutarla en un servicio remoto compatible, por ejemplo [Maestro Cloud](https://docs.maestro.dev/maestro-cloud/run-tests-on-maestro-cloud.md). La build por sí sola no ejecuta el simulador; los servicios cloud pueden requerir una cuenta o plan de pago.
- Antes de instalar Android Studio, verifica espacio en disco, RAM y que la virtualización de hardware esté habilitada. En este PC la virtualización está activa, pero hay aproximadamente 15 GB de RAM y 31 GB libres; el espacio es limitado para Android Studio, imágenes de sistema y builds, por lo que conviene liberar espacio primero.

Antes de producción siguen pendientes la protección adecuada de datos sensibles, autenticación, sincronización y copias de seguridad, notificaciones y monetización.

`npm audit --omit=dev` informa 24 vulnerabilidades transitivas (16 altas y 8 moderadas) en dependencias de Expo/Metro, entre ellas `node-forge`, `braces` y `uuid`. Las correcciones automáticas propuestas degradan Expo o React Native a versiones incompatibles con esta app; no se aplicaron overrides de criptografía ni esos downgrades. El informe no determina por sí solo si cada dependencia vulnerable es alcanzable en la app distribuida. No publiques hasta revisar los avisos y verificar una solución compatible; vuelve a ejecutar la auditoría antes de cada distribución.
