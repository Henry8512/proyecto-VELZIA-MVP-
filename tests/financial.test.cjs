const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const babel = require('@babel/core');

function loadModule(relativePath, mockedRequire = require) {
  const filename = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = babel.transformSync(source, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
    filename,
  }).code;
  const module = {exports: {}};

  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    require: mockedRequire,
    JSON,
    Number,
    Array,
    Object,
    Date,
    Math,
    Error,
  }, {filename});

  return module.exports;
}

const finance = loadModule('financialLogic.js');
let storedValue = null;
let writeCount = 0;
const storage = loadModule('financialStorage.js', packageName => {
  if (packageName === './financialLogic') {
    return finance;
  }
  assert.equal(packageName, '@react-native-async-storage/async-storage');
  return {
    __esModule: true,
    default: {
      getItem: async () => storedValue,
      setItem: async (_key, value) => {
        storedValue = value;
        writeCount += 1;
      },
    },
  };
});

function debt(overrides = {}) {
  return {
    id: 'debt-1',
    name: 'Tarjeta',
    balance: 1000,
    initialBalance: 1000,
    payment: 100,
    rate: 0,
    dueDay: 10,
    payments: [],
    ...overrides,
  };
}

function validData(overrides = {}) {
  return {
    version: 2,
    profileName: 'Ana',
    income: '1000000',
    expenseCategories: {
      housing: '200000',
      food: '100000',
      services: '50000',
      transport: '50000',
      other: '0',
    },
    monthly: '200000',
    onboardingComplete: true,
    debts: [debt()],
    ...overrides,
  };
}

test('suma categorías de gastos', () => {
  assert.equal(finance.sumExpenseCategories({
    housing: '200000',
    food: '100000',
    services: '50000',
    transport: '25000',
    other: '5000',
  }), 380000);
});

test('acepta tasas anuales decimales válidas y rechaza tasas fuera del rango', () => {
  assert.equal(finance.isValidAnnualRate('19.9'), true);
  assert.equal(finance.isValidAnnualRate('0'), true);
  assert.equal(finance.isValidAnnualRate('1000'), true);
  assert.equal(finance.isValidAnnualRate('1000.01'), false);
  assert.equal(finance.isValidAnnualRate('-1'), false);
  assert.equal(finance.isValidAnnualRate('19.99999'), false);
  assert.equal(finance.isValidAnnualRate(''), false);
});

test('el progreso refleja únicamente la diferencia entre saldo inicial y actual', () => {
  const progress = finance.calculateDebtProgress([
    debt(),
    debt({id: 'debt-2', name: 'Crédito', balance: 500, initialBalance: 700}),
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(progress)), {
    initialDebt: 1700,
    currentDebt: 1500,
    principalReduced: 200,
    percentage: 12,
    paymentCount: 0,
  });
  assert.equal(finance.calculateDebtProgress([]).percentage, 0);
});

test('el calendario genera vencimientos reales y omite deudas sin fecha', () => {
  const startDate = new Date(2027, 0, 15);
  const events = finance.buildPaymentCalendar([
    debt({dueDay: 10}),
    debt({id: 'no-date', dueDay: null}),
    debt({id: 'paid-off', balance: 0}),
  ], startDate, 90);
  assert.deepEqual(JSON.parse(JSON.stringify(events.map(event => [
    event.name,
    event.dueDate.getFullYear(),
    event.dueDate.getMonth(),
    event.dueDate.getDate(),
  ]))), [
    ['Tarjeta', 2027, 1, 10],
    ['Tarjeta', 2027, 2, 10],
    ['Tarjeta', 2027, 3, 10],
  ]);
});

test('el calendario ajusta vencimientos del día 31 al último día de meses más cortos', () => {
  const events = finance.buildPaymentCalendar([
    debt({dueDay: 31}),
  ], new Date(2027, 1, 1), 60);
  assert.deepEqual(JSON.parse(JSON.stringify(events.map(event => [
    event.dueDate.getFullYear(),
    event.dueDate.getMonth(),
    event.dueDate.getDate(),
  ]))), [
    [2027, 1, 28],
    [2027, 2, 31],
  ]);
});

test('la simulación usa el presupuesto y respeta saldo sin interés', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(finance.simulateDebtPayoff(
    [debt({payment: 100})],
    '300',
  ))), {
    status: 'payoff',
    months: 4,
    interest: 0,
    totalPaid: 1000,
  });
});

test('la simulación aplica la tasa anual convertida a interés mensual', () => {
  const result = finance.simulateDebtPayoff([debt({rate: 12, payment: 100})], '2000');
  assert.equal(result.status, 'payoff');
  assert.equal(result.months, 1);
  assert.equal(result.interest, 10);
  assert.equal(result.totalPaid, 1010);
});

test('la simulación indica cuando el presupuesto no cubre las cuotas mínimas', () => {
  const result = finance.simulateDebtPayoff([
    debt({payment: 60}),
    debt({id: 'debt-2', balance: 500, initialBalance: 500, payment: 50}),
  ], '100');
  assert.equal(result.status, 'below-minimums');
  assert.equal(result.minimumRequired, 110);
});

test('la simulación valida el presupuesto y deudas sin saldo', () => {
  assert.equal(finance.simulateDebtPayoff([debt({balance: 0})], '100').status, 'no-debt');
  assert.equal(finance.simulateDebtPayoff([debt()], '0').status, 'invalid-budget');
});

test('la simulación limita resultados que no se liquidan en el horizonte', () => {
  const result = finance.simulateDebtPayoff([
    debt({balance: 1000, payment: 1, rate: 1000}),
  ], '1');
  assert.equal(result.status, 'over-50-years');
  assert.equal(result.months, 600);
});

test('la persistencia guarda y recupera el formato actual', async () => {
  storedValue = null;
  assert.equal(await storage.loadFinancialData(), null);
  const data = validData();
  await storage.saveFinancialData(data);
  assert.deepEqual(JSON.parse(JSON.stringify(await storage.loadFinancialData())), data);
});

test('la migración conserva datos de la versión previa sin inventar vencimientos', async () => {
  storedValue = JSON.stringify({
    version: 1,
    income: '1300000',
    expenses: '600000',
    monthly: '250000',
    debts: [{
      name: 'Tarjeta antigua',
      balance: 500000,
      payment: 50000,
      rate: 20,
    }],
  });
  const migrated = await storage.loadFinancialData();
  assert.equal(migrated.version, 2);
  assert.equal(migrated.expenseCategories.other, '600000');
  assert.equal(migrated.debts[0].balance, 500000);
  assert.equal(migrated.debts[0].initialBalance, 500000);
  assert.equal(migrated.debts[0].dueDay, null);
  assert.deepEqual(JSON.parse(JSON.stringify(migrated.debts[0].payments)), []);
});

test('los datos corruptos o inválidos se rechazan sin sobrescribir el almacenamiento', async () => {
  const writesBeforeInvalid = writeCount;
  storedValue = '{';
  await assert.rejects(storage.loadFinancialData());

  storedValue = JSON.stringify(validData({
    debts: [debt({balance: -1})],
  }));
  await assert.rejects(storage.loadFinancialData());

  await assert.rejects(storage.saveFinancialData(validData({
    expenseCategories: {...validData().expenseCategories, food: '-1'},
  })));
  assert.equal(writeCount, writesBeforeInvalid);
});
