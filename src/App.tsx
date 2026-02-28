import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, orderBy, doc, setDoc, updateDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import type { Movimento, Loja, Operador } from './interfaces';

const App = () => {
  const { user, role, perfil, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'perfil' | 'historico' | 'gestao'>('home');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  
  const [filtroEmail, setFiltroEmail] = useState('');
  const [formMov, setFormMov] = useState({ clienteEmail: '', valorVenda: 0, doc: '', pin: '' });
  const [formLoja, setFormLoja] = useState({ nomeLoja: '', email: '', nif: '', pc: 10 });
  const [formPerfil, setFormPerfil] = useState<any>({});
  const [formOp, setFormOp] = useState({ nome: '', pin: '' });

  useEffect(() => {
    if (user && perfil && perfil.ativo === false) {
      alert("A sua conta foi desativada pelo administrador.");
      signOut(auth);
    }
  }, [perfil, user]);

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
    if (perfil) setFormPerfil(perfil);

    const loadData = async () => {
      if (role === 'admin') {
        const sLojas = await getDocs(collection(db, 'lojas'));
        setLojas(sLojas.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
        const sClientes = await getDocs(collection(db, 'clientes'));
        setClientes(sClientes.docs.map(d => ({ id: d.id, ...d.data() })));
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
    };
    loadData();
  }, [user, role, perfil]);

  const handleCreateOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formOp.pin.length !== 5) return alert("O PIN deve ter exatamente 5 dígitos.");
    await addDoc(collection(db, 'operadores'), {
      nome: formOp.nome,
      codigo: formOp.pin,
      lojaId: user!.uid,
      ativo: true
    });
    alert("Operador criado!");
    window.location.reload();
  };

  const handleMovimento = async (tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO') => {
    const op = operadores.find(o => o.codigo === formMov.pin);
    if (!op) return alert("PIN de Operador não encontrado ou inválido!");
    if (tipo === 'DESCONTO' && formMov.valorVenda > saldos.disponivel) return alert("Saldo insuficiente.");

    const pLoja = perfil as Loja;
    const valorCB = tipo === 'ADICIONAR' ? (formMov.valorVenda * pLoja.percentualCB) / 100 : formMov.valorVenda;
    
    await addDoc(collection(db, 'movimentos'), {
      tipo, valorVenda: formMov.valorVenda, valorCashback: valorCB,
      clienteId: formMov.clienteEmail, lojaId: user!.uid, nomeLoja: pLoja.nomeLoja,
      dataHora: new Date().toISOString(), docOrigem: formMov.doc, operadorNome: op.nome
    });
    alert("Sucesso!");
    window.location.reload();
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-blue-600 italic">V+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }} className="bg-white p-12 rounded-[3rem] w-full max-w-md shadow-2xl">
          <h1 className="text-5xl font-black text-center mb-10 italic text-blue-600 uppercase">V+</h1>
          <input type="email" placeholder="Email" className="input-v mb-4" onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Senha" className="input-v mb-6" onChange={e => setPassword(e.target.value)} required />
          <button className="btn-primary w-full py-4 rounded-2xl">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <nav className="bg-white border-b px-8 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="text-3xl font-black text-blue-600 italic tracking-tighter">V+</div>
          <div className="flex gap-5">
            <button onClick={() => setActiveTab('home')} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'home' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Painel</button>
            <button onClick={() => setActiveTab('historico')} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'historico' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Extrato</button>
            {role === 'admin' && <button onClick={() => setActiveTab('gestao')} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'gestao' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Admin</button>}
            <button onClick={() => setActiveTab('perfil')} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'perfil' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Perfil</button>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase transition-colors">Sair</button>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-10">
        {activeTab === 'gestao' && role === 'admin' ? (
          <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
                <h3 className="text-xl font-black mb-6 italic uppercase text-blue-600">Lojas do Sistema</h3>
                <div className="space-y-3">
                    {lojas.map(l => (
                        <div key={l.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border">
                            <div><p className="font-black text-sm">{l.nomeLoja}</p><p className="text-[9px] text-slate-400 uppercase font-bold">{l.email}</p></div>
                            <button onClick={() => updateDoc(doc(db, 'lojas', l.id), { ativo: !l.ativo }).then(() => window.location.reload())} className={`px-5 py-2 rounded-full font-black text-[9px] uppercase transition-all ${l.ativo ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {l.ativo ? 'Ativa' : 'Bloqueada'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
                <h3 className="text-xl font-black mb-6 italic uppercase text-slate-400">Auditoria Clientes</h3>
                <div className="space-y-3">
                    {clientes.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border">
                            <div><p className="font-black text-sm">{c.nome}</p><p className="text-[9px] text-slate-400 uppercase font-bold">{c.email}</p></div>
                            <button onClick={() => updateDoc(doc(db, 'clientes', c.id), { ativo: !c.ativo }).then(() => window.location.reload())} className={`px-5 py-2 rounded-full font-black text-[9px] uppercase ${c.ativo ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                                {c.ativo ? 'Ativo' : 'Banido'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        ) : activeTab === 'historico' ? (
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Extrato de Atividade</h2>
                    <input type="text" placeholder="Procurar cliente..." className="input-v max-w-xs text-xs" onChange={e => setFiltroEmail(e.target.value)} />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b">
                            <tr><th className="p-4">Data/Hora</th><th className="p-4">Entidade</th><th className="p-4">Operador</th><th className="p-4 text-right">Valor Cashback</th></tr>
                        </thead>
                        <tbody className="text-sm">
                            {movimentos.filter(m => m.clienteId.includes(filtroEmail)).map(m => (
                                <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50/50">
                                    <td className="p-4 text-slate-400 text-xs">{new Date(m.dataHora).toLocaleString()}</td>
                                    <td className="p-4 font-bold">{role === 'cliente' ? m.nomeLoja : m.clienteId}</td>
                                    <td className="p-4"><span className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-black text-slate-600 uppercase">{m.operadorNome}</span></td>
                                    <td className={`p-4 text-right font-black italic text-lg ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>
                                        {m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        ) : (
          /* TAB HOME - FOCO NO OPERADOR */
          <div className="space-y-10">
            {role === 'comerciante' && (
                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border shadow-sm space-y-8">
                        <div className="flex justify-between items-center border-b pb-6">
                            <h3 className="font-black text-xs text-blue-600 uppercase tracking-widest italic">Terminal de Vendas</h3>
                            {formMov.clienteEmail && <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">Disponível Cliente</p><p className="text-2xl font-black text-green-600">{saldos.disponivel.toFixed(2)}€</p></div>}
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="label-v">E-mail do Cliente</label><input type="text" className="input-v" placeholder="cliente@exemplo.com" onChange={e => {setFormMov({...formMov, clienteEmail: e.target.value}); setFiltroEmail(e.target.value);}} /></div>
                            <div className="space-y-2"><label className="label-v">Valor da Compra (€)</label><input type="number" className="input-v" placeholder="0.00" onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} /></div>
                            <div className="space-y-2"><label className="label-v">Documento (Fatura nº)</label><input type="text" className="input-v" placeholder="Ex: FT 2024/001" onChange={e => setFormMov({...formMov, doc: e.target.value})} /></div>
                            <div className="space-y-2"><label className="label-v">PIN Operador (5 Dígitos)</label><input type="password" placeholder="•••••" className="input-v bg-blue-50/50 border-blue-200" maxLength={5} onChange={e => setFormMov({...formMov, pin: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6 pt-4">
                            <button onClick={() => handleMovimento('ADICIONAR')} className="bg-green-600 text-white p-6 rounded-[2rem] font-black uppercase text-xs hover:shadow-lg hover:shadow-green-100 transition-all">Atribuir Cashback</button>
                            <button onClick={() => handleMovimento('DESCONTO')} className="bg-blue-600 text-white p-6 rounded-[2rem] font-black uppercase text-xs hover:shadow-lg hover:shadow-blue-100 transition-all">Usar Saldo</button>
                        </div>
                    </div>
                    <div className="space-y-8">
                        <form onSubmit={handleCreateOperador} className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl space-y-5">
                            <h3 className="text-blue-400 font-black text-[10px] uppercase tracking-widest italic">Novo Operador</h3>
                            <input type="text" placeholder="Nome do Colaborador" className="w-full bg-white/10 p-4 rounded-2xl outline-none text-sm border border-white/5 focus:border-blue-500" required onChange={e => setFormOp({...formOp, nome: e.target.value})} />
                            <input type="password" placeholder="PIN de 5 dígitos" className="w-full bg-white/10 p-4 rounded-2xl outline-none text-sm border border-white/5 focus:border-blue-500" maxLength={5} required onChange={e => setFormOp({...formOp, pin: e.target.value})} />
                            <button className="w-full bg-blue-600 p-4 rounded-2xl font-black text-xs uppercase hover:bg-blue-500 transition-all">Criar Acesso</button>
                        </form>
                        <div className="bg-white p-8 rounded-[3rem] border shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 italic">Equipa em Serviço</h3>
                            <div className="space-y-3">
                                {operadores.map(op => (
                                    <div key={op.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                        <span className="font-bold text-sm">{op.nome}</span>
                                        <code className="text-[10px] bg-slate-100 px-2 py-1 rounded text-blue-600 font-bold">PIN: ****</code>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {role === 'cliente' && (
                <div className="max-w-md mx-auto animate-in zoom-in duration-500">
                    <div className="bg-slate-950 text-white p-12 rounded-[4.5rem] shadow-2xl border-b-[20px] border-blue-600 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <div className="bg-white p-6 rounded-[3rem] inline-block mb-10 border-8 border-slate-900 shadow-2xl">
                            <QRCodeSVG value={user?.email || ""} size={180} />
                        </div>
                        <p className="text-blue-500 font-black uppercase text-[10px] tracking-[0.4em] mb-4">Saldo Disponível (48h)</p>
                        <h2 className="text-8xl font-black italic tracking-tighter mb-6">{saldos.disponivel.toFixed(2)}€</h2>
                        <div className="flex justify-between items-center border-t border-white/5 pt-8 mt-4">
                            <div className="text-left">
                                <p className="text-[8px] text-slate-500 font-black uppercase">Saldo em Processamento</p>
                                <p className="text-2xl font-black text-slate-300">{(saldos.total - saldos.disponivel).toFixed(2)}€</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] text-slate-500 font-black uppercase">Total Acumulado</p>
                                <p className="text-2xl font-black">{saldos.total.toFixed(2)}€</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {role === 'admin' && (
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="bg-white p-10 rounded-[3rem] border shadow-sm border-t-8 border-t-blue-600">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lojas no Vizinhança</p>
                        <h2 className="text-6xl font-black italic text-slate-900 mt-2">{lojas.length}</h2>
                    </div>
                    <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-xl">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Cashback Circulante</p>
                        <h2 className="text-6xl font-black italic mt-2">{movimentos.filter(m => m.tipo === 'ADICIONAR').reduce((acc, m) => acc + m.valorCashback, 0).toFixed(0)}€</h2>
                    </div>
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;