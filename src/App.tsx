import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, orderBy, doc, updateDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import type { Movimento, Loja, Operador, Cliente } from './interfaces';

const App = () => {
  const { user, role, perfil, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'perfil' | 'historico' | 'gestao'>('home');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  
  const [filtroEmail, setFiltroEmail] = useState('');
  const [formMov, setFormMov] = useState({ clienteEmail: '', valorVenda: 0, doc: '', pin: '' });
  const [formOp, setFormOp] = useState({ nome: '', pin: '' });

  // Bloqueio de segurança para contas desativadas pelo Admin
  useEffect(() => {
    if (user && perfil && (perfil as any).ativo === false) {
      alert("CONTA DESATIVADA: Contacte o administrador.");
      signOut(auth);
    }
  }, [perfil, user]);

  // Lógica de Saldos: Total vs Disponível (Regra 48h)
  const saldos = useMemo(() => {
    const agora = new Date().getTime();
    const quarentaEOitoHorasMs = 48 * 60 * 60 * 1000;
    const movFiltrados = filtroEmail ? movimentos.filter(m => m.clienteId === filtroEmail) : movimentos;
    
    let total = 0;
    let disponivel = 0;

    movFiltrados.forEach(m => {
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
  }, [movimentos, filtroEmail]);

  useEffect(() => {
    if (!user || !role) return;

    const loadData = async () => {
      try {
        if (role === 'admin') {
          const sLojas = await getDocs(collection(db, 'lojas'));
          setLojas(sLojas.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
          const sClientes = await getDocs(collection(db, 'clientes'));
          setClientes(sClientes.docs.map(d => ({ id: d.id, ...d.data() } as Cliente)));
          const qAllMov = query(collection(db, 'movimentos'), orderBy('dataHora', 'desc'));
          const sAllMov = await getDocs(qAllMov);
          setMovimentos(sAllMov.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
        }
        if (role === 'comerciante') {
          const qOp = query(collection(db, 'operadores'), where('lojaId', '==', user.uid));
          const sOp = await getDocs(qOp);
          setOperadores(sOp.docs.map(d => ({ id: d.id, ...d.data() } as Operador)));
          const qMov = query(collection(db, 'movimentos'), where('lojaId', '==', user.uid), orderBy('dataHora', 'desc'));
          const sMov = await getDocs(qMov);
          setMovimentos(sMov.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
        }
        if (role === 'cliente') {
          const qMov = query(collection(db, 'movimentos'), where('clienteId', '==', user.email), orderBy('dataHora', 'desc'));
          const sMov = await getDocs(qMov);
          setMovimentos(sMov.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      }
    };
    loadData();
  }, [user, role]);

  const handleMovimento = async (tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO') => {
    const op = operadores.find(o => o.codigo === formMov.pin);
    if (!op) return alert("ERRO: PIN de Operador inválido!");
    
    // Bloqueio de saldo negativo em compras (Regra Pág 5)
    if (tipo === 'DESCONTO' && formMov.valorVenda > saldos.disponivel) {
      return alert("OPERAÇÃO NEGADA: Saldo insuficiente.");
    }

    const pLoja = perfil as Loja;
    const valorCB = tipo === 'ADICIONAR' ? (formMov.valorVenda * pLoja.percentualCB) / 100 : formMov.valorVenda;
    
    await addDoc(collection(db, 'movimentos'), {
      tipo, valorVenda: formMov.valorVenda, valorCashback: valorCB,
      clienteId: formMov.clienteEmail, lojaId: user!.uid, nomeLoja: pLoja.nomeLoja,
      dataHora: new Date().toISOString(), docOrigem: formMov.doc, operadorNome: op.nome
    });
    alert("Movimento registado!");
    window.location.reload();
  };

  const handleCreateOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formOp.pin.length !== 5) return alert("PIN deve ter 5 dígitos.");
    await addDoc(collection(db, 'operadores'), {
      nome: formOp.nome, codigo: formOp.pin, lojaId: user!.uid, ativo: true
    });
    alert("Operador criado!");
    window.location.reload();
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-blue-600 italic">V+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }} className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
          <h1 className="text-5xl font-black text-center mb-8 italic text-blue-600">V+</h1>
          <div className="space-y-4">
            <input type="email" placeholder="Email" className="input-v" onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Senha" className="input-v" onChange={e => setPassword(e.target.value)} required />
            <button className="btn-primary w-full py-4 rounded-2xl">ENTRAR</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="text-2xl font-black text-blue-600 italic">V+</div>
          <div className="hidden md:flex gap-4">
            <button onClick={() => setActiveTab('home')} className={`text-[10px] font-black uppercase ${activeTab === 'home' ? 'text-blue-600' : 'text-slate-400'}`}>Painel</button>
            <button onClick={() => setActiveTab('historico')} className={`text-[10px] font-black uppercase ${activeTab === 'historico' ? 'text-blue-600' : 'text-slate-400'}`}>Extrato</button>
            {role === 'admin' && <button onClick={() => setActiveTab('gestao')} className={`text-[10px] font-black uppercase ${activeTab === 'gestao' ? 'text-blue-600' : 'text-slate-400'}`}>Admin</button>}
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-[10px] font-black text-red-500 uppercase">Sair</button>
      </nav>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        {activeTab === 'gestao' && role === 'admin' ? (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[3rem] border shadow-sm">
              <h3 className="text-sm font-black mb-6 uppercase text-blue-600 italic">Gestão de Lojas</h3>
              <div className="space-y-3">
                {lojas.map(l => (
                  <div key={l.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border">
                    <div><p className="font-black text-xs">{l.nomeLoja}</p><p className="text-[9px] text-slate-400 font-bold uppercase">{l.email}</p></div>
                    <button onClick={() => updateDoc(doc(db, 'lojas', l.id), { ativo: !l.ativo }).then(() => window.location.reload())} className={`px-4 py-2 rounded-full font-black text-[9px] uppercase ${l.ativo ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{l.ativo ? 'Ativa' : 'Bloqueada'}</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'historico' ? (
          <div className="bg-white p-6 md:p-10 rounded-[3rem] border shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-8">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">Extrato de Movimentos</h2>
              <input type="text" placeholder="Filtrar Cliente..." className="input-v max-w-xs text-xs" onChange={e => setFiltroEmail(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b">
                  <tr><th className="p-4">Data</th><th className="p-4">Entidade</th><th className="p-4">Operador</th><th className="p-4 text-right">Cashback</th></tr>
                </thead>
                <tbody className="text-sm">
                  {movimentos.filter(m => m.clienteId.includes(filtroEmail)).map(m => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="p-4 text-slate-400 text-[10px]">{new Date(m.dataHora).toLocaleString()}</td>
                      <td className="p-4 font-bold text-xs">{role === 'cliente' ? m.nomeLoja : m.clienteId}</td>
                      <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-[9px] font-black text-slate-500 uppercase">{m.operadorNome}</span></td>
                      <td className={`p-4 text-right font-black italic ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>
                        {m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {role === 'comerciante' && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[3rem] border shadow-sm border-t-8 border-t-blue-600 space-y-8">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-black text-xs text-blue-600 uppercase italic">Balcão de Vendas</h3><p className="text-[10px] text-slate-400 font-bold uppercase">{(perfil as Loja)?.nomeLoja}</p></div>
                    {formMov.clienteEmail && <div className="text-right bg-green-50 p-3 rounded-2xl"><p className="text-[8px] font-black text-green-700 uppercase">Saldo Disponível</p><p className="text-2xl font-black text-green-600">{saldos.disponivel.toFixed(2)}€</p></div>}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <input type="text" className="input-v" placeholder="E-mail do Cliente" onChange={e => {setFormMov({...formMov, clienteEmail: e.target.value}); setFiltroEmail(e.target.value);}} />
                    <input type="number" className="input-v" placeholder="Valor Operação (€)" onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} />
                    <input type="text" className="input-v" placeholder="Fatura / Doc nº" onChange={e => setFormMov({...formMov, doc: e.target.value})} />
                    <input type="password" placeholder="PIN Operador" className="input-v text-center" maxLength={5} onChange={e => setFormMov({...formMov, pin: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button onClick={() => handleMovimento('ADICIONAR')} className="bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-green-100">Atribuir Cashback</button>
                    <button onClick={() => handleMovimento('DESCONTO')} className="bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-100">Usar Saldo</button>
                    <button onClick={() => handleMovimento('SUBTRAIR')} className="border-2 border-red-50 text-red-500 py-4 rounded-2xl font-black text-[10px] uppercase">Nota de Crédito</button>
                  </div>
                </div>
                <div className="space-y-6">
                  <form onSubmit={handleCreateOperador} className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl space-y-4">
                    <h3 className="text-blue-400 font-black text-[10px] uppercase italic">Novo Operador</h3>
                    <input type="text" placeholder="Nome" className="w-full bg-white/10 p-4 rounded-2xl text-xs outline-none focus:ring-1 ring-blue-500" required onChange={e => setFormOp({...formOp, nome: e.target.value})} />
                    <input type="password" placeholder="PIN 5 Dígitos" className="w-full bg-white/10 p-4 rounded-2xl text-xs outline-none focus:ring-1 ring-blue-500" maxLength={5} required onChange={e => setFormOp({...formOp, pin: e.target.value})} />
                    <button className="w-full bg-blue-600 p-4 rounded-2xl font-black text-[10px] uppercase">Criar Operador</button>
                  </form>
                </div>
              </div>
            )}

            {role === 'cliente' && (
              <div className="max-w-md mx-auto">
                <div className="bg-slate-950 text-white p-10 rounded-[4rem] shadow-2xl border-b-[20px] border-blue-600 text-center relative overflow-hidden">
                  <div className="bg-white p-6 rounded-[3rem] inline-block mb-10 border-8 border-slate-900">
                    <QRCodeSVG value={user?.email || ""} size={160} />
                  </div>
                  <p className="text-blue-500 font-black uppercase text-[10px] tracking-widest mb-2">Saldo para Usar</p>
                  <h2 className="text-7xl font-black italic mb-8">{saldos.disponivel.toFixed(2)}€</h2>
                  <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-8">
                    <div className="text-left"><p className="text-[8px] text-slate-500 font-black uppercase">Processando</p><p className="text-xl font-black text-slate-400">{(saldos.total - saldos.disponivel).toFixed(2)}€</p></div>
                    <div className="text-right"><p className="text-[8px] text-slate-500 font-black uppercase">Saldo Total</p><p className="text-xl font-black">{saldos.total.toFixed(2)}€</p></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-4 z-50 shadow-2xl">
        <button onClick={() => setActiveTab('home')} className={`text-[9px] font-black uppercase ${activeTab === 'home' ? 'text-blue-600' : 'text-slate-400'}`}>Painel</button>
        <button onClick={() => setActiveTab('historico')} className={`text-[9px] font-black uppercase ${activeTab === 'historico' ? 'text-blue-600' : 'text-slate-400'}`}>Extrato</button>
      </div>
    </div>
  );
};

export default App;