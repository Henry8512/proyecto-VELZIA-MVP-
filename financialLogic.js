export function sumExpenseCategories(expenseCategories) {
  return Object.values(expenseCategories).reduce(
    (total, amount) => total + (Number(amount) || 0),
    0,
  );
}

export function isValidAnnualRate(value) {
  const normalized = String(value).trim();
  return /^\d{1,4}(?:\.\d{1,4})?$/.test(normalized) &&
    Number(normalized) >= 0 &&
    Number(normalized) <= 1000;
}

export function getMonthlyInterestRate(annualRate, rateType = 'nominal') {
  const rate = Number(annualRate);
  return rateType === 'effective'
    ? Math.pow(1 + rate / 100, 1 / 12) - 1
    : rate / 1200;
}

export function calculateDebtProgress(debts) {
  const initialDebt = debts.reduce((total, debt) => total + debt.initialBalance, 0);
  const currentDebt = debts.reduce((total, debt) => total + debt.balance, 0);
  const principalReduced = Math.max(0, initialDebt - currentDebt);

  return {
    initialDebt,
    currentDebt,
    principalReduced,
    percentage: initialDebt > 0
      ? Math.min(100, Math.round((principalReduced / initialDebt) * 100))
      : 0,
    paymentCount: debts.reduce((total, debt) => total + debt.payments.length, 0),
  };
}

export function buildPaymentCalendar(debts, fromDate = new Date(), daysAhead = 90) {
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + daysAhead);
  const events = [];

  debts.forEach(debt => {
    if (debt.balance <= 0 || debt.payment <= 0 || !debt.dueDay) {
      return;
    }

    for (let monthOffset = 0; monthOffset <= daysAhead / 28 + 2; monthOffset += 1) {
      const monthStart = new Date(start.getFullYear(), start.getMonth() + monthOffset, 1);
      const lastDayOfMonth = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        0,
      ).getDate();
      const dueDate = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        Math.min(debt.dueDay, lastDayOfMonth),
      );
      if (dueDate >= start && dueDate <= end) {
        events.push({
          id: `${debt.id}-${dueDate.getFullYear()}-${dueDate.getMonth() + 1}`,
          debtId: debt.id,
          name: debt.name,
          amount: debt.payment,
          dueDate,
        });
      }
    }
  });

  return events.sort((left, right) => left.dueDate - right.dueDate);
}

export function simulateDebtPayoff(debts, monthlyBudget, strategy = 'avalanche') {
  const budget = Number(monthlyBudget);
  const balances = debts.map(debt => ({
    name: debt.name,
    balance: Number(debt.balance),
    minimum: Number(debt.payment),
    monthlyRate: getMonthlyInterestRate(debt.rate, debt.rateType),
    rateType: debt.rateType || 'nominal',
  }));

  if (balances.every(debt => debt.balance === 0)) {
    return {status: 'no-debt', months: 0, interest: 0, totalPaid: 0};
  }

  if (!Number.isFinite(budget) || budget <= 0) {
    return {status: 'invalid-budget', months: 0, interest: 0, totalPaid: 0};
  }

  if (strategy !== 'avalanche' && strategy !== 'snowball') {
    return {status: 'invalid-strategy', months: 0, interest: 0, totalPaid: 0};
  }

  if (balances.some(debt =>
    !Number.isFinite(debt.balance) || debt.balance < 0 ||
    !Number.isFinite(debt.minimum) || debt.minimum < 0 ||
    !Number.isFinite(debt.monthlyRate) || debt.monthlyRate < 0 ||
    (debt.rateType !== 'nominal' && debt.rateType !== 'effective')
  )) {
    return {status: 'invalid-debt', months: 0, interest: 0, totalPaid: 0};
  }

  let totalInterest = 0;
  let totalPaid = 0;

  for (let month = 1; month <= 600; month += 1) {
    const activeDebts = balances.filter(debt => debt.balance > 0);
    if (activeDebts.length === 0) {
      return {
        status: 'payoff',
        months: month - 1,
        interest: Math.round(totalInterest),
        totalPaid: Math.round(totalPaid),
      };
    }

    const amountsDue = activeDebts.map(debt => {
      const interest = debt.balance * debt.monthlyRate;
      totalInterest += interest;
      debt.balance += interest;
      return {debt, due: debt.balance};
    });
    const minimumRequired = amountsDue.reduce(
      (total, item) => total + Math.min(item.debt.minimum, item.due),
      0,
    );

    if (budget + 0.000001 < minimumRequired) {
      return {
        status: 'below-minimums',
        months: 0,
        interest: Math.round(totalInterest),
        totalPaid: 0,
        minimumRequired: Math.ceil(minimumRequired),
      };
    }

    let remainingBudget = budget;
    amountsDue.forEach(({debt, due}) => {
      const payment = Math.min(debt.minimum, due, remainingBudget);
      debt.balance = Math.max(0, debt.balance - payment);
      remainingBudget -= payment;
      totalPaid += payment;
    });

    const targetOrder = balances
      .filter(debt => debt.balance > 0)
      .sort((left, right) => strategy === 'snowball'
        ? left.balance - right.balance
        : right.monthlyRate - left.monthlyRate);

    targetOrder.forEach(debt => {
      const payment = Math.min(debt.balance, remainingBudget);
      debt.balance = Math.max(0, debt.balance - payment);
      remainingBudget -= payment;
      totalPaid += payment;
    });
  }

  if (balances.every(debt => debt.balance === 0)) {
    return {
      status: 'payoff',
      months: 600,
      interest: Math.round(totalInterest),
      totalPaid: Math.round(totalPaid),
    };
  }

  return {status: 'over-50-years', months: 600, interest: Math.round(totalInterest), totalPaid: Math.round(totalPaid)};
}
