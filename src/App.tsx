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
  const [formLoja, setFormLoja] = useState({ nome: '', email: '', nif: '', pc: 10 });

  // Cálculo de Saldo 48h (Regra de Negócio)
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

  if (loading) return <div className="h-screen flex items-center justify-center font-bold">Carregando V+...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl">
          <h1 className="text-4xl font-black mb-8 text-center italic text-blue-600">VIZINHO+</h1>
          <input type="email" placeholder="Email" className="input-v mb-4" onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="input-v mb-6" onChange={e => setPassword(e.target.value)} required />
          <button className="btn-primary w-full text-lg">Entrar no Painel</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b p-6 flex justify-between items-center shadow-sm">
        <span className="font-black text-2xl text-blue-600">V+ <span className="text-slate-400 text-sm font-normal">| {role?.toUpperCase()}</span></span>
        <button onClick={() => signOut(auth)} className="text-slate-500 font-bold hover:text-red-600">Sair</button>
      </nav>

      <main className="p-8 max-w-6xl mx-auto">
        {role === 'admin' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-6 text-slate-400 uppercase text-xs">Registar Nova Loja</h3>
              <form onSubmit={criarLojaAdmin} className="space-y-4">
                <input type="text" placeholder="Nome da Loja" className="input-v" onChange={e => setFormLoja({...formLoja, nome: e.target.value})} />
                <input type="email" placeholder="Email de Acesso" className="input-v" onChange={e => setFormLoja({...formLoja, email: e.target.value})} />
                <input type="text" placeholder="NIF" className="input-v" onChange={e => setFormLoja({...formLoja, nif: e.target.value})} />
                <button className="btn-dark w-full">Ativar Comerciante</button>
              </form>
            </div>
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-6 text-slate-400 uppercase text-xs">Lojas Ativas</h3>
              {lojas.map(l => (
                <div key={l.id} className="flex justify-between p-4 bg-slate-50 rounded-xl mb-2 border">
                  <span className="font-bold">{l.nomeLoja}</span>
                  <span className="text-blue-600 font-black">{l.percentualCB}% CB</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
              <h3 className="font-bold text-slate-400 uppercase text-xs">Operação de Caixa</h3>
              <input type="text" placeholder="Email ou Nº Cartão Cliente" className="input-v" onChange={e => setFormMov({...formMov, clienteEmail: e.target.value})} />
              <input type="number" placeholder="Valor da Venda €" className="input-v" onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} />
              <input type="password" placeholder="PIN Operador (5 dígitos)" className="input-v" maxLength={5} onChange={e => setFormMov({...formMov, pin: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleMovimento('ADICIONAR')} className="btn-dark bg-green-600">Adicionar</button>
                <button onClick={() => handleMovimento('DESCONTO')} className="btn-primary">Descontar</button>
              </div>
            </div>
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <h3 className="font-bold text-slate-400 uppercase text-xs mb-4">Últimos Movimentos</h3>
              {movimentos.map(m => (
                <div key={m.id} className="p-4 border-b flex justify-between">
                  <span>{m.clienteId}</span>
                  <span className={m.tipo === 'ADICIONAR' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                    {m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {role === 'cliente' && (
          <div className="max-w-md mx-auto">
            <div className="card-cliente text-center mb-8">
              <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-inner">
                <QRCodeSVG value={user?.email || ""} size={140} />
              </div>
              <p className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mb-1">Saldo Disponível (48h)</p>
              <h2 className="text-6xl font-black italic mb-6">{saldos.disponivel.toFixed(2)}€</h2>
              <div className="flex justify-between border-t border-white/10 pt-4">
                <div className="text-left"><p className="text-[9px] text-slate-500">TOTAL</p><p className="font-bold text-lg">{saldos.total.toFixed(2)}€</p></div>
                <div className="text-right"><p className="text-[9px] text-slate-500">LOJA</p><p className="font-bold text-lg">{(perfil as Cliente)?.nome || 'Vizinho+'}</p></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;