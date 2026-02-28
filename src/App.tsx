import { useState, useEffect, useMemo } from 'react';
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
  const [operadores, setOperadores] = useState<Operador[]>([]);
  
  const [formMov, setFormMov] = useState({ clienteEmail: '', valorVenda: 0, doc: '', pin: '' });
  const [formLoja, setFormLoja] = useState({ nome: '', email: '', nif: '', pc: 10 });

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
      if (role === 'comerciante') {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { alert("Credenciais inválidas"); }
  };

  const criarLojaAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, formLoja.email, "loja123456");
      const novaLoja: Loja = {
        id: res.user.uid, nomeLoja: formLoja.nome, email: formLoja.email,
        nif: formLoja.nif, morada: '', codigoPostal: '', cidade: '', telefone: '',
        atividade: '', percentualCB: formLoja.pc, ativo: true
      };
      await setDoc(doc(db, 'lojas', res.user.uid), novaLoja);
      alert("Loja criada!");
      window.location.reload();
    } catch (err: any) { alert(err.message); }
  };

  const handleMovimento = async (tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO') => {
    if (formMov.pin.length !== 5) return alert("PIN de 5 dígitos necessário");
    const op = operadores.find(o => o.codigo === formMov.pin);
    if (!op) return alert("PIN de operador inválido");

    const valorCB = tipo === 'ADICIONAR' 
      ? (formMov.valorVenda * (perfil as Loja).percentualCB) / 100 
      : formMov.valorVenda;

    await addDoc(collection(db, 'movimentos'), {
      tipo, valorVenda: formMov.valorVenda, valorCashback: valorCB,
      clienteId: formMov.clienteEmail, lojaId: user!.uid, nomeLoja: (perfil as Loja).nomeLoja,
      dataHora: new Date().toISOString(), docOrigem: formMov.doc, operadorNome: op.nome
    });
    alert("Operação concluída!");
    window.location.reload();
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold">V+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl">
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
        <span className="font-black text-2xl text-blue-600 italic">V+</span>
        <button onClick={() => signOut(auth)} className="text-slate-500 font-bold">Sair</button>
      </nav>

      <main className="p-8 max-w-6xl mx-auto">
        {role === 'admin' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-6 text-slate-400 uppercase text-xs">Registar Loja</h3>
              <form onSubmit={criarLojaAdmin} className="space-y-4">
                <input type="text" placeholder="Nome" className="input-v" onChange={e => setFormLoja({...formLoja, nome: e.target.value})} />
                <input type="email" placeholder="Email" className="input-v" onChange={e => setFormLoja({...formLoja, email: e.target.value})} />
                <input type="text" placeholder="NIF" className="input-v" onChange={e => setFormLoja({...formLoja, nif: e.target.value})} />
                <button className="btn-primary w-full">Ativar</button>
              </form>
            </div>
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-6 text-slate-400 uppercase text-xs">Lojas</h3>
              {lojas.map(l => (
                <div key={l.id} className="p-3 bg-slate-50 rounded-xl mb-2 flex justify-between font-bold">
                  {l.nomeLoja} <span>{l.percentualCB}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
              <input type="text" placeholder="Email Cliente" className="input-v" onChange={e => setFormMov({...formMov, clienteEmail: e.target.value})} />
              <input type="number" placeholder="Valor €" className="input-v" onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} />
              <input type="password" placeholder="PIN" className="input-v" maxLength={5} onChange={e => setFormMov({...formMov, pin: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleMovimento('ADICIONAR')} className="bg-green-600 text-white p-4 rounded-xl font-bold">Adicionar</button>
                <button onClick={() => handleMovimento('DESCONTO')} className="bg-blue-600 text-white p-4 rounded-xl font-bold">Descontar</button>
              </div>
            </div>
          </div>
        )}

        {role === 'cliente' && (
          <div className="max-w-md mx-auto bg-slate-900 text-white p-8 rounded-[2rem] text-center shadow-2xl">
            <div className="bg-white p-4 rounded-2xl inline-block mb-6"><QRCodeSVG value={user?.email || ""} size={140} /></div>
            <p className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mb-1">Saldo Disponível (48h)</p>
            <h2 className="text-6xl font-black italic">{saldos.disponivel.toFixed(2)}€</h2>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;