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
    return { total, disponivel: disponivel < 0 ? 0 : disponivel };
  }, [movimentos]);

  useEffect(() => {
    if (!user || !role) return;
    const loadData = async () => {
      if (role === 'admin') {
        const sLojas = await getDocs(collection(db, 'lojas'));
        setLojas(sLojas.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
      }
      if (role === 'comerciante' || role === 'admin') {
        const qOp = query(collection(db, 'operadores'), where('lojaId', '==', user.uid));
        const sOp = await getDocs(qOp);
        setOperadores(sOp.docs.map(d => ({ id: d.id, ...d.data() } as Operador)));
      }
      const campo = role === 'cliente' ? 'clienteId' : 'lojaId';
      const valor = role === 'cliente' ? user.email : user.uid;
      const qMov = query(collection(db, 'movimentos'), where(campo, '==', valor), orderBy('dataHora', 'desc'));
      const sMov = await getDocs(qMov);
      setMovimentos(sMov.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
    };
    loadData();
  }, [user, role]);

  const criarOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formOp.pin.length !== 5) return alert("O PIN deve ter exatamente 5 dígitos!");
    try {
      await addDoc(collection(db, 'operadores'), {
        nome: formOp.nome,
        codigo: formOp.pin,
        lojaId: user!.uid
      });
      alert("Operador criado com sucesso!");
      setFormOp({ nome: '', pin: '' });
      window.location.reload();
    } catch (err) { alert("Erro ao criar operador."); }
  };

  const eliminarOperador = async (id: string) => {
    if (window.confirm("Eliminar este operador?")) {
      await deleteDoc(doc(db, 'operadores', id));
      window.location.reload();
    }
  };

  const handleMovimento = async (tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO') => {
    const op = operadores.find(o => o.codigo === formMov.pin);
    if (!op) return alert("PIN de operador inválido!");

    const valorCB = tipo === 'ADICIONAR' 
      ? (formMov.valorVenda * (perfil as Loja).percentualCB) / 100 
      : formMov.valorVenda;

    await addDoc(collection(db, 'movimentos'), {
      tipo, valorVenda: formMov.valorVenda, valorCashback: valorCB,
      clienteId: formMov.clienteEmail, lojaId: user!.uid, nomeLoja: (perfil as Loja).nomeLoja,
      dataHora: new Date().toISOString(), docOrigem: formMov.doc, operadorNome: op.nome
    });
    alert("Movimento registado por " + op.nome);
    window.location.reload();
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold animate-pulse text-blue-600">V+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }} className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl">
          <h1 className="text-4xl font-black mb-8 text-center italic text-blue-600">VIZINHO+</h1>
          <input type="email" placeholder="Email" className="input-v mb-4" onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="input-v mb-6" onChange={e => setPassword(e.target.value)} required />
          <button className="btn-primary w-full text-lg">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b p-6 flex justify-between items-center shadow-sm">
        <span className="font-black text-2xl text-blue-600 italic">V+ <small className="text-slate-400 text-xs uppercase not-italic">| {role}</small></span>
        <button onClick={() => signOut(auth)} className="text-slate-400 font-bold hover:text-red-600 transition-colors">Sair</button>
      </nav>

      <main className="p-8 max-w-6xl mx-auto space-y-12">
        {role === 'admin' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-6 text-slate-400 uppercase text-xs">Criar Loja Aderente</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                createUserWithEmailAndPassword(auth, formLoja.email, "loja123456").then(res => {
                  setDoc(doc(db, 'lojas', res.user.uid), {
                    id: res.user.uid, nomeLoja: formLoja.nome, email: formLoja.email, nif: formLoja.nif, percentualCB: formLoja.pc, ativo: true
                  });
                  alert("Loja criada!");
                });
              }} className="space-y-4">
                <input type="text" placeholder="Nome da Loja" className="input-v" onChange={e => setFormLoja({...formLoja, nome: e.target.value})} />
                <input type="email" placeholder="Email" className="input-v" onChange={e => setFormLoja({...formLoja, email: e.target.value})} />
                <input type="number" placeholder="% Cashback" className="input-v" onChange={e => setFormLoja({...formLoja, pc: Number(e.target.value)})} />
                <button className="btn-primary w-full">Criar Loja</button>
              </form>
            </div>
          </div>
        )}

        {role === 'comerciante' && (
          <>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                <h3 className="font-bold text-slate-400 uppercase text-xs">Registo de Venda / Cashback</h3>
                <input type="text" placeholder="Email do Cliente" className="input-v" onChange={e => setFormMov({...formMov, clienteEmail: e.target.value})} />
                <input type="number" placeholder="Valor Venda €" className="input-v" onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} />
                <input type="password" placeholder="Teu PIN de Operador (5 dígitos)" className="input-v" maxLength={5} onChange={e => setFormMov({...formMov, pin: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => handleMovimento('ADICIONAR')} className="bg-green-600 text-white p-4 rounded-xl font-bold hover:bg-green-700">Adicionar</button>
                  <button onClick={() => handleMovimento('DESCONTO')} className="bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700">Descontar</button>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
                <h3 className="font-bold text-slate-400 uppercase text-xs">Meus Operadores</h3>
                <form onSubmit={criarOperador} className="flex gap-2">
                  <input type="text" placeholder="Nome" className="input-v py-2" value={formOp.nome} onChange={e => setFormOp({...formOp, nome: e.target.value})} required />
                  <input type="password" placeholder="PIN (5)" className="input-v py-2 w-24" maxLength={5} value={formOp.pin} onChange={e => setFormOp({...formOp, pin: e.target.value})} required />
                  <button className="bg-slate-900 text-white px-4 rounded-xl font-bold">+</button>
                </form>
                <div className="space-y-2 pt-4">
                  {operadores.map(op => (
                    <div key={op.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border">
                      <span className="font-bold text-sm">{op.nome} <code className="text-blue-600 ml-2">({op.codigo})</code></span>
                      <button onClick={() => eliminarOperador(op.id)} className="text-red-400 text-xs hover:text-red-600">Remover</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {role === 'cliente' && (
          <div className="max-w-md mx-auto bg-slate-900 text-white p-10 rounded-[3rem] text-center shadow-2xl border-b-[12px] border-blue-600">
            <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-inner"><QRCodeSVG value={user?.email || ""} size={160} /></div>
            <p className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mb-1">Saldo Disponível (48h)</p>
            <h2 className="text-7xl font-black italic mb-2">{saldos.disponivel.toFixed(2)}€</h2>
            <p className="text-slate-500 text-xs uppercase font-bold">Saldo Total: {saldos.total.toFixed(2)}€</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;