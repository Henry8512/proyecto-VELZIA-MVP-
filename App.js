import React, {useEffect, useMemo, useRef, useState} from 'react';
import {SafeAreaView, View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, StatusBar} from 'react-native';
import {loadFinancialData, saveFinancialData} from './financialStorage';

const C={navy:'#071A33',teal:'#10BFA8',mint:'#DDF8F2',lav:'#8C9CF4',bg:'#F5F8FC',text:'#10233D',muted:'#6E7B8D',white:'#FFFFFF',red:'#F26B6B',line:'#E4EAF2'};

const money=n=>'$'+Math.round(n).toLocaleString('es-CL');

function Button({children,onPress,secondary=false}){return <TouchableOpacity onPress={onPress} style={[styles.button,secondary&&styles.buttonSecondary]}><Text style={[styles.buttonText,secondary&&styles.buttonTextSecondary]}>{children}</Text></TouchableOpacity>}
function Card({children,style}){return <View style={[styles.card,style]}>{children}</View>}

export default function App(){
 const [screen,setScreen]=useState('welcome');
 const [income,setIncomeValue]=useState('1300000');
 const [expenses,setExpensesValue]=useState('600000');
 const [debts,setDebtsValue]=useState([
  {name:'Tarjeta principal',balance:1250000,payment:180000,rate:24.9},
  {name:'Crédito consumo',balance:1500000,payment:150000,rate:18.5},
  {name:'Tarjeta secundaria',balance:671000,payment:120000,rate:26.9}
 ]);
 const [monthly,setMonthlyValue]=useState(String(Math.min(250000,1300000-600000)));
 const [storageReady,setStorageReady]=useState(false);
 const [storageError,setStorageError]=useState(null);
 const [loadAttempt,setLoadAttempt]=useState(0);
 const [hasFinancialChanges,setHasFinancialChanges]=useState(false);
 const saveQueue=useRef(Promise.resolve());
 const setIncome=value=>{setIncomeValue(value);setHasFinancialChanges(true)};
 const setExpenses=value=>{setExpensesValue(value);setHasFinancialChanges(true)};
 const setDebts=value=>{setDebtsValue(value);setHasFinancialChanges(true)};
 const setMonthly=value=>{setMonthlyValue(value);setHasFinancialChanges(true)};

 useEffect(()=>{
  let active=true;
  loadFinancialData().then(saved=>{
   if(!active)return;
   if(saved){
    setIncomeValue(saved.income);
    setExpensesValue(saved.expenses);
    setDebtsValue(saved.debts);
    setMonthlyValue(saved.monthly);
    setScreen('home');
   }
   setStorageReady(true);
  }).catch(error=>{
   if(active)setStorageError(error instanceof Error?error.message:String(error));
  });
  return ()=>{active=false};
 },[loadAttempt]);

 useEffect(()=>{
  if(!storageReady||!hasFinancialChanges)return;
  let active=true;
  saveQueue.current=saveQueue.current.then(async()=>{
   try{
    await saveFinancialData({income,expenses,debts,monthly});
    if(active)setStorageError(null);
   }catch(error){
    if(active)setStorageError(`No se pudieron guardar los cambios: ${error instanceof Error?error.message:String(error)}`);
   }
  });
  return ()=>{active=false};
 },[storageReady,hasFinancialChanges,income,expenses,debts,monthly]);

 const available=Math.max(0,Number(income||0)-Number(expenses||0));
 const totalDebt=debts.reduce((a,d)=>a+d.balance,0);
 const nav=(s)=>setScreen(s);

 if(!storageReady) return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content"/><View style={{flex:1,justifyContent:'center',padding:24}}><Text style={styles.h1}>{storageError?'No se pudieron cargar tus datos':'Cargando tus datos...'}</Text>{storageError&&<><Text style={styles.sub}>{storageError}</Text><Button onPress={()=>{setStorageError(null);setLoadAttempt(attempt=>attempt+1)}}>Reintentar</Button></>}</View></SafeAreaView>;

 if(screen==='welcome') return <SafeAreaView style={styles.dark}><StatusBar barStyle="light-content"/><View style={styles.welcome}><View style={styles.logoMark}><Text style={styles.logoV}>V</Text></View><Text style={styles.logo}>VELZIA</Text><Text style={styles.tag}>Toma el control de tu dinero.</Text><Text style={styles.welcomeCopy}>Organiza tus deudas, planifica tus pagos y avanza hacia tus metas.</Text><Button onPress={()=>nav('profile')}>Comenzar</Button><TouchableOpacity onPress={()=>nav('home')}><Text style={styles.login}>Ya tengo una cuenta</Text></TouchableOpacity></View></SafeAreaView>;

 return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content"/><View style={styles.container}>
   <ScrollView contentContainerStyle={styles.scroll}>
    {storageError&&<Card><Text style={{color:C.red,fontWeight:'800'}}>No se pudieron guardar los cambios.</Text><Text style={styles.muted}>{storageError}</Text></Card>}
    {screen==='profile' && <Profile income={income} setIncome={setIncome} onNext={()=>nav('expenses')}/>} 
    {screen==='expenses' && <Expenses expenses={expenses} setExpenses={setExpenses} onNext={()=>nav('debt')}/>} 
    {screen==='debt' && <Debt debts={debts} setDebts={setDebts} onNext={()=>nav('home')}/>} 
    {screen==='home' && <Home income={income} expenses={expenses} available={available} totalDebt={totalDebt} onPlan={()=>nav('plan')} onDebt={()=>nav('debt')} />} 
    {screen==='plan' && <Plan available={available} monthly={monthly} setMonthly={setMonthly} debts={debts} onSim={()=>nav('simulator')}/>} 
    {screen==='simulator' && <Simulator monthly={monthly} setMonthly={setMonthly} totalDebt={totalDebt}/>} 
    {screen==='calendar' && <Calendar debts={debts}/>} 
    {screen==='progress' && <Progress totalDebt={totalDebt}/>} 
   </ScrollView>
   <View style={styles.tabbar}>{[['home','Inicio','⌂'],['debt','Deudas','▣'],['plan','Plan','◈'],['calendar','Calendario','□'],['progress','Progreso','◉']].map(([s,l,i])=><TouchableOpacity key={s} onPress={()=>nav(s)} style={styles.tab}><Text style={[styles.tabIcon,screen===s&&{color:C.teal}]}>{i}</Text><Text style={[styles.tabText,screen===s&&{color:C.teal,fontWeight:'800'}]}>{l}</Text></TouchableOpacity>)}</View>
 </View></SafeAreaView>
}

function Header({title,sub}){return <View style={styles.header}><Text style={styles.h1}>{title}</Text>{sub&&<Text style={styles.sub}>{sub}</Text>}</View>}
function Profile({income,setIncome,onNext}){return <><Header title="¡Comencemos! 👋" sub="Cuéntanos lo mínimo necesario para crear tu plan."/><Card><Text style={styles.label}>¿Cómo quieres que te llamemos?</Text><TextInput placeholder="Tu nombre" style={styles.input}/><Text style={styles.label}>¿Cuánto recibes aproximadamente cada mes?</Text><TextInput keyboardType="numeric" value={income} onChangeText={setIncome} style={styles.input}/><Button onPress={onNext}>Continuar</Button></Card></>}
function Expenses({expenses,setExpenses,onNext}){return <><Header title="Tus gastos" sub="Una estimación es suficiente para empezar."/><Card>{['Vivienda','Alimentación','Servicios','Transporte','Otros'].map((x,i)=><View key={x}><Text style={styles.label}>{x}</Text><TextInput keyboardType="numeric" style={styles.inputSmall} placeholder={i===0?'350000':'0'}/></View>)}<Text style={styles.label}>Gastos mensuales aproximados</Text><TextInput keyboardType="numeric" value={expenses} onChangeText={setExpenses} style={styles.input}/><Button onPress={onNext}>Continuar</Button></Card></>}
function Debt({debts,setDebts,onNext}){const [name,setName]=useState('');const [bal,setBal]=useState('');const add=()=>{if(name&&bal){setDebts([...debts,{name,balance:Number(bal),payment:0,rate:0}]);setName('');setBal('')}};return <><Header title="Mis deudas" sub="Puedes agregar todas las que quieras."/><Card><Text style={styles.label}>Nombre</Text><TextInput value={name} onChangeText={setName} style={styles.input}/><Text style={styles.label}>Saldo pendiente</Text><TextInput value={bal} onChangeText={setBal} keyboardType="numeric" style={styles.input}/><Button onPress={add}>+ Agregar deuda</Button></Card>{debts.map((d,i)=><Card key={i}><View style={styles.row}><Text style={styles.debtName}>{d.name}</Text><Text style={styles.debtAmount}>{money(d.balance)}</Text></View><Text style={styles.muted}>Cuota {money(d.payment)} · Interés {d.rate}%</Text></Card>)}<Button onPress={onNext}>Ver mi situación</Button></>}
function Home({income,expenses,available,totalDebt,onPlan,onDebt}){return <><View style={styles.top}><Text style={styles.brandSmall}>VELZIA</Text><Text style={styles.hello}>Tu resumen financiero</Text></View><Card style={styles.balance}><Text style={styles.inverseLabel}>Dinero disponible</Text><Text style={styles.balanceValue}>{money(available)}</Text><Text style={styles.inverseSmall}>para planificar tus pagos</Text></Card><View style={styles.grid}><Card><Text style={styles.muted}>Deuda total</Text><Text style={styles.big}>{money(totalDebt)}</Text></Card><Card><Text style={styles.muted}>Gastos</Text><Text style={styles.big}>{money(Number(expenses))}</Text></Card></View><Card style={styles.alert}><Text style={styles.alertTitle}>Próximo paso</Text><Text style={styles.alertText}>Define cuánto quieres destinar a tus deudas y crea tu plan.</Text><Button onPress={onPlan}>Ver mi plan</Button></Card><TouchableOpacity onPress={onDebt}><Text style={styles.link}>Administrar mis deudas →</Text></TouchableOpacity></>}
function Plan({available,monthly,setMonthly,debts,onSim}){const ordered=[...debts].sort((a,b)=>b.rate-a.rate);return <><Header title="¿Qué pago primero?" sub="VELZIA muestra escenarios para que tomes tu propia decisión."/><Card><View style={styles.pillRow}><Text style={styles.pillActive}>Por intereses</Text><Text style={styles.pill}>Por monto</Text><Text style={styles.pill}>Personalizado</Text></View><Text style={styles.label}>Capacidad disponible</Text><Text style={styles.big}>{money(available)}</Text><Text style={styles.muted}>Orden de referencia por tasa:</Text>{ordered.map((d,i)=><View key={i} style={styles.order}><Text style={styles.rank}>{i+1}</Text><Text style={{flex:1}}>{d.name}</Text><Text style={styles.rate}>{d.rate}%</Text></View>)}<Button onPress={onSim}>Simular escenarios</Button></Card></>}
function Simulator({monthly,setMonthly,totalDebt}){const m=Number(monthly)||0;const months=m>0?Math.ceil(totalDebt/m):0;const interest=Math.round(totalDebt*0.16);return <><Header title="Simulador" sub="Prueba distintos montos antes de decidir."/><Card><Text style={styles.label}>Pago mensual</Text><TextInput keyboardType="numeric" value={monthly} onChangeText={setMonthly} style={styles.input}/><Text style={styles.big}>{money(m)}</Text><View style={styles.result}><Text style={styles.muted}>Tiempo estimado simple</Text><Text style={styles.resultValue}>{months} meses</Text><Text style={styles.muted}>Interés orientativo</Text><Text style={styles.resultValue}>{money(interest)}</Text></View><Text style={styles.note}>Los cálculos son orientativos y deben contrastarse con las condiciones reales de cada deuda.</Text></Card></>}
function Calendar({debts}){return <><Header title="Calendario" sub="Tus próximos pagos en un solo lugar."/><Card><Text style={styles.month}>OCTUBRE 2026</Text>{['05 · Tarjeta principal · $180.000','15 · Crédito consumo · $150.000','20 · Tarjeta secundaria · $120.000'].map((x,i)=><View key={i} style={styles.event}><View style={styles.dot}/><Text>{x}</Text></View>)}</Card></>}
function Progress({totalDebt}){const initial=3850000;const current=Math.min(totalDebt,2970000);const pct=Math.max(0,Math.round((1-current/initial)*100));return <><Header title="Mi progreso" sub="Cada pago cuenta."/><Card style={{alignItems:'center'}}><Text style={styles.muted}>Deuda inicial</Text><Text style={styles.big}>{money(initial)}</Text><Text style={styles.muted}>Deuda actual</Text><Text style={styles.balanceValueDark}>{money(current)}</Text><View style={styles.progress}><View style={[styles.progressFill,{width:`${Math.min(pct,100)}%`}]} /></View><Text style={styles.percent}>{pct}% reducido</Text></Card></>}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:C.bg},dark:{flex:1,backgroundColor:C.navy},container:{flex:1},scroll:{padding:20,paddingBottom:100},welcome:{flex:1,justifyContent:'center',alignItems:'center',padding:32},logoMark:{width:82,height:82,borderRadius:24,backgroundColor:C.teal,alignItems:'center',justifyContent:'center',marginBottom:18},logoV:{fontSize:58,fontWeight:'900',color:C.navy},logo:{fontSize:42,fontWeight:'900',letterSpacing:5,color:C.white},tag:{fontSize:18,color:C.white,marginTop:6},welcomeCopy:{fontSize:16,lineHeight:24,textAlign:'center',color:'#B9C7D8',marginVertical:38},login:{color:'#B9C7D8',marginTop:20,fontWeight:'700'},button:{backgroundColor:C.teal,borderRadius:14,paddingVertical:15,paddingHorizontal:22,alignItems:'center',marginTop:18},buttonText:{color:C.navy,fontWeight:'900',fontSize:16},buttonSecondary:{backgroundColor:C.mint},buttonTextSecondary:{color:C.navy},header:{marginBottom:18,marginTop:10},h1:{fontSize:30,fontWeight:'900',color:C.text},sub:{fontSize:15,color:C.muted,marginTop:6,lineHeight:21},card:{backgroundColor:C.white,borderRadius:18,padding:18,marginBottom:14,shadowColor:'#000',shadowOpacity:.04,shadowRadius:8,elevation:2},label:{fontSize:14,fontWeight:'800',color:C.text,marginTop:12,marginBottom:8},input:{borderWidth:1,borderColor:C.line,borderRadius:12,padding:14,fontSize:17,color:C.text,backgroundColor:'#FBFCFE'},inputSmall:{borderWidth:1,borderColor:C.line,borderRadius:10,padding:10,color:C.text},row:{flexDirection:'row',alignItems:'center'},debtName:{fontSize:16,fontWeight:'800',flex:1,color:C.text},debtAmount:{fontSize:17,fontWeight:'900',color:C.navy},muted:{color:C.muted,fontSize:13},top:{marginBottom:14},brandSmall:{fontWeight:'900',letterSpacing:2,color:C.teal,fontSize:18},hello:{fontSize:24,fontWeight:'900',color:C.text,marginTop:4},balance:{backgroundColor:C.navy},inverseLabel:{color:'#B9C7D8',fontWeight:'700'},balanceValue:{fontSize:34,fontWeight:'900',color:C.white,marginTop:6},inverseSmall:{color:'#B9C7D8',marginTop:4},grid:{flexDirection:'row',gap:10},big:{fontSize:24,fontWeight:'900',color:C.navy,marginTop:5},alert:{borderLeftWidth:4,borderLeftColor:C.teal},alertTitle:{fontSize:18,fontWeight:'900',color:C.text},alertText:{color:C.muted,lineHeight:21,marginTop:5},link:{textAlign:'center',color:C.navy,fontWeight:'800',padding:14},pillRow:{flexDirection:'row',gap:6,marginBottom:15},pill:{padding:8,borderRadius:20,backgroundColor:'#EEF2F7',color:C.muted,fontSize:12},pillActive:{padding:8,borderRadius:20,backgroundColor:C.mint,color:C.navy,fontSize:12,fontWeight:'800'},order:{flexDirection:'row',alignItems:'center',paddingVertical:13,borderBottomWidth:1,borderBottomColor:C.line},rank:{width:28,height:28,borderRadius:14,backgroundColor:C.navy,color:C.white,textAlign:'center',paddingTop:5,fontWeight:'900',marginRight:10},rate:{fontWeight:'900',color:C.teal},result:{backgroundColor:C.mint,borderRadius:14,padding:16,marginTop:18},resultValue:{fontSize:24,fontWeight:'900',color:C.navy,marginBottom:10},note:{fontSize:12,color:C.muted,lineHeight:18,marginTop:15},month:{fontSize:18,fontWeight:'900',color:C.navy,marginBottom:10},event:{flexDirection:'row',alignItems:'center',paddingVertical:14,borderBottomWidth:1,borderBottomColor:C.line},dot:{width:10,height:10,borderRadius:5,backgroundColor:C.teal,marginRight:12},progress:{height:14,width:'100%',backgroundColor:'#E9EEF5',borderRadius:8,overflow:'hidden',marginTop:18},progressFill:{height:'100%',backgroundColor:C.teal},percent:{fontSize:20,fontWeight:'900',color:C.navy,marginTop:12},balanceValueDark:{fontSize:32,fontWeight:'900',color:C.teal},tabbar:{position:'absolute',bottom:0,left:0,right:0,height:78,backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.line,flexDirection:'row',justifyContent:'space-around',paddingTop:8},tab:{alignItems:'center',flex:1},tabIcon:{fontSize:20,color:C.muted},tabText:{fontSize:10,color:C.muted,marginTop:3}});
