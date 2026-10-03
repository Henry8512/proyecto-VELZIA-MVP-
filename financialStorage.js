import AsyncStorage from '@react-native-async-storage/async-storage';
import {isValidAnnualRate} from './financialLogic';

const STORAGE_KEY = '@velzia/financial-data-v1';
const EXPENSE_CATEGORIES = ['housing', 'food', 'services', 'transport', 'other'];

function isAmount(value) {
  const amount = Number(value);
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isSafeInteger(amount) &&
    amount >= 0
  );
}

function isFinancialData(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.version === 2 &&
    typeof value.profileName === 'string' &&
    typeof value.onboardingComplete === 'boolean' &&
    isAmount(value.income) &&
    isAmount(value.monthly) &&
    value.expenseCategories !== null &&
    typeof value.expenseCategories === 'object' &&
    EXPENSE_CATEGORIES.every(category => isAmount(value.expenseCategories[category])) &&
    Array.isArray(value.debts) &&
    value.debts.every(
      debt =>
        debt !== null &&
        typeof debt === 'object' &&
        typeof debt.id === 'string' &&
        typeof debt.name === 'string' &&
        debt.name.trim() !== '' &&
        isAmount(String(debt.balance)) &&
        isAmount(String(debt.initialBalance)) &&
        isAmount(String(debt.payment)) &&
        isValidAnnualRate(debt.rate) &&
        (debt.rateType === undefined || debt.rateType === 'nominal' || debt.rateType === 'effective') &&
        (debt.dueDay === null ||
          (Number.isInteger(debt.dueDay) && debt.dueDay >= 1 && debt.dueDay <= 31)) &&
        Array.isArray(debt.payments) &&
        debt.payments.every(
          payment =>
            payment !== null &&
            typeof payment === 'object' &&
            typeof payment.id === 'string' &&
            isAmount(String(payment.amount)) &&
            isAmount(String(payment.principalApplied)) &&
            payment.principalApplied <= payment.amount &&
            typeof payment.date === 'string' &&
            !Number.isNaN(Date.parse(payment.date)),
        ),
    )
  );
}

function migrateFinancialData(value) {
  if (value?.version === 2) {
    return value;
  }

  if (
    value?.version !== 1 ||
    !isAmount(value?.income) ||
    !isAmount(value?.expenses) ||
    !isAmount(value?.monthly) ||
    !Array.isArray(value?.debts) ||
    !value.debts.every(debt =>
      debt !== null &&
      typeof debt === 'object' &&
      typeof debt.name === 'string' &&
      debt.name.trim() !== '' &&
      Number.isFinite(Number(debt.balance)) &&
      Number(debt.balance) >= 0 &&
      Number.isFinite(Number(debt.payment)) &&
      Number(debt.payment) >= 0 &&
      Number.isFinite(Number(debt.rate)) &&
      Number(debt.rate) >= 0 &&
      Number(debt.rate) <= 1000)
  ) {
    throw new Error('Los datos guardados tienen un formato inválido. No se modificaron.');
  }

  return {
    version: 2,
    profileName: '',
    onboardingComplete: true,
    income: String(value.income),
    monthly: String(value.monthly),
    expenseCategories: {
      housing: '0',
      food: '0',
      services: '0',
      transport: '0',
      other: String(value.expenses),
    },
    debts: value.debts.map((debt, index) => ({
      id: `legacy-${index + 1}`,
      name: debt.name,
      balance: Number(debt.balance),
      initialBalance: Number(debt.balance),
      payment: Number(debt.payment),
      rate: Number(debt.rate),
      rateType: 'nominal',
      dueDay: null,
      payments: [],
    })),
  };
}

export async function loadFinancialData() {
  const storedValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (storedValue === null) {
    return null;
  }

  let parsedValue;
  try {
    parsedValue = JSON.parse(storedValue);
  } catch {
    throw new Error('Los datos guardados no se pueden leer. No se modificaron.');
  }

  const migratedValue = migrateFinancialData(parsedValue);
  if (!isFinancialData(migratedValue)) {
    throw new Error('Los datos guardados tienen un formato inválido. No se modificaron.');
  }

  return parsedValue.version === 1
    ? {...migratedValue, _needsMigration: true}
    : migratedValue;
}

export async function saveFinancialData(data) {
  if (!isFinancialData(data)) {
    throw new Error('No se guardaron los cambios porque los datos financieros no son válidos.');
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
