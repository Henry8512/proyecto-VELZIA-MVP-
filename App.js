import React, {useEffect, useRef, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {loadFinancialData, saveFinancialData} from './financialStorage';
import {
  buildPaymentCalendar,
  calculateDebtProgress,
  isValidAnnualRate,
  simulateDebtPayoff,
  sumExpenseCategories,
} from './financialLogic';

const C = {
  navy: '#071A33',
  teal: '#10BFA8',
  mint: '#DDF8F2',
  bg: '#F5F8FC',
  text: '#10233D',
  muted: '#6E7B8D',
  white: '#FFFFFF',
  red: '#B42318',
  line: '#E4EAF2',
};

const EXPENSE_FIELDS = [
  ['housing', 'Vivienda'],
  ['food', 'Alimentación'],
  ['services', 'Servicios'],
  ['transport', 'Transporte'],
  ['other', 'Otros'],
];

const EMPTY_EXPENSES = {
  housing: '0',
  food: '0',
  services: '0',
  transport: '0',
  other: '0',
};

const money = value => '$' + Math.round(Number(value) || 0).toLocaleString('es-CL');
const numericValue = value => value.trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0;
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function Button({children, onPress, secondary = false, danger = false}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, secondary && styles.buttonSecondary, danger && styles.buttonDanger]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, danger && styles.buttonTextDanger]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

function Card({children, style}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Header({title, sub}) {
  return (
    <View style={styles.header}>
      <Text style={styles.h1}>{title}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

function Field({label, value, onChangeText, numeric = false, placeholder = '0'}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        onChangeText={value => onChangeText(numeric ? value.replace(',', '.') : value)}
        placeholder={placeholder}
        style={styles.input}
        value={value}
      />
    </>
  );
}

export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [profileName, setProfileNameValue] = useState('');
  const [income, setIncomeValue] = useState('0');
  const [expenseCategories, setExpenseCategoriesValue] = useState(EMPTY_EXPENSES);
  const [debts, setDebtsValue] = useState([]);
  const [monthly, setMonthlyValue] = useState('0');
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [persistenceStatus, setPersistenceStatus] = useState('saved');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hasFinancialChanges, setHasFinancialChanges] = useState(false);
  const saveQueue = useRef(Promise.resolve());

  const setProfileName = value => {
    setProfileNameValue(value);
    setHasFinancialChanges(true);
  };
  const setIncome = value => {
    setIncomeValue(value);
    setHasFinancialChanges(true);
  };
  const setExpenseCategories = value => {
    setExpenseCategoriesValue(value);
    setHasFinancialChanges(true);
  };
  const setDebts = value => {
    setDebtsValue(value);
    setHasFinancialChanges(true);
  };
  const setMonthly = value => {
    setMonthlyValue(value);
    setHasFinancialChanges(true);
  };

  useEffect(() => {
    let active = true;
    loadFinancialData()
      .then(saved => {
        if (!active) {
          return;
        }
        if (saved) {
          setProfileNameValue(saved.profileName);
          setIncomeValue(saved.income);
          setExpenseCategoriesValue(saved.expenseCategories);
          setDebtsValue(saved.debts);
          setMonthlyValue(saved.monthly);
          setOnboardingComplete(saved.onboardingComplete);
          setScreen(saved.onboardingComplete ? 'home' : 'profile');
          if (saved._needsMigration) {
            setHasFinancialChanges(true);
          }
        }
        setStorageReady(true);
      })
      .catch(error => {
        if (active) {
          setStorageError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const financialData = {
    version: 2,
    profileName,
    income,
    expenseCategories,
    monthly,
    onboardingComplete,
    debts,
  };

  useEffect(() => {
    if (!storageReady || !hasFinancialChanges) {
      return undefined;
    }

    if (!isValidDraft(financialData)) {
      setPersistenceStatus('invalid');
      return undefined;
    }

    let active = true;
    setPersistenceStatus('saving');
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        await saveFinancialData(financialData);
        if (active) {
          setStorageError(null);
          setPersistenceStatus('saved');
        }
      } catch (error) {
        if (active) {
          setStorageError(`No se pudieron guardar los cambios: ${error instanceof Error ? error.message : String(error)}`);
          setPersistenceStatus('error');
        }
      }
    });
    return () => {
      active = false;
    };
  }, [storageReady, hasFinancialChanges, profileName, income, expenseCategories, monthly, onboardingComplete, debts]);

  const totalExpenses = sumExpenseCategories(expenseCategories);
  const available = Math.max(0, Number(income || 0) - totalExpenses);
  const totalDebt = debts.reduce((sum, debt) => sum + Number(debt.balance), 0);
  const nav = nextScreen => setScreen(nextScreen);

  if (!storageReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loading}>
          <Text style={styles.h1}>{storageError ? 'No se pudieron cargar tus datos' : 'Cargando tus datos...'}</Text>
          {storageError ? (
            <>
              <Text style={styles.sub}>{storageError}</Text>
              <Button onPress={() => { setStorageError(null); setLoadAttempt(attempt => attempt + 1); }}>
                Reintentar
              </Button>
            </>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'welcome') {
    return (
      <SafeAreaView style={styles.dark}>
        <StatusBar barStyle="light-content" />
        <View style={styles.welcome}>
          <View style={styles.logoMark}><Text style={styles.logoV}>V</Text></View>
          <Text style={styles.logo}>VELZIA</Text>
          <Text style={styles.tag}>Toma el control de tu dinero.</Text>
          <Text style={styles.welcomeCopy}>Organiza tus deudas, planifica tus pagos y avanza hacia tus metas.</Text>
          <Button onPress={() => nav('profile')}>Comenzar</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {storageError ? (
            <Card>
              <Text style={styles.errorTitle}>No se pudieron guardar los cambios.</Text>
              <Text style={styles.muted}>{storageError}</Text>
            </Card>
          ) : null}
          {!storageError && persistenceStatus === 'invalid' ? (
            <Card><Text style={styles.errorTitle}>Hay cambios sin guardar.</Text><Text style={styles.muted}>Usa montos enteros en pesos, iguales o mayores a cero, y corrige los campos antes de cerrar la app.</Text></Card>
          ) : null}
          {!storageError && persistenceStatus === 'saving' ? (
            <Text accessibilityLiveRegion="polite" style={styles.saveStatus}>Guardando cambios…</Text>
          ) : null}
          {screen === 'profile' ? (
            <Profile
              income={income}
              name={profileName}
              onIncome={setIncome}
              onName={setProfileName}
              onNext={() => nav('expenses')}
            />
          ) : null}
          {screen === 'expenses' ? (
            <Expenses
              categories={expenseCategories}
              onChange={setExpenseCategories}
              onNext={() => nav('debt')}
            />
          ) : null}
          {screen === 'debt' ? (
            <Debt
              debts={debts}
              onAdd={debt => setDebts([...debts, debt])}
              onDelete={id => setDebts(debts.filter(debt => debt.id !== id))}
              onPayment={(id, payment) => setDebts(debts.map(debt => (
                debt.id === id
                  ? {
                    ...debt,
                    balance: Math.max(0, debt.balance - payment.principalApplied),
                    payments: [...debt.payments, payment],
                  }
                  : debt
              )))}
              onUpdate={updated => setDebts(debts.map(debt => debt.id === updated.id ? updated : debt))}
              onNext={() => {
                setOnboardingComplete(true);
                setHasFinancialChanges(true);
                nav('home');
              }}
            />
          ) : null}
          {screen === 'home' ? (
            <Home
              available={available}
              debtCount={debts.length}
              expenses={totalExpenses}
              income={Number(income)}
              name={profileName}
              onDebt={() => nav('debt')}
              onPlan={() => nav('plan')}
              totalDebt={totalDebt}
            />
          ) : null}
          {screen === 'plan' ? (
            <Plan
              available={available}
              debts={debts}
              monthly={monthly}
              onSim={() => nav('simulator')}
              setMonthly={setMonthly}
            />
          ) : null}
          {screen === 'simulator' ? <Simulator debts={debts} monthly={monthly} setMonthly={setMonthly} /> : null}
          {screen === 'calendar' ? <Calendar debts={debts} /> : null}
          {screen === 'progress' ? <Progress debts={debts} /> : null}
        </ScrollView>
        <View style={styles.tabbar}>
          {[
            ['home', 'Inicio', '⌂'],
            ['debt', 'Deudas', '▣'],
            ['plan', 'Plan', '◈'],
            ['calendar', 'Calendario', '□'],
            ['progress', 'Progreso', '◉'],
          ].map(([id, label, icon]) => (
            <TouchableOpacity
              accessibilityRole="button"
              key={id}
              onPress={() => nav(id)}
              style={styles.tab}>
              <Text style={[styles.tabIcon, screen === id && styles.activeTab]}>{icon}</Text>
              <Text style={[styles.tabText, screen === id && styles.activeTab]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function isValidDraft(data) {
  return (
    numericValue(data.income) &&
    numericValue(data.monthly) &&
    Object.values(data.expenseCategories).every(numericValue) &&
    Number.isSafeInteger(sumExpenseCategories(data.expenseCategories)) &&
    Number.isSafeInteger(data.debts.reduce((total, debt) => total + debt.balance, 0)) &&
    Number.isSafeInteger(data.debts.reduce((total, debt) => total + debt.initialBalance, 0)) &&
    data.debts.every(debt =>
      debt.name.trim() !== '' &&
      numericValue(String(debt.balance)) &&
      numericValue(String(debt.initialBalance)) &&
      numericValue(String(debt.payment)) &&
      isValidAnnualRate(debt.rate) &&
      (debt.dueDay === null ||
        (Number.isInteger(debt.dueDay) && debt.dueDay >= 1 && debt.dueDay <= 31)) &&
      debt.payments.every(payment =>
        numericValue(String(payment.amount)) &&
        numericValue(String(payment.principalApplied)) &&
        payment.principalApplied <= payment.amount),
    )
  );
}

function Profile({income, name, onIncome, onName, onNext}) {
  const [error, setError] = useState('');
  return (
    <>
      <Header title="¡Comencemos! 👋" sub="Cuéntanos lo mínimo necesario para crear tu plan." />
      <Card>
        <Field label="¿Cómo quieres que te llamemos?" onChangeText={onName} placeholder="Tu nombre" value={name} />
        <Field label="¿Cuánto recibes aproximadamente cada mes?" numeric onChangeText={onIncome} value={income} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button onPress={() => {
          if (!numericValue(income)) {
            setError('Ingresa un ingreso mensual válido, igual o mayor a cero.');
            return;
          }
          setError('');
          onNext();
        }}>Continuar</Button>
      </Card>
    </>
  );
}

function Expenses({categories, onChange, onNext}) {
  const [error, setError] = useState('');
  return (
    <>
      <Header title="Tus gastos" sub="Ingresa tus gastos mensuales por categoría." />
      <Card>
        {EXPENSE_FIELDS.map(([key, label]) => (
          <Field
            key={key}
            label={label}
            numeric
            onChangeText={value => onChange({...categories, [key]: value})}
            value={categories[key]}
          />
        ))}
        <View style={styles.summaryRow}>
          <Text style={styles.muted}>Gasto mensual total</Text>
          <Text style={styles.debtAmount}>{money(sumExpenseCategories(categories))}</Text>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button onPress={() => {
          if (!Object.values(categories).every(numericValue)) {
            setError('Completa cada categoría con un valor igual o mayor a cero.');
            return;
          }
          setError('');
          onNext();
        }}>Continuar</Button>
      </Card>
    </>
  );
}

function Debt({debts, onAdd, onDelete, onPayment, onUpdate, onNext}) {
  const [form, setForm] = useState(emptyDebtForm());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [paymentDebtId, setPaymentDebtId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [principalApplied, setPrincipalApplied] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [deletingDebtId, setDeletingDebtId] = useState(null);

  function changeForm(key, value) {
    setForm(current => ({...current, [key]: value}));
  }

  function saveDebt() {
    const balance = Number(form.balance);
    const payment = Number(form.payment);
    const rate = Number(form.rate);
    const dueDay = Number(form.dueDay);
    if (!form.name.trim() || !numericValue(form.balance) || !numericValue(form.payment) ||
      !isValidAnnualRate(form.rate) || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      setFormError('Revisa el nombre, los montos, la tasa anual (0–1000%) y el vencimiento (1–31).');
      return;
    }

    const existing = debts.find(debt => debt.id === editingId);
    const updated = {
      id: editingId || makeId(),
      name: form.name.trim(),
      balance,
      initialBalance: existing?.initialBalance ?? balance,
      payment,
      rate,
      dueDay,
      payments: existing?.payments ?? [],
    };
    if (editingId) {
      onUpdate(updated);
    } else {
      onAdd(updated);
    }
    setForm(emptyDebtForm());
    setEditingId(null);
    setFormError('');
  }

  function editDebt(debt) {
    setEditingId(debt.id);
    setForm({
      name: debt.name,
      balance: String(debt.balance),
      payment: String(debt.payment),
      rate: String(debt.rate),
      dueDay: debt.dueDay === null ? '' : String(debt.dueDay),
    });
    setFormError('');
  }

  function deleteDebt(debt) {
    onDelete(debt.id);
    setDeletingDebtId(null);
    if (editingId === debt.id) {
      setEditingId(null);
      setForm(emptyDebtForm());
    }
  }

  function recordPayment(debt) {
    const amount = Number(paymentAmount);
    const principal = Number(principalApplied);
    if (!numericValue(paymentAmount) || amount <= 0 || !numericValue(principalApplied) ||
      principal > amount || principal > debt.balance) {
      setPaymentError('El pago debe ser mayor a cero; el capital aplicado no puede superar el pago ni el saldo.');
      return;
    }
    onPayment(debt.id, {
      id: makeId(),
      amount,
      principalApplied: principal,
      date: localISODate(new Date()),
    });
    setPaymentDebtId(null);
    setPaymentAmount('');
    setPrincipalApplied('');
    setPaymentError('');
  }

  return (
    <>
      <Header title="Mis deudas" sub="Agrega tus saldos, cuotas mínimas, tasa anual y día de vencimiento." />
      <Card>
        <Text style={styles.cardTitle}>{editingId ? 'Editar deuda' : 'Agregar deuda'}</Text>
        <Field label="Nombre" onChangeText={value => changeForm('name', value)} placeholder="Ej. Tarjeta de crédito" value={form.name} />
        <Field label="Saldo actual" numeric onChangeText={value => changeForm('balance', value)} value={form.balance} />
        <Field label="Cuota mínima mensual" numeric onChangeText={value => changeForm('payment', value)} value={form.payment} />
        <Field label="Tasa anual (%)" numeric onChangeText={value => changeForm('rate', value)} value={form.rate} />
        <Field label="Día de vencimiento (1–31)" numeric onChangeText={value => changeForm('dueDay', value)} value={form.dueDay} />
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <Button onPress={saveDebt}>{editingId ? 'Guardar cambios' : '+ Agregar deuda'}</Button>
        {editingId ? <Button secondary onPress={() => { setEditingId(null); setForm(emptyDebtForm()); setFormError(''); }}>Cancelar edición</Button> : null}
      </Card>
      {debts.length === 0 ? (
        <Card><Text style={styles.muted}>Aún no has agregado deudas. Puedes continuar y agregarlas más tarde.</Text></Card>
      ) : debts.map(debt => (
        <Card key={debt.id}>
          <View style={styles.row}>
            <Text style={styles.debtName}>{debt.name}</Text>
            <Text style={styles.debtAmount}>{money(debt.balance)}</Text>
          </View>
          <Text style={styles.muted}>
            Cuota mínima {money(debt.payment)} · Tasa anual {debt.rate}% · {debt.dueDay ? `Vence el día ${debt.dueDay}` : 'Vencimiento sin definir'}
          </Text>
          <Text style={styles.muted}>Pagos registrados: {debt.payments.length}</Text>
          <View style={styles.actionRow}>
            <Button secondary onPress={() => editDebt(debt)}>Editar</Button>
            <Button secondary onPress={() => {
              setPaymentDebtId(paymentDebtId === debt.id ? null : debt.id);
              setPaymentError('');
            }}>Registrar pago</Button>
            <Button danger onPress={() => setDeletingDebtId(debt.id)}>Eliminar</Button>
          </View>
          {deletingDebtId === debt.id ? (
            <View style={styles.confirmDelete}>
              <Text style={styles.errorTitle}>¿Eliminar “{debt.name}” y su historial de pagos?</Text>
              <View style={styles.actionRow}>
                <Button secondary onPress={() => setDeletingDebtId(null)}>Cancelar</Button>
                <Button danger onPress={() => deleteDebt(debt)}>Confirmar eliminación</Button>
              </View>
            </View>
          ) : null}
          {paymentDebtId === debt.id ? (
            <View style={styles.paymentForm}>
              <Field label="Monto pagado" numeric onChangeText={setPaymentAmount} value={paymentAmount} />
              <Field label="Capital que redujo el saldo" numeric onChangeText={setPrincipalApplied} value={principalApplied} />
              <Text style={styles.note}>Ingresa la reducción de capital según el estado de cuenta; intereses y comisiones no reducen el saldo de capital.</Text>
              {paymentError ? <Text style={styles.errorText}>{paymentError}</Text> : null}
              {debt.balance > 0 ? (
                <Button onPress={() => recordPayment(debt)}>Guardar pago</Button>
              ) : <Text style={styles.muted}>La deuda ya está pagada; no se pueden registrar más pagos.</Text>}
            </View>
          ) : null}
          {debt.payments.length ? (
            <View style={styles.history}>
              <Text style={styles.cardTitle}>Historial de pagos</Text>
              {debt.payments.slice().reverse().map(payment => (
                <Text key={payment.id} style={styles.muted}>
                  {formatDate(new Date(`${payment.date}T12:00:00`))} · Pago {money(payment.amount)} · Capital {money(payment.principalApplied)}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      ))}
      <Button onPress={onNext}>Ver mi situación</Button>
    </>
  );
}

function emptyDebtForm() {
  return {name: '', balance: '', payment: '', rate: '', dueDay: ''};
}

function Home({available, debtCount, expenses, income, name, onDebt, onPlan, totalDebt}) {
  return (
    <>
      <View style={styles.top}>
        <Text style={styles.brandSmall}>VELZIA</Text>
        <Text style={styles.hello}>{name ? `Hola, ${name}` : 'Tu resumen financiero'}</Text>
      </View>
      <Card style={styles.balance}>
        <Text style={styles.inverseLabel}>Dinero disponible</Text>
        <Text style={styles.balanceValue}>{money(available)}</Text>
        <Text style={styles.inverseSmall}>ingresos menos gastos mensuales</Text>
      </Card>
      <View style={styles.grid}>
        <Card style={styles.gridCard}><Text style={styles.muted}>Deuda total</Text><Text style={styles.big}>{money(totalDebt)}</Text></Card>
        <Card style={styles.gridCard}><Text style={styles.muted}>Gastos</Text><Text style={styles.big}>{money(expenses)}</Text></Card>
      </View>
      <Card>
        <Text style={styles.muted}>Ingreso mensual</Text>
        <Text style={styles.big}>{money(income)}</Text>
        <Text style={styles.muted}>Deudas registradas: {debtCount}</Text>
      </Card>
      <Card style={styles.alert}>
        <Text style={styles.alertTitle}>Próximo paso</Text>
        <Text style={styles.alertText}>Revisa tus cuotas mínimas y simula un presupuesto de pago mensual.</Text>
        <Button onPress={onPlan}>Ver mi plan</Button>
      </Card>
      <TouchableOpacity accessibilityRole="button" onPress={onDebt}>
        <Text style={styles.link}>Administrar mis deudas →</Text>
      </TouchableOpacity>
    </>
  );
}

function Plan({available, debts, monthly, onSim, setMonthly}) {
  const ordered = debts.slice().sort((left, right) => right.rate - left.rate);
  return (
    <>
      <Header title="¿Qué pago primero?" sub="Orden de referencia por tasa anual: prioriza la deuda más cara." />
      <Card>
        <Text style={styles.label}>Capacidad disponible después de gastos</Text>
        <Text style={styles.big}>{money(available)}</Text>
        <Text style={styles.muted}>Orden de mayor a menor tasa:</Text>
        {ordered.length ? ordered.map((debt, index) => (
          <View key={debt.id} style={styles.order}>
            <Text style={styles.rank}>{index + 1}</Text>
            <Text style={styles.orderName}>{debt.name}</Text>
            <Text style={styles.rate}>{debt.rate}%</Text>
          </View>
        )) : <Text style={styles.muted}>Agrega deudas para generar un orden.</Text>}
        <Field label="Presupuesto mensual total para deudas" numeric onChangeText={setMonthly} value={monthly} />
        <Button onPress={onSim}>Simular pago de deudas</Button>
      </Card>
    </>
  );
}

function Simulator({debts, monthly, setMonthly}) {
  const result = simulateDebtPayoff(debts, monthly);
  return (
    <>
      <Header title="Simulador" sub="Estimación mensual con interés anual de cada deuda y pago tipo avalancha." />
      <Card>
        <Field label="Presupuesto mensual total" numeric onChangeText={setMonthly} value={monthly} />
        <Text style={styles.big}>{money(monthly)}</Text>
        <View style={styles.result}>
          {result.status === 'payoff' ? (
            <>
              <Text style={styles.muted}>Tiempo estimado</Text>
              <Text style={styles.resultValue}>{result.months} meses</Text>
              <Text style={styles.muted}>Intereses estimados</Text>
              <Text style={styles.resultValue}>{money(result.interest)}</Text>
              <Text style={styles.muted}>Total de pagos estimado</Text>
              <Text style={styles.resultValue}>{money(result.totalPaid)}</Text>
            </>
          ) : null}
          {result.status === 'below-minimums' ? (
            <Text style={styles.errorTitle}>
              El presupuesto no cubre las cuotas mínimas estimadas ({money(result.minimumRequired)} al mes).
            </Text>
          ) : null}
          {result.status === 'invalid-budget' ? <Text style={styles.muted}>Ingresa un presupuesto mensual mayor a cero.</Text> : null}
          {result.status === 'no-debt' ? <Text style={styles.muted}>Agrega una deuda con saldo mayor a cero para simular.</Text> : null}
          {result.status === 'over-50-years' ? <Text style={styles.errorTitle}>Con este presupuesto la deuda no se paga en el horizonte de 50 años.</Text> : null}
          {result.status === 'invalid-debt' ? <Text style={styles.errorTitle}>Revisa los saldos, cuotas y tasas de las deudas.</Text> : null}
        </View>
        <Text style={styles.note}>Estimación orientativa: asume tasa anual fija dividida en meses y aplica excedentes a la tasa más alta. No incluye comisiones, seguros, cambios de tasa ni condiciones particulares del crédito.</Text>
      </Card>
    </>
  );
}

function Calendar({debts}) {
  const events = buildPaymentCalendar(debts);
  return (
    <>
      <Header title="Calendario" sub="Vencimientos mensuales calculados con el día que registraste en cada deuda." />
      {events.length ? (
        <Card>
          {events.map(event => (
            <View key={event.id} style={styles.event}>
              <View style={styles.dot} />
              <View style={styles.eventText}>
                <Text style={styles.debtName}>{formatDate(event.dueDate)}</Text>
                <Text style={styles.muted}>{event.name} · Cuota {money(event.amount)}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.note}>Se muestran los próximos 90 días. Aún no se envían notificaciones.</Text>
        </Card>
      ) : (
        <Card><Text style={styles.muted}>No hay vencimientos próximos. Agrega una deuda con saldo y cuota mensual.</Text></Card>
      )}
    </>
  );
}

function Progress({debts}) {
  const progress = calculateDebtProgress(debts);
  return (
    <>
      <Header title="Mi progreso" sub="Basado en los saldos iniciales registrados y los saldos actuales." />
      <Card style={styles.progressCard}>
        <Text style={styles.muted}>Saldo inicial registrado</Text>
        <Text style={styles.big}>{money(progress.initialDebt)}</Text>
        <Text style={styles.muted}>Saldo actual</Text>
        <Text style={styles.balanceValueDark}>{money(progress.currentDebt)}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${progress.percentage}%`}]} />
        </View>
        <Text style={styles.percent}>{progress.percentage}% de saldo reducido</Text>
        <Text style={styles.muted}>Pagos registrados: {progress.paymentCount}</Text>
        {progress.paymentCount === 0 ? (
          <Text style={styles.note}>Registra un pago y su reducción de capital para empezar a medir el progreso.</Text>
        ) : null}
      </Card>
    </>
  );
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-CL', {day: 'numeric', month: 'long', year: 'numeric'}).format(date);
}

function localISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: C.bg},
  dark: {flex: 1, backgroundColor: C.navy},
  container: {flex: 1},
  loading: {flex: 1, justifyContent: 'center', padding: 24},
  scroll: {padding: 20, paddingBottom: 100},
  welcome: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32},
  logoMark: {width: 82, height: 82, borderRadius: 24, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 18},
  logoV: {fontSize: 58, fontWeight: '900', color: C.navy},
  logo: {fontSize: 42, fontWeight: '900', letterSpacing: 5, color: C.white},
  tag: {fontSize: 18, color: C.white, marginTop: 6},
  welcomeCopy: {fontSize: 16, lineHeight: 24, textAlign: 'center', color: '#B9C7D8', marginVertical: 38},
  button: {backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 15, alignItems: 'center', marginTop: 14},
  buttonSecondary: {backgroundColor: C.mint},
  buttonDanger: {backgroundColor: '#FEE4E2'},
  buttonText: {color: C.navy, fontWeight: '900', fontSize: 14},
  buttonTextSecondary: {color: C.navy},
  buttonTextDanger: {color: C.red},
  header: {marginBottom: 18, marginTop: 10},
  h1: {fontSize: 28, fontWeight: '900', color: C.text},
  sub: {fontSize: 15, color: C.muted, marginTop: 6, lineHeight: 21},
  card: {backgroundColor: C.white, borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2},
  cardTitle: {fontSize: 16, fontWeight: '900', color: C.text, marginBottom: 4},
  label: {fontSize: 14, fontWeight: '800', color: C.text, marginTop: 12, marginBottom: 8},
  input: {borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 13, fontSize: 16, color: C.text, backgroundColor: '#FBFCFE'},
  muted: {color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 5},
  errorText: {color: C.red, fontSize: 13, marginTop: 10},
  errorTitle: {color: C.red, fontSize: 14, fontWeight: '800', lineHeight: 20},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  actionRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8},
  debtName: {fontSize: 16, fontWeight: '800', flex: 1, color: C.text},
  debtAmount: {fontSize: 17, fontWeight: '900', color: C.navy},
  top: {marginBottom: 14},
  brandSmall: {fontWeight: '900', letterSpacing: 2, color: C.teal, fontSize: 18},
  hello: {fontSize: 23, fontWeight: '900', color: C.text, marginTop: 4},
  balance: {backgroundColor: C.navy},
  inverseLabel: {color: '#B9C7D8', fontWeight: '700'},
  balanceValue: {fontSize: 34, fontWeight: '900', color: C.white, marginTop: 6},
  inverseSmall: {color: '#B9C7D8', marginTop: 4},
  grid: {flexDirection: 'row', gap: 10},
  gridCard: {flex: 1},
  big: {fontSize: 23, fontWeight: '900', color: C.navy, marginTop: 5},
  summaryRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16},
  alert: {borderLeftWidth: 4, borderLeftColor: C.teal},
  alertTitle: {fontSize: 18, fontWeight: '900', color: C.text},
  alertText: {color: C.muted, lineHeight: 21, marginTop: 5},
  link: {textAlign: 'center', color: C.navy, fontWeight: '800', padding: 14},
  order: {flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line},
  orderName: {flex: 1, color: C.text},
  rank: {width: 28, height: 28, borderRadius: 14, backgroundColor: C.navy, color: C.white, textAlign: 'center', paddingTop: 5, fontWeight: '900', marginRight: 10},
  rate: {fontWeight: '900', color: C.teal},
  result: {backgroundColor: C.mint, borderRadius: 14, padding: 16, marginTop: 18},
  resultValue: {fontSize: 22, fontWeight: '900', color: C.navy, marginBottom: 10},
  note: {fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 12},
  saveStatus: {color: C.muted, fontSize: 12, marginBottom: 10},
  confirmDelete: {borderTopWidth: 1, borderTopColor: C.line, marginTop: 14, paddingTop: 12},
  paymentForm: {borderTopWidth: 1, borderTopColor: C.line, marginTop: 14, paddingTop: 8},
  history: {borderTopWidth: 1, borderTopColor: C.line, marginTop: 14, paddingTop: 14},
  event: {flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line},
  eventText: {flex: 1},
  dot: {width: 10, height: 10, borderRadius: 5, backgroundColor: C.teal, marginRight: 12},
  progressCard: {alignItems: 'center'},
  progressTrack: {height: 14, width: '100%', backgroundColor: '#E9EEF5', borderRadius: 8, overflow: 'hidden', marginTop: 18},
  progressFill: {height: '100%', backgroundColor: C.teal},
  percent: {fontSize: 18, fontWeight: '900', color: C.navy, marginTop: 12},
  balanceValueDark: {fontSize: 30, fontWeight: '900', color: C.teal},
  tabbar: {position: 'absolute', bottom: 0, left: 0, right: 0, height: 78, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8},
  tab: {alignItems: 'center', flex: 1},
  tabIcon: {fontSize: 20, color: C.muted},
  tabText: {fontSize: 10, color: C.muted, marginTop: 3},
  activeTab: {color: C.teal, fontWeight: '800'},
});
