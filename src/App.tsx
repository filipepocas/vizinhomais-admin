import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, query, where, addDoc, orderBy } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { Loja, Movimento } from './interfaces';

const App = () => {
  const { user, role, perfil, loading: authLoading } = useAuth();
  const [email, setLocalEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados Admin
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [novaLoja, setNovaLoja] = useState({ nome: '', email: '', nif: '', percentual: 10 });
  const [statsAdmin, setStatsAdmin] = useState({ totalGerado: 0, totalResgatado: 0 });

  // Estados Comerciante/Cliente
  const [venda, setVenda] = useState({ clienteEmail: '', valor: 0 });
  const [resgate, setResgate] = useState({ valor: 0 });
  const [isScanning, setIsScanning] = useState(false);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [saldoTotal, setSaldoTotal] = useState(0);

  useEffect(() => {
    if (!user || !role) return;
    const fetchData = async () => {
      try {
        if (role === 'admin') {
          const lojasSnap = await getDocs(collection(db, 'lojas'));
          setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
          const movsSnap = await getDocs(collection(db, 'movimentos'));
          const todos = movsSnap.docs.map(d => d.data() as Movimento);
          setStatsAdmin({
            totalGerado: todos.filter(m => m.tipo === 'ADICIONAR').reduce((a, b) => a + b.valorCashback, 0),
            totalResgatado: todos.filter(m => m.tipo === 'SUBTRAIR').reduce((a, b) => a + b.valorCashback, 0)
          });
        } else {
          const field = role === 'comerciante' ? 'lojaId' : 'clienteId';
          const q = query(collection(db, 'movimentos'), where(field, '==', role === 'comerciante' ? user.uid : user.email), orderBy('dataHora', 'desc'));
          const snap = await getDocs(q);
          const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento));
          setMovimentos(lista);
          if (role === 'cliente') {
            setSaldoTotal(lista.reduce((acc, curr) => curr.tipo === 'ADICIONAR' ? acc + curr.valorCashback : acc - curr.valorCashback, 0));
          }
        }
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [role, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Credenciais inválidas."); }
    finally { setIsSubmitting(false); }
  };

  const criarLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, novaLoja.email, "loja123456");
      const dados: Loja = { id: res.user.uid, nome: novaLoja.nome, nomeLoja: novaLoja.nome, email: novaLoja.email, nif: novaLoja.nif, percentualCB: novaLoja.percentual, ativo: true };
      await setDoc(doc(db, 'lojas', res.user.uid), dados);
      setLojas([...lojas, dados]);
      alert("Loja registada com sucesso!");
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center font-black text-blue-600 animate-pulse">CARREGANDO VIZINHO+...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2rem] w-full max-w-md shadow-2xl">
          <h1 className="text-4xl font-black italic text-center mb-8 text-slate-900">V+</h1>
          <div className="space-y-4">
            <input type="email" placeholder="Email" className="w-full p-4 bg-slate-100 rounded-xl outline-none" onChange={e => setLocalEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="w-full p-4 bg-slate-100 rounded-xl outline-none" onChange={e => setPassword(e.target.value)} required />
            <button disabled={isSubmitting} className="w-full bg-blue-600 text-white p-4 rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition">Entrar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">V+</div>
          <span className="font-black text-slate-900 uppercase tracking-tighter">Painel {role}</span>
        </div>
        <button onClick={() => signOut(auth)} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-red-50 hover:text-red-600 transition">Sair</button>
      </nav>

      <main className="p-8 max-w-6xl mx-auto">
        {role === 'admin' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Saldo Total em Rede</p>
                <h2 className="text-4xl font-black text-slate-900">{(statsAdmin.totalGerado - statsAdmin.totalResgatado).toFixed(2)}€</h2>
              </div>
              
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-black text-xs uppercase mb-6 tracking-widest text-blue-600">Registar Loja</h3>
                <form onSubmit={criarLoja} className="space-y-3">
                  <input type="text" placeholder="Nome Comercial" className="w-full p-3 bg-slate-50 rounded-lg border text-sm" onChange={e => setNovaLoja({...novaLoja, nome: e.target.value})} required />
                  <input type="email" placeholder="Email" className="w-full p-3 bg-slate-50 rounded-lg border text-sm" onChange={e => setNovaLoja({...novaLoja, email: e.target.value})} required />
                  <input type="number" placeholder="% Cashback" className="w-full p-3 bg-slate-50 rounded-lg border text-sm" onChange={e => setNovaLoja({...novaLoja, percentual: Number(e.target.value)})} required />
                  <button className="w-full bg-slate-900 text-white p-3 rounded-lg font-bold text-xs uppercase">Ativar Loja</button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b bg-slate-50"><h3 className="font-black text-xs uppercase tracking-widest">Lojas Adesas</h3></div>
              <div className="divide-y">
                {lojas.map(l => (
                  <div key={l.id} className="p-6 flex justify-between items-center hover:bg-slate-50 transition">
                    <div>
                      <p className="font-bold text-slate-900 uppercase">{l.nomeLoja}</p>
                      <p className="text-xs text-slate-400">{l.email}</p>
                    </div>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black">{l.percentualCB}% CB</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Layout simplificado para Cliente para garantir que vês algo */}
        {role === 'cliente' && (
          <div className="max-w-md mx-auto bg-white p-10 rounded-[3rem] shadow-xl text-center border">
            <div className="mb-8 inline-block p-4 bg-slate-50 rounded-3xl"><QRCodeSVG value={user.email || ""} size={180} /></div>
            <p className="text-slate-400 text-xs font-black uppercase mb-2">O teu Saldo</p>
            <h2 className="text-6xl font-black text-slate-900 italic">{saldoTotal.toFixed(2)}€</h2>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;