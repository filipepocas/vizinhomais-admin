// src/App.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, query, where, addDoc } from 'firebase/firestore';
import type { Loja, Cliente, Movimento } from './interfaces';

const App = () => {
  const { user, role, perfil, loading } = useAuth();
  const [email, setLocalEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Estados Admin
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [novaLoja, setNovaLoja] = useState({ nome: '', email: '', nif: '', percentual: 10 });

  // Estados Comerciante
  const [novoCliente, setNovoCliente] = useState({ nome: '', email: '', nif: '', telefone: '' });
  const [venda, setVenda] = useState({ clienteEmail: '', valor: 0 });

  // Estados Cliente / Histórico Comum
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
          const q = query(collection(db, 'movimentos'), where('lojaId', '==', user.uid));
          const snap = await getDocs(q);
          setMovimentos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
        } 
        else if (role === 'cliente') {
          // O cliente vê movimentos associados ao seu EMAIL (chave de ligação)
          const q = query(collection(db, 'movimentos'), where('clienteId', '==', user.email));
          const snap = await getDocs(q);
          const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento));
          setMovimentos(lista);
          const total = lista.reduce((acc, curr) => acc + curr.valorCashback, 0);
          setSaldoTotal(total);
        }
      } catch (e) { console.error("Erro ao carregar dados:", e); }
    };
    fetchData();
  }, [role, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Credenciais inválidas."); }
  };

  // OPERAÇÕES ADMIN
  const criarLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, novaLoja.email, "loja123456");
      const dados: Loja = { id: res.user.uid, nome: novaLoja.nome, nomeLoja: novaLoja.nome, email: novaLoja.email, nif: novaLoja.nif, percentualCB: novaLoja.percentual, ativo: true };
      await setDoc(doc(db, 'lojas', res.user.uid), dados);
      alert("Loja Criada! Senha: loja123456");
      setLojas([...lojas, dados]);
    } catch (err: any) { alert(err.message); }
  };

  // OPERAÇÕES COMERCIANTE
  const registarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, novoCliente.email, "cliente123456");
      const dados: Cliente = { id: res.user.uid, nome: novoCliente.nome, email: novoCliente.email, nif: novoCliente.nif, numCartao: Date.now().toString(), dataRegisto: new Date().toISOString() };
      await setDoc(doc(db, 'clientes', res.user.uid), dados);
      alert("Cliente registado! Senha: cliente123456");
    } catch (err: any) { alert(err.message); }
  };

  const lancarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil) return;
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
    alert("Venda Registada!");
    setMovimentos([novoMov, ...movimentos]);
  };

  if (loading) return <div className="p-10 text-center font-bold">Sincronizando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-lg w-96 border-b-4 border-blue-500">
          <h1 className="text-2xl font-bold mb-6 text-center text-blue-700">VizinhoMais</h1>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <input type="email" placeholder="Email" className="w-full p-2 mb-3 border rounded" onChange={e => setLocalEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-2 mb-5 border rounded" onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-blue-600 text-white p-2 rounded font-bold">ENTRAR NO SISTEMA</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <nav className="max-w-6xl mx-auto flex justify-between items-center p-4 bg-white rounded shadow-sm mb-6">
        <h2 className="font-black text-blue-600 tracking-tighter">VIZINHO+ <span className="text-gray-400">| {role?.toUpperCase()}</span></h2>
        <button onClick={() => signOut(auth)} className="bg-gray-200 px-4 py-1 rounded text-sm font-bold">SAIR</button>
      </nav>

      <main className="max-w-6xl mx-auto">
        {role === 'admin' && (
          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-white p-6 rounded shadow">
              <h3 className="font-bold mb-4 border-b">Nova Loja</h3>
              <form onSubmit={criarLoja} className="space-y-3">
                <input type="text" placeholder="Nome Loja" className="w-full p-2 border" onChange={e => setNovaLoja({...novaLoja, nome: e.target.value})} />
                <input type="email" placeholder="Email Comerciante" className="w-full p-2 border" onChange={e => setNovaLoja({...novaLoja, email: e.target.value})} />
                <input type="text" placeholder="NIF" className="w-full p-2 border" onChange={e => setNovaLoja({...novaLoja, nif: e.target.value})} />
                <button className="w-full bg-green-600 text-white p-2 rounded">CRIAR COMERCIANTE</button>
              </form>
            </section>
            <section className="bg-white p-6 rounded shadow">
              <h3 className="font-bold mb-4 border-b">Lojas no Sistema</h3>
              {lojas.map(l => <div key={l.id} className="p-2 border-b text-sm">{l.nomeLoja} ({l.percentualCB}%)</div>)}
            </section>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-white p-6 rounded shadow">
              <h3 className="font-bold mb-4 border-b text-orange-600">Registo de Cliente</h3>
              <form onSubmit={registarCliente} className="space-y-3">
                <input type="text" placeholder="Nome Completo" className="w-full p-2 border" onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} />
                <input type="email" placeholder="Email do Cliente" className="w-full p-2 border" onChange={e => setNovoCliente({...novoCliente, email: e.target.value})} />
                <button className="w-full bg-orange-500 text-white p-2 rounded font-bold">REGISTAR CLIENTE</button>
              </form>
            </section>
            <section className="bg-white p-6 rounded shadow">
              <h3 className="font-bold mb-4 border-b text-blue-600">Lançar Cashback</h3>
              <form onSubmit={lancarVenda} className="space-y-3">
                <input type="email" placeholder="Email do Cliente" className="w-full p-2 border" onChange={e => setVenda({...venda, clienteEmail: e.target.value})} />
                <input type="number" placeholder="Valor Compra (€)" className="w-full p-2 border" onChange={e => setVenda({...venda, valor: Number(e.target.value)})} />
                <button className="w-full bg-blue-600 text-white p-2 rounded font-bold">CONFIRMAR VENDA</button>
              </form>
            </section>
          </div>
        )}

        {role === 'cliente' && (
          <div className="space-y-6">
            <section className="bg-blue-600 text-white p-8 rounded-xl shadow-lg text-center">
              <p className="text-blue-100 uppercase text-xs font-bold tracking-widest mb-2">Saldo Acumulado</p>
              <h2 className="text-5xl font-black">{saldoTotal.toFixed(2)}€</h2>
            </section>
            <section className="bg-white p-6 rounded shadow">
              <h3 className="font-bold mb-4 border-b">O Meu Histórico</h3>
              <div className="space-y-4">
                {movimentos.map(m => (
                  <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-bold">{(m as any).nomeLoja || 'Loja Vizinho'}</p>
                      <p className="text-xs text-gray-400">{new Date(m.dataHora).toLocaleDateString()}</p>
                    </div>
                    <p className="text-green-600 font-bold">+{m.valorCashback.toFixed(2)}€</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;