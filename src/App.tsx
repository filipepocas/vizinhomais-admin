// src/App.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, query, where, addDoc, orderBy } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode'; // Biblioteca de leitura
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
          const snap = await getDocs(collection(db, 'lojas'));
          setLojas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
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

  // Lógica do Scanner QR Code
  useEffect(() => {
    if (isScanning && role === 'comerciante') {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        setVenda(prev => ({ ...prev, clienteEmail: decodedText }));
        setResgate(prev => ({ ...prev, clienteEmail: decodedText }));
        setIsScanning(false);
        scanner.clear();
      }, (err) => { /* ignore errors */ });
      return () => { scanner.clear(); };
    }
  }, [isScanning, role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Acesso negado."); }
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
      alert("Loja Criada!");
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  }

  const lancarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil) return;
    setIsSubmitting(true);
    try {
      const loja = perfil as Loja;
      const valorCB = (venda.valor * loja.percentualCB) / 100;
      const novoMov: any = {
        tipo: 'ADICIONAR',
        valorVenda: venda.valor,
        valorCashback: valorCB,
        clienteId: venda.clienteEmail,
        lojaId: user?.uid,
        nomeLoja: loja.nomeLoja,
        dataHora: new Date().toISOString(),
        status: 'PENDENTE'
      };
      await addDoc(collection(db, 'movimentos'), novoMov);
      setMovimentos([novoMov, ...movimentos]);
      alert("Venda Registada!");
      setVenda({ clienteEmail: '', valor: 0 });
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  }

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

  if (authLoading) return <div className="h-screen flex items-center justify-center font-bold tracking-widest text-blue-600">VIZINHO+ CARREGANDO...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-3xl w-full max-w-sm shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black italic tracking-tighter text-slate-900">V+</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Sistema Local</p>
          </div>
          {error && <div className="mb-6 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center border border-red-100">{error}</div>}
          <div className="space-y-4">
            <input type="email" placeholder="Email institucional" className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition" onChange={e => setLocalEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition" onChange={e => setPassword(e.target.value)} required />
            <button disabled={isSubmitting} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition disabled:opacity-50">Entrar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center font-black text-white italic text-xs">V+</div>
          <h2 className="font-black text-slate-900 text-lg uppercase tracking-tighter">Vizinho+ <span className="text-slate-300 font-normal">| {role}</span></h2>
        </div>
        <button onClick={() => signOut(auth)} className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest">Sair</button>
      </nav>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {role === 'admin' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <section className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-fit">
              <h3 className="font-black text-slate-800 mb-6 uppercase text-xs tracking-widest">Nova Loja Adesa</h3>
              <form onSubmit={criarLoja} className="space-y-4">
                <input type="text" placeholder="Nome Comercial" className="w-full p-3 bg-slate-50 rounded-xl" onChange={e => setNovaLoja({...novaLoja, nome: e.target.value})} required />
                <input type="email" placeholder="Email" className="w-full p-3 bg-slate-50 rounded-xl" onChange={e => setNovaLoja({...novaLoja, email: e.target.value})} required />
                <input type="text" placeholder="NIF" className="w-full p-3 bg-slate-50 rounded-xl" onChange={e => setNovaLoja({...novaLoja, nif: e.target.value})} required />
                <button className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold uppercase text-xs">Registar Comerciante</button>
              </form>
            </section>
            <section className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b"><h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Rede Vizinho+</h3></div>
              <div className="divide-y">
                {lojas.map(l => <div key={l.id} className="p-6 flex justify-between items-center hover:bg-slate-50 transition"><span className="font-bold text-slate-700">{l.nomeLoja}</span><span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-black">{l.percentualCB}%</span></div>)}
              </div>
            </section>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Operação de Caixa</h3>
                  <button onClick={() => setIsScanning(!isScanning)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition">
                    {isScanning ? "Fechar Câmara" : "Ler QR Code"}
                  </button>
                </div>
                {isScanning && <div id="reader" className="mb-6 rounded-2xl overflow-hidden border-2 border-dashed border-blue-400"></div>}
                
                <form onSubmit={lancarVenda} className="space-y-4 mb-8">
                  <p className="text-[10px] font-bold text-blue-600 uppercase">Dar Cashback</p>
                  <input type="email" placeholder="Email do Cliente" className="w-full p-4 bg-slate-50 rounded-xl font-bold" value={venda.clienteEmail} onChange={e => setVenda({...venda, clienteEmail: e.target.value})} required />
                  <input type="number" placeholder="Valor Compra €" className="w-full p-4 bg-slate-50 rounded-xl text-2xl font-black" value={venda.valor || ''} onChange={e => setVenda({...venda, valor: Number(e.target.value)})} required />
                  <button className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-100">Confirmar Ganho</button>
                </form>

                <form onSubmit={processarResgate} className="space-y-4 pt-6 border-t border-dashed">
                  <p className="text-[10px] font-bold text-orange-600 uppercase">Resgatar Saldo</p>
                  <input type="email" placeholder="Email do Cliente" className="w-full p-4 bg-slate-50 rounded-xl" value={resgate.clienteEmail} onChange={e => setResgate({...resgate, clienteEmail: e.target.value})} required />
                  <input type="number" placeholder="Valor Desconto €" className="w-full p-4 bg-slate-50 rounded-xl font-black" value={resgate.valor || ''} onChange={e => setResgate({...resgate, valor: Number(e.target.value)})} required />
                  <button className="w-full bg-orange-500 text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-orange-100">Aplicar Abatimento</button>
                </form>
              </div>
            </div>
            <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6">Movimentos do Ponto de Venda</h3>
              <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
                {movimentos.map(m => (
                  <div key={m.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center group hover:bg-white hover:border-blue-200 border border-transparent transition">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${m.tipo === 'ADICIONAR' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{m.clienteId}</p><p className="text-[9px] text-slate-300 font-mono">{new Date(m.dataHora).toLocaleString()}</p></div>
                    </div>
                    <span className={`font-black ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {role === 'cliente' && (
          <div className="max-w-md mx-auto space-y-8">
            <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl flex flex-col items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[80px] opacity-30"></div>
              <div className="bg-white p-5 rounded-3xl mb-8 shadow-2xl"><QRCodeSVG value={user.email || ""} size={180} level={"H"} /></div>
              <div className="text-center z-10">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Carteira Virtual</p>
                <h2 className="text-6xl font-black italic tracking-tighter mb-4">{saldoTotal.toFixed(2)}€</h2>
                <span className="bg-white/10 px-4 py-2 rounded-full text-[10px] font-mono text-slate-400 tracking-tighter">{user.email}</span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-8 border-b pb-4">Extrato Pessoal</h3>
              <div className="space-y-6">
                {movimentos.map(m => (
                  <div key={m.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs ${m.tipo === 'ADICIONAR' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{m.tipo === 'ADICIONAR' ? 'IN' : 'OUT'}</div>
                      <div><p className="font-bold text-slate-800 text-sm">{(m as any).nomeLoja}</p><p className="text-[10px] text-slate-400 uppercase font-bold">{new Date(m.dataHora).toLocaleDateString()}</p></div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</p>
                      <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tighter">Valor: {m.valorVenda.toFixed(2)}€</p>
                    </div>
                  </div>
                ))}
                {movimentos.length === 0 && <div className="text-center py-10"><p className="text-slate-300 italic text-sm font-medium">Ainda não tens movimentos acumulados.</p></div>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;