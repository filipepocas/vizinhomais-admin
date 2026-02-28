import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, orderBy } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import type { Movimento, Loja, Cliente } from './interfaces';

const App = () => {
  const { user, role, perfil, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  
  // Estados para Operação de Comerciante
  const [op, setOp] = useState({ clienteEmail: '', valor: 0, doc: '' });

  // Lógica de cálculo de saldos (Total vs Disponível 48h) [cite: 6, 30, 64]
  const calcularSaldos = (lista: Movimento[]) => {
    const agora = new Date();
    const limite48h = new Date(agora.getTime() - (48 * 60 * 60 * 1000));

    const total = lista.reduce((acc, m) => 
      m.tipo === 'ADICIONAR' ? acc + m.valorCashback : acc - m.valorCashback, 0);

    const disponivel = lista.reduce((acc, m) => {
      const dataMov = new Date(m.dataHora);
      if (m.tipo === 'ADICIONAR') {
        // Só fica disponível após 48h 
        return dataMov <= limite48h ? acc + m.valorCashback : acc;
      }
      // Subtrações e Descontos saem primeiro do disponível [cite: 31, 65]
      return acc - m.valorCashback;
    }, 0);

    return { total, disponivel: disponivel < 0 ? 0 : disponivel };
  };

  useEffect(() => {
    if (user && role) {
      const q = query(
        collection(db, 'movimentos'),
        where(role === 'cliente' ? 'clienteId' : 'lojaId', '==', role === 'cliente' ? user.email : user.uid),
        orderBy('dataHora', 'desc')
      );
      getDocs(q).then(s => setMovimentos(s.docs.map(d => ({ id: d.id, ...d.data() } as Movimento))));
    }
  }, [user, role]);

  if (loading) return <div className="p-10 font-black animate-pulse">CARREGANDO VIZINHO+...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }} className="bg-white p-10 rounded-[2rem] w-full max-w-md shadow-2xl">
          <h1 className="text-4xl font-black text-center mb-8 text-slate-900 italic">V+</h1>
          <div className="space-y-4">
            <input type="email" placeholder="Email / NIF / Telemóvel" className="w-full p-4 bg-slate-100 rounded-xl outline-none" onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Palavra-passe" className="w-full p-4 bg-slate-100 rounded-xl outline-none" onChange={e => setPassword(e.target.value)} required />
            <button className="w-full bg-blue-600 text-white p-4 rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition">Entrar</button>
          </div>
        </form>
      </div>
    );
  }

  const { total, disponivel } = calcularSaldos(movimentos);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">V+</div>
          <span className="font-black text-slate-900 uppercase tracking-tighter">Área {role}</span>
        </div>
        <button onClick={() => signOut(auth)} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-50 hover:text-red-600 transition">Sair</button>
      </nav>

      <main className="p-8 max-w-6xl mx-auto w-full">
        {/* VIEW ADMIN [cite: 36] */}
        {role === 'admin' && (
          <div className="grid gap-8">
            <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-xl">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Controlo Global [cite: 45]</p>
              <h2 className="text-4xl font-black italic">Monitorização de Rede</h2>
            </div>
            {/* Tabela de movimentos globais e gestão de utilizadores virá aqui */}
          </div>
        )}

        {/* VIEW COMERCIANTE [cite: 46] */}
        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
              <h3 className="font-black text-[10px] uppercase text-blue-600 mb-8 tracking-widest">Nova Operação [cite: 62]</h3>
              <div className="space-y-4">
                <input type="email" placeholder="Email do Cliente" className="w-full p-4 bg-slate-50 rounded-xl font-bold" value={op.clienteEmail} onChange={e => setOp({...op, clienteEmail: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Valor €" className="w-full p-4 bg-slate-50 rounded-xl text-2xl font-black" value={op.valor || ''} onChange={e => setOp({...op, valor: Number(e.target.value)})} />
                  <input type="text" placeholder="Fatura / Doc" className="w-full p-4 bg-slate-50 rounded-xl font-bold" value={op.doc} onChange={e => setOp({...op, doc: e.target.value})} />
                </div>
                <div className="flex gap-4 pt-4">
                  <button className="flex-1 bg-slate-900 text-white p-4 rounded-xl font-black uppercase text-xs hover:bg-green-600 transition">Adicionar</button>
                  <button className="flex-1 border-2 border-slate-900 text-slate-900 p-4 rounded-xl font-black uppercase text-xs hover:bg-orange-50 transition">Descontar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW CLIENTE [cite: 16] */}
        {role === 'cliente' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center border-t-8 border-blue-600">
               <div className="mb-8 inline-block p-4 bg-slate-50 rounded-3xl">
                <QRCodeSVG value={user.email || ""} size={160} />
               </div>
               <p className="text-slate-400 text-[10px] font-black uppercase mb-2 tracking-widest">Saldo Disponível [cite: 19, 30]</p>
               <h2 className="text-6xl font-black text-slate-900 italic mb-10">{disponivel.toFixed(2)}€</h2>
               
               <div className="grid grid-cols-2 gap-4 pt-8 border-t border-dashed">
                  <div className="text-left">
                    <p className="text-[8px] font-black uppercase text-slate-400">Total Teórico </p>
                    <p className="font-black text-slate-900">{total.toFixed(2)}€</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-slate-400">Cartão [cite: 17]</p>
                    <p className="font-mono text-xs">{(perfil as Cliente)?.numCartao}</p>
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;