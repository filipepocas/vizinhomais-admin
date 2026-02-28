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
  const [op, setOp] = useState({ clienteEmail: '', valor: 0, doc: '', codOperador: '' });

  // Lógica de Saldos: Total vs Disponível 48h [cite: 30, 64]
  const calcularSaldos = (lista: Movimento[]) => {
    const agora = new Date();
    const limite48h = new Date(agora.getTime() - (48 * 60 * 60 * 1000));

    const total = lista.reduce((acc, m) => 
      m.tipo === 'ADICIONAR' ? acc + m.valorCashback : acc - m.valorCashback, 0);

    const disponivel = lista.reduce((acc, m) => {
      const dataMov = new Date(m.dataHora);
      if (m.tipo === 'ADICIONAR') {
        // 
        return dataMov <= limite48h ? acc + m.valorCashback : acc;
      }
      // [cite: 31, 65]
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

  if (loading) return <div className="h-screen flex items-center justify-center font-black">CARREGANDO VIZINHO+...</div>;

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
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic">V+</div>
          <span className="font-black text-slate-900 uppercase tracking-tighter">Painel {role}</span>
        </div>
        <button onClick={() => signOut(auth)} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-50 hover:text-red-600 transition">Sair</button>
      </nav>

      <main className="p-8 max-w-6xl mx-auto w-full">
        {/* ÁREA ADMIN [cite: 36] */}
        {role === 'admin' && (
          <div className="grid gap-8">
            <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-xl">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Controlo Global</p>
              <h2 className="text-4xl font-black italic">Monitorização de Rede</h2>
              <p className="mt-4 text-slate-400 text-xs">Total de lojas aderentes e saldos globais em circulação.</p>
            </div>
          </div>
        )}

        {/* ÁREA COMERCIANTE [cite: 46] */}
        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
              <h3 className="font-black text-[10px] uppercase text-blue-600 mb-8 tracking-widest">Lançar Movimento</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Número do Cartão / Email" className="w-full p-4 bg-slate-50 rounded-xl font-bold" value={op.clienteEmail} onChange={e => setOp({...op, clienteEmail: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Valor Venda €" className="w-full p-4 bg-slate-50 rounded-xl text-2xl font-black" value={op.valor || ''} onChange={e => setOp({...op, valor: Number(e.target.value)})} />
                  <input type="text" placeholder="Fatura / Doc" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase" value={op.doc} onChange={e => setOp({...op, doc: e.target.value})} />
                </div>
                <input type="password" placeholder="Código Operador (5 dígitos)" className="w-full p-4 bg-slate-50 rounded-xl text-center font-black tracking-[1em]" maxLength={5} onChange={e => setOp({...op, codOperador: e.target.value})} />
                <div className="flex gap-4 pt-4">
                  <button className="flex-1 bg-slate-900 text-white p-4 rounded-xl font-black uppercase text-xs hover:bg-green-600 transition shadow-lg">Adicionar</button>
                  <button className="flex-1 border-2 border-slate-900 text-slate-900 p-4 rounded-xl font-black uppercase text-xs hover:bg-orange-50 transition">Descontar</button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] border p-10">
               <h3 className="font-black text-[10px] uppercase text-slate-400 mb-6 tracking-widest">Histórico da Loja</h3>
               <div className="space-y-3">
                  {movimentos.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                      <div><p className="text-[10px] font-black">{m.clienteId}</p><p className="text-[8px] text-slate-400">{m.docOrigem || 'Doc: ---'}</p></div>
                      <span className={`font-black italic ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* ÁREA CLIENTE [cite: 17] */}
        {role === 'cliente' && (
          <div className="max-w-md mx-auto">
            <div className="bg-slate-950 p-12 rounded-[3.5rem] text-white shadow-2xl flex flex-col items-center border-b-[12px] border-blue-600">
               <div className="bg-white p-6 rounded-[2.5rem] mb-10 shadow-2xl border-4 border-slate-800">
                <QRCodeSVG value={(perfil as Cliente)?.numCartao || ""} size={160} />
               </div>
               <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Saldo Disponível (48h) [cite: 30]</p>
               <h2 className="text-7xl font-black italic tracking-tighter mb-8">{disponivel.toFixed(2)}€</h2>
               <div className="w-full pt-8 border-t border-white/10 flex justify-between items-center">
                  <div className="text-left"><p className="text-[8px] font-black text-slate-500 uppercase">Saldo Total</p><p className="font-black text-lg">{total.toFixed(2)}€</p></div>
                  <div className="text-right"><p className="text-[8px] font-black text-slate-500 uppercase">Cartão</p><p className="font-mono text-xs">{(perfil as Cliente)?.numCartao}</p></div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;