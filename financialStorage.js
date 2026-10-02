import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@velzia/financial-data-v1';

function isNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function isFinancialData(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.version === 1 &&
    typeof value.income === 'string' &&
    Number.isFinite(Number(value.income)) &&
    typeof value.expenses === 'string' &&
    Number.isFinite(Number(value.expenses)) &&
    typeof value.monthly === 'string' &&
    Number.isFinite(Number(value.monthly)) &&
    Array.isArray(value.debts) &&
    value.debts.every(
      debt =>
        debt !== null &&
        typeof debt === 'object' &&
        typeof debt.name === 'string' &&
        isNonNegativeNumber(debt.balance) &&
        isNonNegativeNumber(debt.payment) &&
        isNonNegativeNumber(debt.rate),
    )
  );
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

  if (!isFinancialData(parsedValue)) {
    throw new Error('Los datos guardados tienen un formato inválido. No se modificaron.');
  }

  return parsedValue;
}

export async function saveFinancialData({income, expenses, debts, monthly}) {
  const data = {
    version: 1,
    income,
    expenses,
    debts,
    monthly,
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
