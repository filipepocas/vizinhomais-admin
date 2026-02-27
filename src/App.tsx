// src/App.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, getDocs, doc, setDoc } from 'firebase/firestore';
import type { Loja } from './interfaces';

const App = () => {
  const { user, role, loading } = useAuth();
  const [email, setLocalEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Estados para Gestão de Lojas
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [novaLoja, setNovaLoja] = useState({ nome: '', email: '', nif: '', percentual: 10 });

  // Carregar lojas apenas se o utilizador for Admin
  useEffect(() => {
    if (role === 'admin') {
      const fetchLojas = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'lojas'));
          const lista = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loja));
          setLojas(lista);
        } catch (e) {
          console.error("Erro ao carregar lojas:", e);
        }
      };
      fetchLojas();
    }
  }, [role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError("Falha no login. Verifique o email e a password.");
    }
  };

  const criarLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Cria o utilizador no Firebase Auth para o comerciante
      // Definimos uma password padrão inicial para a loja
      const userCredential = await createUserWithEmailAndPassword(auth, novaLoja.email, "loja123456");
      const uid = userCredential.user.uid;

      // 2. Guarda os detalhes na coleção 'lojas' do Firestore
      const dadosLoja: Loja = {
        id: uid,
        nome: novaLoja.nome,
        nomeLoja: novaLoja.nome,
        email: novaLoja.email,
        nif: novaLoja.nif,
        percentualCB: novaLoja.percentual,
        ativo: true
      };

      await setDoc(doc(db, 'lojas', uid), dadosLoja);
      alert("Loja criada com sucesso! Password de acesso: loja123456");
      
      // Limpa formulário e atualiza lista
      setLojas([...lojas, dadosLoja]);
      setNovaLoja({ nome: '', email: '', nif: '', percentual: 10 });
    } catch (err: any) {
      alert("Erro ao criar loja: " + err.message);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold">A ligar ao VizinhoMais...</div>;

  // ECRÃ DE LOGIN (Se não houver utilizador ligado)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-xl w-96 border-t-4 border-blue-600">
          <h1 className="text-2xl font-bold mb-6 text-blue-800 text-center">VizinhoMais Admin</h1>
          {error && <p className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</p>}
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Email</label>
            <input type="email" className="w-full p-2 border rounded" required onChange={e => setLocalEmail(e.target.value)} />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold mb-1">Password</label>
            <input type="password" className="w-full p-2 border rounded" required onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700 transition">ENTRAR</button>
        </form>
      </div>
    );
  }

  // PAINEL DO ADMINISTRADOR (FILIPE)
  if (role === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <header className="flex justify-between items-center mb-8 bg-white p-5 rounded-lg shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">Painel de Gestão Geral</h1>
              <p className="text-sm text-gray-500">Ligado como: {user.email} (ADMIN)</p>
            </div>
            <button onClick={() => signOut(auth)} className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 font-bold">SAIR</button>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Secção: Criar Loja */}
            <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold mb-5 text-gray-800 border-b pb-2">Registar Novo Comerciante</h2>
              <form onSubmit={criarLoja} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold">Nome do Estabelecimento</label>
                  <input type="text" className="w-full p-2 border rounded" value={novaLoja.nome} required
                    onChange={e => setNovaLoja({...novaLoja, nome: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-semibold">Email de Acesso</label>
                  <input type="email" className="w-full p-2 border rounded" value={novaLoja.email} required
                    onChange={e => setNovaLoja({...novaLoja, email: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold">NIF</label>
                    <input type="text" className="w-full p-2 border rounded" value={novaLoja.nif} required
                      onChange={e => setNovaLoja({...novaLoja, nif: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold">Cashback (%)</label>
                    <input type="number" className="w-full p-2 border rounded" value={novaLoja.percentual}
                      onChange={e => setNovaLoja({...novaLoja, percentual: Number(e.target.value)})} />
                  </div>
                </div>
                <button type="submit" className="w-full bg-green-600 text-white p-3 rounded font-bold hover:bg-green-700">REGISTAR LOJA</button>
              </form>
            </section>

            {/* Secção: Lista de Lojas */}
            <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold mb-5 text-gray-800 border-b pb-2">Comerciantes Ativos</h2>
              <div className="overflow-y-auto max-h-[400px]">
                {lojas.length === 0 ? <p className="text-gray-400 italic">Nenhuma loja registada.</p> : 
                  lojas.map(l => (
                    <div key={l.id} className="p-4 mb-3 border rounded bg-gray-50 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-blue-700">{l.nomeLoja}</p>
                        <p className="text-xs text-gray-600">NIF: {l.nif} | {l.email}</p>
                      </div>
                      <div className="text-right">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                          {l.percentualCB}% CB
                        </span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ECRÃ PARA OUTROS ROLES (Loja ou Cliente)
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-10 rounded-lg shadow-md text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Olá, {role}!</h1>
        <p className="text-gray-600 mb-6 italic text-sm">Painel específico em desenvolvimento...</p>
        <button onClick={() => signOut(auth)} className="bg-black text-white px-8 py-2 rounded">Sair da Conta</button>
      </div>
    </div>
  );
};

export default App;