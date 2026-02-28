import React, { useState, useEffect, useMemo } from 'react';
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
  const [formLoja, setFormLoja] = useState({ nome: '', email: '', nif: '', pc: 10, atividade: '' });

  const saldos = useMemo(() => {
    const agora = new Date().getTime();
    const quarentaEOitoHorasEmMs = 48 * 60 * 60 * 1000;
    let totalTeorico = 0;
    let disponivel = 0;

    movimentos.forEach(m => {
      const dataMov = new Date(m.dataHora).getTime();
      const isDisponivel = (agora - dataMov) >= quarentaEOitoHorasEmMs;
      if (m.tipo === 'ADICIONAR') {
        totalTeorico += m.valorCashback;
        if (isDisponivel) disponivel += m.valorCashback;
      } else {
        totalTeorico -= m.valorCashback;
        disponivel -= m.valorCashback;
      }
    });
    return { total: totalTeorico, disponivel: disponivel < 0 ? 0 : disponivel };
  }, [movimentos]);

  useEffect(() => {
    if (!user || !role) return;
    const fetchData = async () => {
      if (role === 'admin') {
        const s = await getDocs(collection(db, 'lojas'));
        setLojas(s.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
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
    fetchData();
  }, [user, role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { alert("Erro no login."); }
  };

  const criarLojaAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, formLoja.email, "loja123456");
      const novaLoja: Loja = {
        id: res.user.uid, nomeLoja: formLoja.nome, email: formLoja.email,
        nif: formLoja.nif, morada: '', codigoPostal: '', cidade: '', telefone: '',
        atividade: formLoja.atividade, percentualCB: formLoja.pc, ativo: true
      };
      await setDoc(doc(db, 'lojas', res.user.uid), novaLoja);
      alert("Loja Criada!");
      window.location.reload();
    } catch (err: any) { alert(err.message); }
  };
  const handleMovimento = async (tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO') => {
    if (!formMov.pin || formMov.pin.length !== 5) return alert("PIN de 5 dígitos obrigatório!");
    const opValido = operadores.find(o => o.codigo === formMov.pin);
    if (!opValido) return alert("PIN inválido!");
    const valorCB = tipo === 'ADICIONAR' ? (formMov.valorVenda * (perfil as Loja).percentualCB) / 100 : formMov.valorVenda;
    const novoMov: Omit<Movimento, 'id'> = {
      tipo, valorVenda: formMov.valorVenda, valorCashback: valorCB,
      clienteId: formMov.clienteEmail, lojaId: user!.uid, nomeLoja: (perfil as Loja).nomeLoja,
      dataHora: new Date().toISOString(), docOrigem: formMov.doc, operadorNome: opValido.nome
    };
    await addDoc(collection(db, 'movimentos'), novoMov);
    alert("Registado!");
    window.location.reload();
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">V+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[3rem] w-full max-w-md">
          <h1 className="text-5xl font-black text-center mb-10 italic">V+</h1>
          <input type="email" placeholder="Email" className="input-v mb-4" onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="input-v mb-6" onChange={e => setPassword(e.target.value)} required />
          <button className="btn-primary w-full">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b px-8 py-6 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black italic">V+</div>
          <span className="font-black text-slate-900 uppercase text-xl">PAINEL {role}</span>
        </div>
        <button onClick={() => signOut(auth)} className="bg-slate-100 text-slate-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Sair</button>
      </nav>
      <main className="p-8 max-w-7xl mx-auto w-full flex-1">
        {role === 'admin' && (
          <div className="grid md:grid-cols-2 gap-8">
            <form onSubmit={criarLojaAdmin} className="bg-white p-8 rounded-[2.5rem] border space-y-4">
              <p className="font-black text-[10px] uppercase text-blue-600">Nova Loja</p>
              <input type="text" placeholder="Nome" className="input-v" onChange={e => setFormLoja({...formLoja, nome: e.target.value})} />
              <input type="email" placeholder="Email" className="input-v" onChange={e => setFormLoja({...formLoja, email: e.target.value})} />
              <input type="text" placeholder="NIF" className="input-v" onChange={e => setFormLoja({...formLoja, nif: e.target.value})} />
              <button className="btn-dark w-full">Criar Loja</button>
            </form>
            <div className="bg-white p-8 rounded-[2.5rem] border">
               <p className="font-black text-[10px] uppercase text-slate-400 mb-4">Lojas Ativas</p>
               {lojas.map(l => <div key={l.id} className="p-4 bg-slate-50 rounded-xl mb-2 flex justify-between"><b>{l.nomeLoja}</b> <span>{l.percentualCB}%</span></div>)}
            </div>
          </div>
        )}
        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3rem] border space-y-4">
              <input type="text" placeholder="Email Cliente" className="input-v" onChange={e => setFormMov({...formMov, clienteEmail: e.target.value})} />
              <input type="number" placeholder="Valor €" className="input-v" onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} />
              <input type="password" placeholder="PIN 5 DÍGITOS" className="input-v" maxLength={5} onChange={e => setFormMov({...formMov, pin: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleMovimento('ADICIONAR')} className="btn-dark bg-green-600">Adicionar</button>
                <button onClick={() => handleMovimento('DESCONTO')} className="btn-primary">Descontar</button>
              </div>
            </div>
            <div className="bg-white p-10 rounded-[3rem] border">
               {movimentos.map(m => <div key={m.id} className="p-4 border-b flex justify-between italic"><span>{m.clienteId}</span> <b>{m.valorCashback.toFixed(2)}€</b></div>)}
            </div>
          </div>
        )}
        {role === 'cliente' && (
          <div className="max-w-md mx-auto card-cliente text-center">
            <div className="bg-white p-6 rounded-3xl mb-10 flex justify-center border-4 border-slate-900">
              <QRCodeSVG value={user?.email || ""} size={160} />
            </div>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-2">Saldo Disponível (48h)</p>
            <h2 className="text-6xl font-black mb-10">{saldos.disponivel.toFixed(2)}€</h2>
            <div className="flex justify-between border-t border-white/10 pt-6">
              <div className="text-left"><p className="text-[8px] text-slate-500">TOTAL TEÓRICO</p><p className="font-black text-xl">{saldos.total.toFixed(2)}€</p></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
export default App;