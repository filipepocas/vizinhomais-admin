import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, orderBy, doc, setDoc, updateDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import type { Movimento, Loja, Operador } from './interfaces';

const App = () => {
  const { user, role, perfil, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'perfil' | 'historico'>('home');
  
  // Estados de Dados
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  
  // Estados de Filtro
  const [filtroEmail, setFiltroEmail] = useState('');

  // Estados de Formulários
  const [formMov, setFormMov] = useState({ clienteEmail: '', valorVenda: 0, doc: '', pin: '' });
  const [formLoja, setFormLoja] = useState({ nomeLoja: '', email: '', nif: '', pc: 10 });
  const [formPerfil, setFormPerfil] = useState<any>({});

  // Lógica de Saldo 48h (Cálculo em tempo real baseado nos movimentos carregados)
  const saldos = useMemo(() => {
    const agora = new Date().getTime();
    const quarentaEOitoHorasMs = 48 * 60 * 60 * 1000;
    
    // Se o comerciante filtrar por um cliente, calculamos o saldo DESSE cliente
    const movFiltrados = filtroEmail 
      ? movimentos.filter(m => m.clienteId === filtroEmail)
      : movimentos;

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

  const handleMovimento = async (tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO') => {
    const op = operadores.find(o => o.codigo === formMov.pin);
    if (!op) return alert("PIN inválido!");
    
    // Validação de segurança: Não permite saldo negativo em compras (Pág 5)
    if (tipo === 'DESCONTO' && formMov.valorVenda > saldos.disponivel) {
        return alert("Erro: O cliente não tem saldo disponível suficiente para este desconto.");
    }

    const pLoja = perfil as Loja;
    const valorCB = tipo === 'ADICIONAR' ? (formMov.valorVenda * pLoja.percentualCB) / 100 : formMov.valorVenda;
    
    await addDoc(collection(db, 'movimentos'), {
      tipo, valorVenda: formMov.valorVenda, valorCashback: valorCB,
      clienteId: formMov.clienteEmail, lojaId: user!.uid, nomeLoja: pLoja.nomeLoja,
      dataHora: new Date().toISOString(), docOrigem: formMov.doc, operadorNome: op.nome
    });
    alert("Movimento Registado!");
    window.location.reload();
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-blue-600 italic">VIZINHO+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }} className="bg-white p-12 rounded-[3rem] w-full max-w-md shadow-2xl">
          <h1 className="text-5xl font-black text-center mb-10 italic text-blue-600">V+</h1>
          <input type="email" placeholder="Email" className="input-v mb-4" onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Senha" className="input-v mb-6" onChange={e => setPassword(e.target.value)} required />
          <button className="btn-primary w-full py-4 rounded-2xl">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="text-3xl font-black text-blue-600 italic">V+</div>
          <div className="flex gap-4">
            <button onClick={() => setActiveTab('home')} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'home' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Painel</button>
            <button onClick={() => setActiveTab('historico')} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'historico' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Extrato</button>
            <button onClick={() => setActiveTab('perfil')} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'perfil' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Perfil</button>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-[10px] font-bold text-slate-300 uppercase hover:text-red-500 transition-colors">Sair</button>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        {activeTab === 'historico' ? (
          <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black italic uppercase">Histórico de Movimentos</h2>
                <input type="text" placeholder="Filtrar por Email Cliente..." className="input-v max-w-xs text-xs" onChange={e => setFiltroEmail(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b">
                        <tr>
                            <th className="p-4">Data/Hora</th>
                            <th className="p-4">Cliente</th>
                            <th className="p-4">Doc. Origem</th>
                            <th className="p-4">Operador</th>
                            <th className="p-4 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {movimentos.filter(m => m.clienteId.includes(filtroEmail)).map(m => (
                            <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-slate-500">{new Date(m.dataHora).toLocaleString()}</td>
                                <td className="p-4 font-bold">{m.clienteId}</td>
                                <td className="p-4 font-mono text-xs">{m.docOrigem || '---'}</td>
                                <td className="p-4 italic">{m.operadorNome}</td>
                                <td className={`p-4 text-right font-black ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>
                                    {m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        ) : activeTab === 'perfil' ? (
          <div className="max-w-2xl mx-auto bg-white p-12 rounded-[3.5rem] border shadow-sm">
            <h2 className="text-3xl font-black mb-8 italic">Dados de Conta</h2>
            <form onSubmit={(e) => { e.preventDefault(); updateDoc(doc(db, role === 'cliente' ? 'clientes' : 'lojas', user!.uid), formPerfil); alert("Guardado!"); }} className="space-y-6">
                <div>
                    <label className="label-v">Nome</label>
                    <input type="text" className="input-v" value={formPerfil.nome || formPerfil.nomeLoja || ''} onChange={e => setFormPerfil({...formPerfil, [role === 'cliente' ? 'nome' : 'nomeLoja']: e.target.value})} />
                </div>
                <div>
                    <label className="label-v">NIF</label>
                    <input type="text" className="input-v" value={formPerfil.nif || ''} onChange={e => setFormPerfil({...formPerfil, nif: e.target.value})} />
                </div>
                <button className="btn-primary w-full py-5 text-lg shadow-xl">Guardar Alterações</button>
            </form>
          </div>
        ) : (
          /* TAB HOME CONSOLIDADA */
          <div className="space-y-8">
            {role === 'comerciante' && (
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-xs text-blue-600 uppercase tracking-[0.2em]">Painel de Operações</h3>
                    {formMov.clienteEmail && (
                        <div className="text-right">
                            <p className="text-[8px] font-black uppercase text-slate-400">Saldo Disponível do Cliente</p>
                            <p className="text-xl font-black text-green-600">{saldos.disponivel.toFixed(2)}€</p>
                        </div>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-5">
                    <input type="text" placeholder="Email do Cliente" className="input-v" onChange={e => { setFormMov({...formMov, clienteEmail: e.target.value}); setFiltroEmail(e.target.value); }} />
                    <input type="number" placeholder="Valor da Venda €" className="input-v" onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} />
                    <input type="text" placeholder="Fatura / Doc nº" className="input-v" onChange={e => setFormMov({...formMov, doc: e.target.value})} />
                    <input type="password" placeholder="PIN Operador (5 dígitos)" className="input-v" maxLength={5} onChange={e => setFormMov({...formMov, pin: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-5 pt-4">
                    <button onClick={() => handleMovimento('ADICIONAR')} className="bg-green-600 text-white p-6 rounded-[2rem] font-black uppercase text-xs hover:scale-[1.02] transition-transform">Adicionar Cashback</button>
                    <button onClick={() => handleMovimento('DESCONTO')} className="bg-blue-600 text-white p-6 rounded-[2rem] font-black uppercase text-xs hover:scale-[1.02] transition-transform">Descontar Saldo</button>
                  </div>
                </div>
                <div className="space-y-8">
                    <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl">
                        <h3 className="text-blue-400 font-black text-[10px] uppercase mb-6 tracking-widest">Resumo da Loja</h3>
                        <div className="space-y-4">
                            <div><p className="text-[10px] text-slate-500 uppercase">Movimentos Totais</p><p className="text-3xl font-black">{movimentos.length}</p></div>
                            <div><p className="text-[10px] text-slate-500 uppercase">Cashback Atribuído</p><p className="text-3xl font-black">{movimentos.filter(m => m.tipo === 'ADICIONAR').reduce((acc, m) => acc + m.valorCashback, 0).toFixed(2)}€</p></div>
                        </div>
                    </div>
                </div>
              </div>
            )}

            {role === 'cliente' && (
              <div className="max-w-md mx-auto space-y-8">
                <div className="bg-slate-950 text-white p-12 rounded-[4.5rem] shadow-2xl border-b-[16px] border-blue-600 text-center">
                  <div className="bg-white p-5 rounded-[2.5rem] inline-block mb-10 border-8 border-slate-900">
                    <QRCodeSVG value={user?.email || ""} size={180} />
                  </div>
                  <p className="text-blue-500 font-black uppercase text-[10px] tracking-widest mb-4">Saldo Disponível (48h)</p>
                  <h2 className="text-8xl font-black italic tracking-tighter">{saldos.disponivel.toFixed(2)}€</h2>
                  <div className="flex justify-between border-t border-white/5 pt-8 mt-6">
                    <div className="text-left">
                        <p className="text-[8px] text-slate-500 font-black uppercase">Saldo Total</p>
                        <p className="text-2xl font-black">{saldos.total.toFixed(2)}€</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {role === 'admin' && (
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Lojas Ativas</p>
                        <h2 className="text-5xl font-black text-blue-600 italic">{lojas.length}</h2>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Volume Global</p>
                        <h2 className="text-5xl font-black text-slate-900 italic">{movimentos.reduce((acc, m) => acc + m.valorVenda, 0).toFixed(0)}€</h2>
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