// src/App.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, query, where, addDoc, orderBy } from 'firebase/firestore';
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
        } 
        else if (role === 'comerciante') {
          const q = query(collection(db, 'movimentos'), where('lojaId', '==', user.uid), orderBy('dataHora', 'desc'));
          const snap = await getDocs(q);
          setMovimentos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
        } 
        else if (role === 'cliente') {
          const q = query(collection(db, 'movimentos'), where('clienteId', '==', user.email), orderBy('dataHora', 'desc'));
          const snap = await getDocs(q);
          const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento));
          setMovimentos(lista);
          setSaldoTotal(lista.reduce((acc, curr) => acc + curr.valorCashback, 0));
        }
      } catch (e) { console.error("Erro ao carregar dados:", e); }
    };
    fetchData();
  }, [role, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try { 
      await signInWithEmailAndPassword(auth, email, password); 
    } catch (err: any) { 
      setError("Acesso negado. Verifique os dados."); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const criarLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaLoja.nif.length !== 9) return alert("NIF deve ter 9 dígitos");
    setIsSubmitting(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, novaLoja.email, "loja123456");
      const dados: Loja = { id: res.user.uid, nome: novaLoja.nome, nomeLoja: novaLoja.nome, email: novaLoja.email, nif: novaLoja.nif, percentualCB: novaLoja.percentual, ativo: true };
      await setDoc(doc(db, 'lojas', res.user.uid), dados);
      setLojas([dados, ...lojas]);
      setNovaLoja({ nome: '', email: '', nif: '', percentual: 10 });
      alert("Comerciante registado com sucesso!");
    } catch (err: any) { alert("Erro: " + err.message); }
    finally { setIsSubmitting(false); }
  };

  const registarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, novoCliente.email, "cliente123456");
      const dados: Cliente = { id: res.user.uid, nome: novoCliente.nome, email: novoCliente.email, nif: novoCliente.nif, numCartao: Date.now().toString(), dataRegisto: new Date().toISOString() };
      await setDoc(doc(db, 'clientes', res.user.uid), dados);
      alert("Cliente registado! Password padrão: cliente123456");
      setNovoCliente({ nome: '', email: '', nif: '', telefone: '' });
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const lancarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil || venda.valor <= 0) return alert("Insira um valor válido");
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
      setVenda({ clienteEmail: '', valor: 0 });
      alert(`Sucesso! Cashback de ${valorCB.toFixed(2)}€ atribuído.`);
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center font-mono">INICIALIZANDO_VIZINHO_MAIS...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Vizinho+</h1>
            <p className="text-slate-400 text-sm">Painel de Controlo Unificado</p>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-center text-sm font-bold border border-red-100">{error}</div>}
          <div className="space-y-4">
            <input type="email" placeholder="Email institucional" className="w-full p-4 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" onChange={e => setLocalEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="w-full p-4 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" onChange={e => setPassword(e.target.value)} required />
            <button disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-200 transition disabled:opacity-50">
              {isSubmitting ? "A AUTENTICAR..." : "ENTRAR NO SISTEMA"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b sticky top-0 z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
            <h2 className="font-black text-slate-800 text-xl tracking-tighter uppercase italic">Vizinho+</h2>
            <span className="hidden md:inline px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">{role?.toUpperCase()}</span>
          </div>
          <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-500 font-medium text-sm transition">Encerrar Sessão</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {role === 'admin' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <h3 className="font-bold text-slate-800 mb-6">Novo Comerciante</h3>
                <form onSubmit={criarLoja} className="space-y-4">
                  <input type="text" placeholder="Nome do Estabelecimento" className="w-full p-3 bg-slate-50 rounded-lg text-sm" value={novaLoja.nome} onChange={e => setNovaLoja({...novaLoja, nome: e.target.value})} required />
                  <input type="email" placeholder="Email de Login" className="w-full p-3 bg-slate-50 rounded-lg text-sm" value={novaLoja.email} onChange={e => setNovaLoja({...novaLoja, email: e.target.value})} required />
                  <input type="text" placeholder="NIF (9 dígitos)" className="w-full p-3 bg-slate-50 rounded-lg text-sm" value={novaLoja.nif} onChange={e => setNovaLoja({...novaLoja, nif: e.target.value})} required />
                  <button disabled={isSubmitting} className="w-full bg-slate-900 text-white p-3 rounded-lg font-bold hover:bg-slate-800 transition">REGISTAR LOJA</button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="p-4">Estabelecimento</th>
                      <th className="p-4">NIF</th>
                      <th className="p-4 text-right">Cashback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {lojas.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50 transition">
                        <td className="p-4 font-bold text-slate-700">{l.nomeLoja}</td>
                        <td className="p-4 text-slate-500">{l.nif}</td>
                        <td className="p-4 text-right font-mono text-blue-600">{l.percentualCB}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <section className="space-y-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <h3 className="font-bold text-orange-600 mb-6">Registo Rápido de Cliente</h3>
                <form onSubmit={registarCliente} className="space-y-4">
                  <input type="text" placeholder="Nome Completo" className="w-full p-3 bg-slate-50 rounded-lg text-sm" value={novoCliente.nome} onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} required />
                  <input type="email" placeholder="Email do Cliente" className="w-full p-3 bg-slate-50 rounded-lg text-sm" value={novoCliente.email} onChange={e => setNovoCliente({...novoCliente, email: e.target.value})} required />
                  <button disabled={isSubmitting} className="w-full bg-orange-500 text-white p-3 rounded-lg font-bold">CRIAR CONTA CLIENTE</button>
                </form>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <h3 className="font-bold text-blue-600 mb-6">Atribuir Cashback</h3>
                <form onSubmit={lancarVenda} className="space-y-4">
                  <input type="email" placeholder="Email do Cliente" className="w-full p-3 bg-slate-50 rounded-lg text-sm" value={venda.clienteEmail} onChange={e => setVenda({...venda, clienteEmail: e.target.value})} required />
                  <input type="number" placeholder="Valor da Fatura (€)" className="w-full p-3 bg-slate-50 rounded-lg text-sm" value={venda.valor || ''} onChange={e => setVenda({...venda, valor: Number(e.target.value)})} required />
                  <button disabled={isSubmitting} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold">CONFIRMAR E GERAR SALDO</button>
                </form>
              </div>
            </section>
            <section className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="font-bold text-slate-800 mb-6">Últimos Lançamentos</h3>
              <div className="space-y-4">
                {movimentos.map(m => (
                  <div key={m.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <span className="text-xs font-mono text-slate-400">{m.clienteId}</span>
                    <span className="font-bold text-green-600">+{m.valorCashback.toFixed(2)}€</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {role === 'cliente' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-10 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-2">O teu saldo Vizinho+</p>
                <h2 className="text-6xl font-black italic tracking-tighter">{saldoTotal.toFixed(2)}€</h2>
              </div>
              <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="font-bold text-slate-800 mb-6">Histórico de Cashback</h3>
              <div className="divide-y">
                {movimentos.map(m => (
                  <div key={m.id} className="py-4 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-700">{(m as any).nomeLoja}</p>
                      <p className="text-[10px] text-slate-400">{new Date(m.dataHora).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-green-600">+{m.valorCashback.toFixed(2)}€</p>
                      <p className="text-[10px] text-slate-400">Compra: {m.valorVenda.toFixed(2)}€</p>
                    </div>
                  </div>
                ))}
                {movimentos.length === 0 && <p className="text-center py-10 text-slate-400 italic">Ainda não tens movimentos. Começa a comprar no comércio local!</p>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;