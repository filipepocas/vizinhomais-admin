import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, orderBy } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import type { Movimento, Loja } from './interfaces';

const App = () => {
  const { user, role, perfil, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [venda, setVenda] = useState({ clienteEmail: '', valor: 0, doc: '' });

  // Lógica de Saldos [cite: 30, 31, 34]
  const calcularSaldos = (lista: Movimento[]) => {
    const agora = new Date();
    const limite48h = new Date(agora.getTime() - (48 * 60 * 60 * 1000));

    const total = lista.reduce((acc, m) => m.tipo === 'ADICIONAR' ? acc + m.valorCashback : acc - m.valorCashback, 0);
    
    const disponível = lista.reduce((acc, m) => {
      const dataMov = new Date(m.dataHora);
      // Adições só contam após 48h. Subtrações contam sempre. [cite: 30, 65]
      if (m.tipo === 'ADICIONAR') {
        return dataMov <= limite48h ? acc + m.valorCashback : acc;
      }
      return acc - m.valorCashback;
    }, 0);

    return { total, disponível: disponível < 0 ? 0 : disponível };
  };

  useEffect(() => {
    if (user && role) {
      const q = query(collection(db, 'movimentos'), 
                where(role === 'cliente' ? 'clienteId' : 'lojaId', '==', role === 'cliente' ? user.email : user.uid),
                orderBy('dataHora', 'desc'));
      getDocs(q).then(s => setMovimentos(s.docs.map(d => ({ id: d.id, ...d.data() } as Movimento))));
    }
  }, [user, role]);

  if (loading) return <div className="p-10 font-black">A carregar Vizinho+...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }} className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md">
          <h1 className="text-3xl font-black text-blue-600 mb-6 text-center italic">Vizinho+</h1>
          <input type="email" placeholder="Email" className="w-full p-4 mb-4 bg-slate-50 rounded-xl border" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-4 mb-6 bg-slate-50 rounded-xl border" onChange={e => setPassword(e.target.value)} />
          <button className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold uppercase">Entrar</button>
        </form>
      </div>
    );
  }

  const { total, disponível } = calcularSaldos(movimentos);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-2xl font-black italic">V+ <span className="text-blue-600 uppercase text-sm not-italic">[{role}]</span></h1>
        <button onClick={() => signOut(auth)} className="text-xs font-bold text-slate-400 uppercase">Sair</button>
      </header>

      {/* ÁREA ADMIN [cite: 36] */}
      {role === 'admin' && (
        <div className="grid gap-6">
          <div className="bg-slate-900 text-white p-8 rounded-3xl">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Monitorização Global</p>
            <h2 className="text-4xl font-black italic">Saldos em Circulação</h2>
          </div>
          {/* Listagem de Clientes/Comerciantes virá aqui no próximo passo */}
        </div>
      )}

      {/* ÁREA COMERCIANTE [cite: 46] */}
      {role === 'comerciante' && (
        <div className="grid lg:grid-cols-2 gap-8">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border">
            <h3 className="font-black text-xs uppercase mb-6 tracking-widest text-blue-600">Nova Operação</h3>
            <div className="space-y-4">
              <input type="email" placeholder="Email do Cliente" className="w-full p-4 bg-slate-50 rounded-xl font-bold" value={venda.clienteEmail} onChange={e => setVenda({...venda, clienteEmail: e.target.value})} />
              <input type="number" placeholder="Valor €" className="w-full p-4 bg-slate-50 rounded-xl text-2xl font-black" value={venda.valor || ''} onChange={e => setVenda({...venda, valor: Number(e.target.value)})} />
              <input type="text" placeholder="Nº Documento (Fatura/NC)" className="w-full p-4 bg-slate-50 rounded-xl" value={venda.doc} onChange={e => setVenda({...venda, doc: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => {/* Lógica Adicionar */}} className="bg-slate-900 text-white p-4 rounded-xl font-bold uppercase text-[10px]">Atribuir</button>
                <button onClick={() => {/* Lógica Desconto */}} className="border-2 border-slate-900 p-4 rounded-xl font-bold uppercase text-[10px]">Descontar</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ÁREA CLIENTE [cite: 17] */}
      {role === 'cliente' && (
        <div className="max-w-md mx-auto space-y-6">
          <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center">
            <div className="bg-white p-4 rounded-2xl mb-8"><QRCodeSVG value={user.email || ""} size={140} /></div>
            <p className="text-slate-500 text-[10px] font-black uppercase mb-2">Saldo Disponível</p>
            <h2 className="text-6xl font-black italic mb-6">{disponível.toFixed(2)}€</h2>
            <div className="w-full pt-6 border-t border-white/10 flex justify-between">
              <div className="text-left"><p className="text-[8px] uppercase text-slate-500">Saldo Total</p><p className="font-bold">{total.toFixed(2)}€</p></div>
              <div className="text-right"><p className="text-[8px] uppercase text-slate-500">NIF</p><p className="font-bold">{(perfil as any)?.nif}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;