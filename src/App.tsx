// src/App.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, query, where, addDoc, orderBy } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { Loja, Cliente, Movimento } from './interfaces';

const App = () => {
  const { user, role, perfil, loading: authLoading } = useAuth();
  const [email, setLocalEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados Admin
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [novaLoja, setNovaLoja] = useState({ nome: '', email: '', nif: '', percentual: 10 });
  const [movimentosGlobais, setMovimentosGlobais] = useState<Movimento[]>([]);
  const [statsAdmin, setStatsAdmin] = useState({ totalGerado: 0, totalResgatado: 0 });

  // Estados Comerciante
  const [novoCliente, setNovoCliente] = useState({ nome: '', email: '', nif: '', telefone: '' });
  const [venda, setVenda] = useState({ clienteEmail: '', valor: 0 });
  const [resgate, setResgate] = useState({ clienteEmail: '', valor: 0 });
  const [isScanning, setIsScanning] = useState(false);

  // Estados Cliente / Histórico
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [saldoTotal, setSaldoTotal] = useState(0);

  useEffect(() => {
    if (!user || !role) return;
    const fetchData = async () => {
      try {
        if (role === 'admin') {
          // Carregar Lojas
          const lojasSnap = await getDocs(collection(db, 'lojas'));
          const listaLojas = lojasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Loja));
          setLojas(listaLojas);

          // Carregar Todos os Movimentos para Auditoria
          const movsSnap = await getDocs(query(collection(db, 'movimentos'), orderBy('dataHora', 'desc')));
          const todosMovs = movsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento));
          setMovimentosGlobais(todosMovs);

          // Calcular Estatísticas Globais
          const gerado = todosMovs.filter(m => m.tipo === 'ADICIONAR').reduce((a, b) => a + b.valorCashback, 0);
          const resgatado = todosMovs.filter(m => m.tipo === 'SUBTRAIR').reduce((a, b) => a + b.valorCashback, 0);
          setStatsAdmin({ totalGerado: gerado, totalResgatado: resgatado });
        } else {
          const field = role === 'comerciante' ? 'lojaId' : 'clienteId';
          const value = role === 'comerciante' ? user.uid : user.email;
          const q = query(collection(db, 'movimentos'), where(field, '==', value), orderBy('dataHora', 'desc'));
          const snap = await getDocs(q);
          const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento));
          setMovimentos(lista);
          if (role === 'cliente') {
            const total = lista.reduce((acc, curr) => curr.tipo === 'ADICIONAR' ? acc + curr.valorCashback : acc - curr.valorCashback, 0);
            setSaldoTotal(total);
          }
        }
      } catch (e) { console.error("Erro ao carregar dados:", e); }
    };
    fetchData();
  }, [role, user]);

  useEffect(() => {
    if (isScanning && role === 'comerciante') {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        setVenda(prev => ({ ...prev, clienteEmail: decodedText }));
        setResgate(prev => ({ ...prev, clienteEmail: decodedText }));
        setIsScanning(false);
        scanner.clear();
      }, () => {});
      return () => { scanner.clear(); };
    }
  }, [isScanning, role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Falha na autenticação."); }
    finally { setIsSubmitting(false); }
  };

  const criarLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, novaLoja.email, "loja123456");
      const dados: Loja = { id: res.user.uid, nome: novaLoja.nome, nomeLoja: novaLoja.nome, email: novaLoja.email, nif: novaLoja.nif, percentualCB: novaLoja.percentual, ativo: true };
      await setDoc(doc(db, 'lojas', res.user.uid), dados);
      setLojas([dados, ...lojas]);
      alert("Loja criada!");
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const lancarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil) return;
    setIsSubmitting(true);
    try {
      const loja = perfil as Loja;
      const valorCB = (venda.valor * loja.percentualCB) / 100;
      const novoMov: any = { tipo: 'ADICIONAR', valorVenda: venda.valor, valorCashback: valorCB, clienteId: venda.clienteEmail, lojaId: user?.uid, nomeLoja: loja.nomeLoja, dataHora: new Date().toISOString(), status: 'PENDENTE' };
      await addDoc(collection(db, 'movimentos'), novoMov);
      setMovimentos([novoMov, ...movimentos]);
      alert("Cashback atribuído!");
      setVenda({ clienteEmail: '', valor: 0 });
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const processarResgate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil || resgate.valor <= 0) return;
    setIsSubmitting(true);
    try {
      const q = query(collection(db, 'movimentos'), where('clienteId', '==', resgate.clienteEmail));
      const snap = await getDocs(q);
      const mvs = snap.docs.map(d => d.data() as Movimento);
      const saldoC = mvs.reduce((acc, curr) => curr.tipo === 'ADICIONAR' ? acc + curr.valorCashback : acc - curr.valorCashback, 0);
      if (saldoC < resgate.valor) { alert("Saldo insuficiente!"); setIsSubmitting(false); return; }
      const loja = perfil as Loja;
      const movSub: any = { tipo: 'SUBTRAIR', valorVenda: 0, valorCashback: resgate.valor, clienteId: resgate.clienteEmail, lojaId: user?.uid, nomeLoja: loja.nomeLoja, dataHora: new Date().toISOString(), status: 'DISPONIVEL' };
      await addDoc(collection(db, 'movimentos'), movSub);
      setMovimentos([movSub, ...movimentos]);
      alert("Desconto aplicado!");
      setResgate({ clienteEmail: '', valor: 0 });
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center font-black text-slate-900">VIZINHO+ AGUARDE...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[2.5rem] w-full max-w-md shadow-2xl">
          <div className="text-center mb-10"><h1 className="text-5xl font-black italic tracking-tighter text-slate-900">V+</h1><p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">SISTEMA INTEGRADO</p></div>
          <div className="space-y-4">
            <input type="email" placeholder="Utilizador" className="w-full p-5 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setLocalEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="w-full p-5 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setPassword(e.target.value)} required />
            <button disabled={isSubmitting} className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition">Aceder</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-white border-b px-8 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center font-black text-white italic">V+</div>
          <h2 className="font-black text-slate-900 text-xl tracking-tighter uppercase">Painel <span className="text-blue-600">{role}</span></h2>
        </div>
        <button onClick={() => signOut(auth)} className="text-[10px] font-black text-slate-400 bg-slate-50 px-4 py-2 rounded-full hover:text-red-500 transition uppercase tracking-widest">Logout</button>
      </nav>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {role === 'admin' && (
          <div className="space-y-8">
            {/* DASHBOARD STATS */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cashback Atribuído</p>
                <h3 className="text-4xl font-black text-green-600 italic tracking-tighter">{statsAdmin.totalGerado.toFixed(2)}€</h3>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cashback Resgatado</p>
                <h3 className="text-4xl font-black text-red-600 italic tracking-tighter">{statsAdmin.totalResgatado.toFixed(2)}€</h3>
              </div>
              <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Saldo em Circulação</p>
                <h3 className="text-4xl font-black italic tracking-tighter">{(statsAdmin.totalGerado - statsAdmin.totalResgatado).toFixed(2)}€</h3>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <section className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-8 border-b pb-4">Configurar Nova Loja</h3>
                <form onSubmit={criarLoja} className="space-y-4">
                  <input type="text" placeholder="Nome do Estabelecimento" className="w-full p-4 bg-slate-50 rounded-2xl" onChange={e => setNovaLoja({...novaLoja, nome: e.target.value})} required />
                  <input type="email" placeholder="Email Administrativo" className="w-full p-4 bg-slate-50 rounded-2xl" onChange={e => setNovaLoja({...novaLoja, email: e.target.value})} required />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="NIF" className="w-full p-4 bg-slate-50 rounded-2xl" onChange={e => setNovaLoja({...novaLoja, nif: e.target.value})} required />
                    <input type="number" placeholder="% Cashback" className="w-full p-4 bg-slate-50 rounded-2xl" onChange={e => setNovaLoja({...novaLoja, percentual: Number(e.target.value)})} required />
                  </div>
                  <button className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-xs tracking-widest">Ativar Comerciante</button>
                </form>
              </section>

              <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b"><h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Auditoria de Movimentos (Real-Time)</h3></div>
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {movimentosGlobais.map(m => (
                    <div key={m.id} className="p-6 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase leading-none mb-1">{m.nomeLoja}</p>
                        <p className="text-[9px] text-slate-400 font-mono">Cliente: {m.clienteId}</p>
                      </div>
                      <div className="text-right">
                        <span className={`font-black text-sm ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</span>
                        <p className="text-[9px] text-slate-300 uppercase font-bold">{new Date(m.dataHora).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Ponto de Venda</h3>
                  <button onClick={() => setIsScanning(!isScanning)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">Scan QR</button>
                </div>
                {isScanning && <div id="reader" className="mb-8 rounded-3xl overflow-hidden border-4 border-slate-100 shadow-inner"></div>}
                <form onSubmit={lancarVenda} className="space-y-4 mb-10 pb-10 border-b border-dashed border-slate-200">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Venda + Cashback</p>
                  <input type="email" placeholder="Email do Cliente" className="w-full p-4 bg-slate-50 rounded-2xl font-bold" value={venda.clienteEmail} onChange={e => setVenda({...venda, clienteEmail: e.target.value})} required />
                  <input type="number" placeholder="Valor Total €" className="w-full p-5 bg-slate-50 rounded-2xl text-3xl font-black tracking-tighter" value={venda.valor || ''} onChange={e => setVenda({...venda, valor: Number(e.target.value)})} required />
                  <button className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100">Atribuir Cashback</button>
                </form>
                <form onSubmit={processarResgate} className="space-y-4">
                  <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Abatimento de Saldo</p>
                  <input type="email" placeholder="Email do Cliente" className="w-full p-4 bg-slate-50 rounded-2xl" value={resgate.clienteEmail} onChange={e => setResgate({...resgate, clienteEmail: e.target.value})} required />
                  <input type="number" placeholder="Valor a Descontar €" className="w-full p-5 bg-slate-50 rounded-2xl font-black" value={resgate.valor || ''} onChange={e => setResgate({...resgate, valor: Number(e.target.value)})} required />
                  <button className="w-full bg-orange-500 text-white p-5 rounded-2xl font-black uppercase text-xs tracking-widest">Finalizar Desconto</button>
                </form>
              </section>
            </div>
            <section className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-8 border-b pb-4">Movimentos da Loja</h3>
              <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
                {movimentos.map(m => (
                  <div key={m.id} className="p-5 bg-slate-50 rounded-2xl flex justify-between items-center border border-transparent hover:border-blue-100 transition">
                    <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">{m.clienteId}</p><p className="text-[9px] text-slate-300 font-mono">{new Date(m.dataHora).toLocaleString()}</p></div>
                    <span className={`font-black italic ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {role === 'cliente' && (
          <div className="max-w-md mx-auto space-y-8">
            <div className="bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl flex flex-col items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
              <div className="bg-white p-6 rounded-[2.5rem] mb-10 shadow-2xl border-8 border-slate-800"><QRCodeSVG value={user.email || ""} size={180} level={"H"} /></div>
              <div className="text-center z-10">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-3">Saldo Disponível</p>
                <h2 className="text-7xl font-black italic tracking-tighter mb-6">{saldoTotal.toFixed(2)}€</h2>
                <div className="bg-white/5 py-3 px-6 rounded-full border border-white/10"><p className="text-[10px] font-mono text-slate-400 tracking-tighter">{user.email}</p></div>
              </div>
            </div>
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-10 border-b pb-5">Meu Extrato V+</h3>
              <div className="space-y-8">
                {movimentos.map(m => (
                  <div key={m.id} className="flex justify-between items-center group">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black italic text-sm ${m.tipo === 'ADICIONAR' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{m.tipo === 'ADICIONAR' ? 'IN' : 'OUT'}</div>
                      <div><p className="font-black text-slate-800 uppercase text-sm">{(m as any).nomeLoja}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(m.dataHora).toLocaleDateString()}</p></div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black italic text-lg ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</p>
                      <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest">Base: {m.valorVenda.toFixed(2)}€</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;