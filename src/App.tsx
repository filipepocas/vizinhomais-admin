import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import type { Movimento, Loja, Cliente, Operador } from './interfaces';

const App = () => {
  const { user, role, perfil, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  
  // Estados para formulários
  const [formMov, setFormMov] = useState({ clienteEmail: '', valorVenda: 0, doc: '', pin: '' });
  const [formLoja, setFormLoja] = useState({ nome: '', email: '', nif: '', pc: 10 });
  const [formOp, setFormOp] = useState({ nome: '', pin: '' });
  const [formNovoCliente, setFormNovoCliente] = useState({ nome: '', email: '', nif: '', cp: '' });

  // LÓGICA DE SALDO 48H (CHECKLIST PÁG 5)
  const saldos = useMemo(() => {
    const agora = new Date().getTime();
    const quarentaEOitoHorasMs = 48 * 60 * 60 * 1000;
    let total = 0;
    let disponivel = 0;

    movimentos.forEach(m => {
      const dataMov = new Date(m.dataHora).getTime();
      const isDisponivel = (agora - dataMov) >= quarentaEOitoHorasMs;

      if (m.tipo === 'ADICIONAR') {
        total += m.valorCashback;
        if (isDisponivel) disponivel += m.valorCashback;
      } else {
        total -= m.valorCashback;
        disponivel -= m.valorCashback;
      }
    });
    return { total, disponivel };
  }, [movimentos]);

  useEffect(() => {
    if (!user || !role) return;
    const loadData = async () => {
      // ADMIN: Vê tudo
      if (role === 'admin') {
        const sLojas = await getDocs(collection(db, 'lojas'));
        setLojas(sLojas.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
        const qAllMov = query(collection(db, 'movimentos'), orderBy('dataHora', 'desc'));
        const sAllMov = await getDocs(qAllMov);
        setMovimentos(sAllMov.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
      }
      
      // COMERCIANTE: Vê seus operadores e seus movimentos
      if (role === 'comerciante') {
        const qOp = query(collection(db, 'operadores'), where('lojaId', '==', user.uid));
        const sOp = await getDocs(qOp);
        setOperadores(sOp.docs.map(d => ({ id: d.id, ...d.data() } as Operador)));
        const qMov = query(collection(db, 'movimentos'), where('lojaId', '==', user.uid), orderBy('dataHora', 'desc'));
        const sMov = await getDocs(qMov);
        setMovimentos(sMov.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
      }

      // CLIENTE: Vê movimentos apenas da loja onde se registou (Checklist Pág 1)
      if (role === 'cliente') {
        const qMov = query(collection(db, 'movimentos'), where('clienteId', '==', user.email), orderBy('dataHora', 'desc'));
        const sMov = await getDocs(qMov);
        setMovimentos(sMov.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
      }
    };
    loadData();
  }, [user, role]);

  const handleMovimento = async (tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO') => {
    const op = operadores.find(o => o.codigo === formMov.pin);
    if (!op) return alert("PIN de operador inválido!");
    
    if (tipo === 'DESCONTO' && formMov.valorVenda > saldos.disponivel) {
      return alert("Impossível: Saldo disponível insuficiente.");
    }

    const valorCB = tipo === 'ADICIONAR' ? (formMov.valorVenda * (perfil as Loja).percentualCB) / 100 : formMov.valorVenda;

    await addDoc(collection(db, 'movimentos'), {
      tipo, valorVenda: formMov.valorVenda, valorCashback: valorCB,
      clienteId: formMov.clienteEmail, lojaId: user!.uid, nomeLoja: (perfil as Loja).nomeLoja,
      dataHora: new Date().toISOString(), docOrigem: formMov.doc, operadorNome: op.nome
    });
    window.location.reload();
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-blue-600">V+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }} className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
          <h1 className="text-5xl font-black text-center mb-10 italic text-blue-600">V+</h1>
          <div className="space-y-4">
            <input type="email" placeholder="Email" className="input-v" onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Senha" className="input-v" onChange={e => setPassword(e.target.value)} required />
            <button className="btn-primary w-full">Entrar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="bg-white border-b px-8 py-6 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black italic">V+</div>
          <span className="font-black uppercase text-xs tracking-widest text-slate-400">{role}</span>
        </div>
        <button onClick={() => signOut(auth)} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg font-bold text-[10px] uppercase">Sair</button>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        {/* ÁREA ADMIN: GESTÃO GLOBAL */}
        {role === 'admin' && (
          <div className="space-y-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-blue-600 text-white p-8 rounded-[2rem] shadow-xl">
                <p className="text-[10px] font-bold opacity-60 uppercase">Total de Lojas</p>
                <h2 className="text-4xl font-black">{lojas.length}</h2>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Movimentos Globais</p>
                <h2 className="text-4xl font-black">{movimentos.length}</h2>
              </div>
            </div>
            <div className="bg-white rounded-[2rem] border overflow-hidden">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b italic font-bold">
                    <tr><th className="p-4">Loja</th><th className="p-4">Cliente</th><th className="p-4">Valor CB</th><th className="p-4">Tipo</th></tr>
                  </thead>
                  <tbody>
                    {movimentos.map(m => (
                      <tr key={m.id} className="border-b"><td className="p-4">{m.nomeLoja}</td><td className="p-4">{m.clienteId}</td><td className="p-4 font-bold">{m.valorCashback.toFixed(2)}€</td><td className="p-4"><span className="text-[10px] font-black uppercase">{m.tipo}</span></td></tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {/* ÁREA COMERCIANTE: OPERAÇÃO E CLIENTES */}
        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
                <h3 className="font-black uppercase text-xs text-blue-600 tracking-widest">Nova Operação</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Email Cliente" className="input-v" onChange={e => setFormMov({...formMov, clienteEmail: e.target.value})} />
                  <input type="number" placeholder="Valor Venda €" className="input-v" onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} />
                  <input type="text" placeholder="Fatura / Doc" className="input-v" onChange={e => setFormMov({...formMov, doc: e.target.value})} />
                  <input type="password" placeholder="PIN Operador (5)" className="input-v" maxLength={5} onChange={e => setFormMov({...formMov, pin: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleMovimento('ADICIONAR')} className="bg-green-600 text-white p-5 rounded-2xl font-black uppercase tracking-tighter hover:bg-green-700">Adicionar Saldo</button>
                  <button onClick={() => handleMovimento('DESCONTO')} className="btn-primary p-5">Descontar Saldo</button>
                </div>
                <button onClick={() => handleMovimento('SUBTRAIR')} className="w-full text-[10px] font-black text-red-500 uppercase tracking-widest opacity-50 hover:opacity-100">Nota de Crédito / Estorno</button>
              </div>
              <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
                <h3 className="font-black uppercase text-xs text-slate-400 mb-6 italic">Histórico da Loja</h3>
                {movimentos.slice(0, 5).map(m => (
                  <div key={m.id} className="flex justify-between items-center py-4 border-b last:border-0">
                    <div><p className="font-bold text-sm">{m.clienteId}</p><p className="text-[10px] text-slate-400 uppercase">{m.operadorNome} • {m.docOrigem || 'Sem Doc'}</p></div>
                    <div className={`font-black ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-8">
               <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
                  <h3 className="font-black uppercase text-[10px] text-blue-400 mb-4">Novo Cliente</h3>
                  <form onSubmit={(e) => { e.preventDefault(); /* Lógica de registo aqui */ }} className="space-y-3">
                    <input type="text" placeholder="Nome" className="w-full bg-white/10 p-3 rounded-xl outline-none text-sm" />
                    <input type="email" placeholder="Email" className="w-full bg-white/10 p-3 rounded-xl outline-none text-sm" />
                    <button className="w-full bg-blue-600 p-3 rounded-xl font-bold text-sm">Registar</button>
                  </form>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
                  <h3 className="font-black uppercase text-[10px] text-slate-400 mb-4">Operadores</h3>
                  {operadores.map(op => (
                    <div key={op.id} className="flex justify-between text-xs py-2 border-b font-bold italic">{op.nome} <span>{op.codigo}</span></div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* ÁREA CLIENTE: CARTÃO E SALDO DISPONÍVEL */}
        {role === 'cliente' && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="bg-slate-950 text-white p-10 rounded-[3.5rem] shadow-2xl border-b-[12px] border-blue-600 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full"></div>
              <div className="bg-white p-4 rounded-3xl inline-block mb-8 shadow-inner border-4 border-slate-800">
                <QRCodeSVG value={user?.email || ""} size={160} />
              </div>
              <p className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] mb-2">Saldo Disponível (48h)</p>
              <h2 className="text-7xl font-black italic mb-2 tracking-tighter">{saldos.disponivel.toFixed(2)}€</h2>
              <div className="flex justify-between border-t border-white/5 pt-6 mt-6">
                <div className="text-left"><p className="text-[8px] text-slate-500 uppercase font-black">Saldo Total</p><p className="font-black text-xl">{saldos.total.toFixed(2)}€</p></div>
                <div className="text-right"><p className="text-[8px] text-slate-500 uppercase font-black">Nº Cartão</p><p className="font-mono text-xs text-blue-400">{user?.email?.split('@')[0].toUpperCase()}</p></div>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
               <h3 className="font-black uppercase text-[10px] text-slate-400 mb-4 italic">Movimentos Recentes</h3>
               {movimentos.map(m => (
                 <div key={m.id} className="flex justify-between py-4 border-b last:border-0">
                    <div><p className="font-black text-sm uppercase">{m.nomeLoja}</p><p className="text-[10px] text-slate-400">{new Date(m.dataHora).toLocaleDateString()}</p></div>
                    <div className={`font-black ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;