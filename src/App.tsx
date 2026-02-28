import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, orderBy, doc, setDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import type { Movimento, Loja, Cliente, Operador } from './interfaces';

const App = () => {
  const { user, role, perfil, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [novaLoja, setNovaLoja] = useState({ nome: '', email: '', nif: '', pc: 10, atividade: '' });
  const [opForm, setOpForm] = useState({ clienteEmail: '', valor: 0, doc: '', pin: '' });

  const calcularSaldos = (lista: Movimento[]) => {
    const agora = new Date();
    const limite48h = new Date(agora.getTime() - (48 * 60 * 60 * 1000));
    const total = lista.reduce((acc, m) => m.tipo === 'ADICIONAR' ? acc + m.valorCashback : acc - m.valorCashback, 0);
    const disponivel = lista.reduce((acc, m) => {
      const dataMov = new Date(m.dataHora);
      if (m.tipo === 'ADICIONAR') return dataMov <= limite48h ? acc + m.valorCashback : acc;
      return acc - m.valorCashback;
    }, 0);
    return { total, disponivel: disponivel < 0 ? 0 : disponivel };
  };

  useEffect(() => {
    if (!user || !role) return;
    const loadData = async () => {
      if (role === 'admin') {
        const snap = await getDocs(collection(db, 'lojas'));
        setLojas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
      }
      const q = query(collection(db, 'movimentos'), 
                where(role === 'cliente' ? 'clienteId' : 'lojaId', '==', role === 'cliente' ? user.email : user.uid),
                orderBy('dataHora', 'desc'));
      const mSnap = await getDocs(q);
      setMovimentos(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
    };
    loadData();
  }, [user, role]);

  const criarLojaAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, novaLoja.email, "loja123456");
      const dados: Loja = { id: res.user.uid, nomeLoja: novaLoja.nome, email: novaLoja.email, nif: novaLoja.nif, percentualCB: novaLoja.pc, atividade: novaLoja.atividade, ativo: true, morada: '', codigoPostal: '', cidade: '', telefone: '' };
      await setDoc(doc(db, 'lojas', res.user.uid), dados);
      alert("Loja Criada!");
    } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black uppercase tracking-tighter text-blue-600 animate-pulse">Vizinho+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }} className="bg-white p-12 rounded-[3rem] w-full max-w-md shadow-2xl">
          <h1 className="text-5xl font-black text-center mb-10 text-slate-900 italic tracking-tighter">V+</h1>
          <div className="space-y-4">
            <input type="email" placeholder="Email" className="w-full p-5 bg-slate-100 rounded-2xl outline-none border-2 border-transparent focus:border-blue-600 transition" onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="w-full p-5 bg-slate-100 rounded-2xl outline-none border-2 border-transparent focus:border-blue-600 transition" onChange={e => setPassword(e.target.value)} required />
            <button className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-200">Entrar</button>
          </div>
        </form>
      </div>
    );
  }

  const { total, disponivel } = calcularSaldos(movimentos);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-white border-b px-8 py-5 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-blue-100">V+</div>
          <span className="font-black text-slate-900 uppercase tracking-tighter text-lg">{role}</span>
        </div>
        <button onClick={() => signOut(auth)} className="bg-slate-100 text-slate-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-50 hover:text-red-600 transition">Sair</button>
      </nav>

      <main className="p-8 max-w-7xl mx-auto w-full flex-1">
        {role === 'admin' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-xl">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Dashboard Admin</p>
                <h2 className="text-3xl font-black italic">Gestão de Rede</h2>
              </div>
              <form onSubmit={criarLojaAdmin} className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-3">
                <p className="font-black text-[10px] uppercase text-blue-600 mb-4">Registar Nova Loja</p>
                <input type="text" placeholder="Nome da Loja" className="w-full p-4 bg-slate-50 rounded-xl text-sm" onChange={e => setNovaLoja({...novaLoja, nome: e.target.value})} required />
                <input type="email" placeholder="Email de Acesso" className="w-full p-4 bg-slate-50 rounded-xl text-sm" onChange={e => setNovaLoja({...novaLoja, email: e.target.value})} required />
                <input type="text" placeholder="NIF" className="w-full p-4 bg-slate-50 rounded-xl text-sm" onChange={e => setNovaLoja({...novaLoja, nif: e.target.value})} required />
                <input type="number" placeholder="% Cashback" className="w-full p-4 bg-slate-50 rounded-xl text-sm font-black text-blue-600" onChange={e => setNovaLoja({...novaLoja, pc: Number(e.target.value)})} required />
                <button className="w-full bg-slate-900 text-white p-4 rounded-xl font-black uppercase text-[10px] tracking-widest">Ativar Comerciante</button>
              </form>
            </div>
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border p-10 shadow-sm">
              <h3 className="font-black text-[10px] uppercase text-slate-400 mb-8 tracking-widest">Lojas Aderentes ({lojas.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lojas.map(l => (
                  <div key={l.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center group hover:border-blue-200 transition">
                    <div><p className="font-black text-slate-900 uppercase text-sm">{l.nomeLoja}</p><p className="text-[10px] text-slate-400 font-bold">{l.atividade || 'Geral'}</p></div>
                    <div className="text-right"><p className="text-blue-600 font-black italic">{l.percentualCB}%</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
              <div><h3 className="font-black text-[10px] uppercase text-blue-600 mb-2 tracking-widest">Operação de Caixa</h3><p className="text-xs text-slate-400">Introduza os dados para adicionar ou descontar saldo.</p></div>
              <div className="space-y-4">
                <input type="text" placeholder="Número do Cartão / Email" className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-2 border-transparent focus:border-blue-600 outline-none" value={opForm.clienteEmail} onChange={e => setOpForm({...opForm, clienteEmail: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Valor €" className="w-full p-5 bg-slate-50 rounded-2xl text-2xl font-black" value={opForm.valor || ''} onChange={e => setOpForm({...opForm, valor: Number(e.target.value)})} />
                  <input type="text" placeholder="Nº Fatura / NC" className="w-full p-5 bg-slate-50 rounded-2xl font-bold uppercase" value={opForm.doc} onChange={e => setOpForm({...opForm, doc: e.target.value})} />
                </div>
                <input type="password" placeholder="PIN Operador (5 dígitos)" className="w-full p-5 bg-slate-100 rounded-2xl text-center font-black tracking-[1em]" maxLength={5} value={opForm.pin} onChange={e => setOpForm({...opForm, pin: e.target.value})} />
                <div className="flex gap-4 pt-4">
                  <button className="flex-1 bg-slate-900 text-white p-5 rounded-2xl font-black uppercase text-xs hover:bg-green-600 transition shadow-xl">Adicionar</button>
                  <button className="flex-1 border-2 border-slate-900 text-slate-900 p-5 rounded-2xl font-black uppercase text-xs hover:bg-orange-50 transition">Descontar</button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-[3rem] border p-10 shadow-sm overflow-hidden">
               <h3 className="font-black text-[10px] uppercase text-slate-400 mb-8 tracking-widest">Movimentos Recentes</h3>
               <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {movimentos.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl hover:bg-slate-100 transition">
                      <div><p className="text-xs font-black text-slate-900">{m.clienteId}</p><p className="text-[9px] text-slate-400 font-bold uppercase">Doc: {m.docOrigem || '---'} • {new Date(m.dataHora).toLocaleDateString()}</p></div>
                      <span className={`font-black italic text-lg ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {role === 'cliente' && (
          <div className="max-w-md mx-auto">
            <div className="bg-slate-950 p-12 rounded-[4rem] text-white shadow-2xl flex flex-col items-center border-b-[16px] border-blue-600 relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600 rounded-full blur-[80px] opacity-20"></div>
               <div className="bg-white p-6 rounded-[2.5rem] mb-10 shadow-2xl border-4 border-slate-800"><QRCodeSVG value={(perfil as Cliente)?.numCartao || ""} size={160} /></div>
               <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Saldo Disponível (48h)</p>
               <h2 className="text-7xl font-black italic tracking-tighter mb-8">{disponivel.toFixed(2)}€</h2>
               <div className="w-full pt-8 border-t border-white/10 flex justify-between items-center">
                  <div className="text-left"><p className="text-[8px] font-black text-slate-500 uppercase">Saldo Total</p><p className="font-black text-xl">{total.toFixed(2)}€</p></div>
                  <div className="text-right"><p className="text-[8px] font-black text-slate-500 uppercase">ID Cartão</p><p className="font-mono text-xs">{(perfil as Cliente)?.numCartao}</p></div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;