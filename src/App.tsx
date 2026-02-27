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
  const [movimentosLoja, setMovimentosLoja] = useState<Movimento[]>([]);

  // Carregar dados dependendo do Role
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      if (role === 'admin') {
        const querySnapshot = await getDocs(collection(db, 'lojas'));
        setLojas(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
      } else if (role === 'comerciante' && user) {
        const q = query(collection(db, 'movimentos'), where('lojaId', '==', user.uid));
        const snap = await getDocs(q);
        setMovimentosLoja(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
      }
    };
    fetchData();
  }, [role, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Credenciais inválidas."); }
  };

  // FUNÇÕES ADMIN
  const criarLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, novaLoja.email, "loja123456");
      const dados: Loja = { id: res.user.uid, nome: novaLoja.nome, nomeLoja: novaLoja.nome, email: novaLoja.email, nif: novaLoja.nif, percentualCB: novaLoja.percentual, ativo: true };
      await setDoc(doc(db, 'lojas', res.user.uid), dados);
      setLojas([...lojas, dados]);
      alert("Loja criada!");
    } catch (err: any) { alert(err.message); }
  };

  // FUNÇÕES COMERCIANTE
  const registarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, novoCliente.email, "cliente123456");
      const dados: Cliente = { id: res.user.uid, nome: novoCliente.nome, email: novoCliente.email, nif: novoCliente.nif, numCartao: Date.now().toString(), dataRegisto: new Date().toISOString() };
      await setDoc(doc(db, 'clientes', res.user.uid), dados);
      alert("Cliente registado com sucesso!");
    } catch (err: any) { alert(err.message); }
  };

  const lancarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil || role !== 'comerciante') return;
    const loja = perfil as Loja;
    const valorCB = (venda.valor * loja.percentualCB) / 100;
    
    const novoMov: Partial<Movimento> = {
      tipo: 'ADICIONAR',
      valorVenda: venda.valor,
      valorCashback: valorCB,
      clienteId: venda.clienteEmail, // Simplificado para o teste inicial
      lojaId: user?.uid || '',
      dataHora: new Date().toISOString(),
      status: 'PENDENTE'
    };
    await addDoc(collection(db, 'movimentos'), novoMov);
    alert("Venda lançada! Cashback: " + valorCB + "€");
  };

  if (loading) return <div className="p-10 text-center">A carregar...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-96">
          <h1 className="text-xl font-bold mb-4">VizinhoMais Login</h1>
          <input type="email" placeholder="Email" className="w-full p-2 mb-2 border" onChange={e => setLocalEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-2 mb-4 border" onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-blue-600 text-white p-2 rounded">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <nav className="flex justify-between p-4 bg-white shadow mb-6">
        <span className="font-bold text-blue-600">VizinhoMais - {role?.toUpperCase()}</span>
        <button onClick={() => signOut(auth)} className="text-red-500">Sair</button>
      </nav>

      {role === 'admin' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white p-4 shadow">
            <h2 className="font-bold mb-4">Criar Loja</h2>
            <form onSubmit={criarLoja} className="space-y-2">
              <input type="text" placeholder="Nome" className="w-full p-2 border" onChange={e => setNovaLoja({...novaLoja, nome: e.target.value})} />
              <input type="email" placeholder="Email" className="w-full p-2 border" onChange={e => setNovaLoja({...novaLoja, email: e.target.value})} />
              <input type="text" placeholder="NIF" className="w-full p-2 border" onChange={e => setNovaLoja({...novaLoja, nif: e.target.value})} />
              <button className="w-full bg-green-600 text-white p-2">Criar</button>
            </form>
          </section>
          <section className="bg-white p-4 shadow">
            <h2 className="font-bold mb-4">Lojas Ativas</h2>
            {lojas.map(l => <div key={l.id} className="border-b p-2">{l.nomeLoja} - {l.percentualCB}%</div>)}
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white p-4 shadow">
            <h2 className="font-bold mb-4">Registar Cliente</h2>
            <form onSubmit={registarCliente} className="space-y-2">
              <input type="text" placeholder="Nome Cliente" className="w-full p-2 border" onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} />
              <input type="email" placeholder="Email Cliente" className="w-full p-2 border" onChange={e => setNovoCliente({...novoCliente, email: e.target.value})} />
              <button className="w-full bg-blue-600 text-white p-2">Registar Cliente</button>
            </form>
          </section>
          <section className="bg-white p-4 shadow">
            <h2 className="font-bold mb-4">Lançar Venda (Cashback)</h2>
            <form onSubmit={lancarVenda} className="space-y-2">
              <input type="email" placeholder="Email do Cliente" className="w-full p-2 border" onChange={e => setVenda({...venda, clienteEmail: e.target.value})} />
              <input type="number" placeholder="Valor da Venda (€)" className="w-full p-2 border" onChange={e => setVenda({...venda, valor: Number(e.target.value)})} />
              <button className="w-full bg-orange-500 text-white p-2">Confirmar Cashback</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default App;