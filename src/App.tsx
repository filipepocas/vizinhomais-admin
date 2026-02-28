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

  // 1. CÁLCULO DE SALDOS (REGRA 48H) - DETALHE PÁG 5
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
        // DESCONTO ou SUBTRAIR retira sempre do disponível primeiro
        total -= m.valorCashback;
        disponivel -= m.valorCashback;
      }
    });
    return { total, disponivel };
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

  // 2. FUNÇÕES DE ADMIN
  const criarLojaAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, formLoja.email, "loja123456");
      await setDoc(doc(db, 'lojas', res.user.uid), {
        id: res.user.uid, nomeLoja: formLoja.nome, email: formLoja.email, nif: formLoja.nif, percentualCB: formLoja.pc, ativo: true
      });
      alert("Loja criada!");
      window.location.reload();
    } catch (err: any) { alert(err.message); }
  };

  // 3. FUNÇÕES DE COMERCIANTE (REGISTO CLIENTE E MOVIMENTOS)
  const registarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createUserWithEmailAndPassword(auth, formNovoCliente.email, "cliente123");
      await setDoc(doc(db, 'clientes', res.user.uid), {
        id: res.user.uid, nome: formNovoCliente.nome, email: formNovoCliente.email, nif: formNovoCliente.nif, codigoPostal: formNovoCliente.cp, numCartao: Math.floor(100000000 + Math.random() * 900000000).toString(), ativo: true
      });
      alert("Cliente registado com sucesso!");
      setFormNovoCliente({ nome: '', email: '', nif: '', cp: '' });
    } catch (err: any) { alert("Erro: " + err.message); }
  };

  const handleMovimento = async (tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO') => {
    if (formMov.pin.length !== 5) return alert("PIN de 5 dígitos necessário!");
    const op = operadores.find(o => o.codigo === formMov.pin);
    if (!op) return alert("PIN de operador inválido!");

    // VALIDAÇÃO DE SALDO (PÁG 5)
    if (tipo === 'DESCONTO' && formMov.valorVenda > saldos.disponivel) {
      return alert("Saldo disponível insuficiente! O cliente tem apenas " + saldos.disponivel.toFixed(2) + "€");
    }

    const valorCB = tipo === 'ADICIONAR' 
      ? (formMov.valorVenda * (perfil as Loja).percentualCB) / 100 
      : formMov.valorVenda;

    await addDoc(collection(db, 'movimentos'), {
      tipo, valorVenda: formMov.valorVenda, valorCashback: valorCB,
      clienteId: formMov.clienteEmail, lojaId: user!.uid, nomeLoja: (perfil as Loja).nomeLoja,
      dataHora: new Date().toISOString(), docOrigem: formMov.doc, operadorNome: op.nome
    });
    alert("Operação registada!");
    window.location.reload();
  };

  const criarOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'operadores'), { nome: formOp.nome, codigo: formOp.pin, lojaId: user!.uid });
    setFormOp({ nome: '', pin: '' });
    window.location.reload();
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-blue-600 animate-pulse">V+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6 text-slate-900">
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="bg-white border-b p-6 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <span className="font-black text-2xl text-blue-600 italic">V+ <small className="text-slate-400 text-xs uppercase not-italic">| {role}</small></span>
        <button onClick={() => signOut(auth)} className="text-slate-400 font-bold hover:text-red-600 transition-colors">Sair</button>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-12">
        {role === 'admin' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-6 text-slate-400 uppercase text-xs">Criar Loja</h3>
              <form onSubmit={criarLojaAdmin} className="space-y-4">
                <input type="text" placeholder="Nome da Loja" className="input-v" onChange={e => setFormLoja({...formLoja, nome: e.target.value})} />
                <input type="email" placeholder="Email" className="input-v" onChange={e => setFormLoja({...formLoja, email: e.target.value})} />
                <input type="number" placeholder="% Cashback" className="input-v" onChange={e => setFormLoja({...formLoja, pc: Number(e.target.value)})} />
                <button className="btn-primary w-full">Ativar Comerciante</button>
              </form>
            </div>
            <div className="bg-white p-8 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-6 text-slate-400 uppercase text-xs">Lojas Ativas</h3>
              {lojas.map(l => (
                <div key={l.id} className="p-4 bg-slate-50 rounded-xl mb-2 flex justify-between font-bold border">
                  {l.nomeLoja} <span className="text-blue-600">{l.percentualCB}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* COLUNA 1: OPERAÇÃO */}
            <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
              <h3 className="font-bold text-slate-400 uppercase text-xs">Venda / Cashback</h3>
              <input type="text" placeholder="Email Cliente" className="input-v" value={formMov.clienteEmail} onChange={e => setFormMov({...formMov, clienteEmail: e.target.value})} />
              <input type="number" placeholder="Valor €" className="input-v" onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} />
              <input type="text" placeholder="Fatura / Doc" className="input-v" onChange={e => setFormMov({...formMov, doc: e.target.value})} />
              <input type="password" placeholder="PIN Operador (5)" className="input-v" maxLength={5} onChange={e => setFormMov({...formMov, pin: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleMovimento('ADICIONAR')} className="bg-green-600 text-white p-4 rounded-xl font-bold">Adicionar</button>
                <button onClick={() => handleMovimento('DESCONTO')} className="btn-primary">Descontar</button>
              </div>
              <button onClick={() => handleMovimento('SUBTRAIR')} className="w-full text-red-500 text-[10px] font-bold uppercase">Emitir Nota de Crédito (Subtrair)</button>
            </div>

            {/* COLUNA 2: NOVO CLIENTE */}
            <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
              <h3 className="font-bold text-slate-400 uppercase text-xs">Registar Cliente</h3>
              <form onSubmit={registarCliente} className="space-y-3">
                <input type="text" placeholder="Nome Completo" className="input-v py-2 text-sm" onChange={e => setFormNovoCliente({...formNovoCliente, nome: e.target.value})} required />
                <input type="email" placeholder="Email" className="input-v py-2 text-sm" onChange={e => setFormNovoCliente({...formNovoCliente, email: e.target.value})} required />
                <input type="text" placeholder="NIF" className="input-v py-2 text-sm" onChange={e => setFormNovoCliente({...formNovoCliente, nif: e.target.value})} />
                <button className="btn-dark w-full text-sm">Criar Cartão Digital</button>
              </form>
            </div>

            {/* COLUNA 3: OPERADORES */}
            <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-4">
              <h3 className="font-bold text-slate-400 uppercase text-xs">Operadores</h3>
              <form onSubmit={criarOperador} className="flex gap-2">
                <input type="text" placeholder="Nome" className="input-v py-2 text-sm" value={formOp.nome} onChange={e => setFormOp({...formOp, nome: e.target.value})} required />
                <input type="password" placeholder="PIN" className="input-v py-2 w-20 text-sm" maxLength={5} value={formOp.pin} onChange={e => setFormOp({...formOp, pin: e.target.value})} required />
                <button className="bg-slate-900 text-white px-4 rounded-xl font-bold">+</button>
              </form>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {operadores.map(op => (
                  <div key={op.id} className="flex justify-between p-2 bg-slate-50 rounded-lg border text-xs font-bold">
                    {op.nome} <code>({op.codigo})</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {role === 'cliente' && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="bg-slate-900 text-white p-10 rounded-[3rem] text-center shadow-2xl border-b-[12px] border-blue-600">
              <div className="bg-white p-4 rounded-2xl inline-block mb-6"><QRCodeSVG value={user?.email || ""} size={160} /></div>
              <p className="text-blue-400 font-bold uppercase text-[10px] tracking-widest mb-1">Saldo Disponível (48h)</p>
              <h2 className="text-7xl font-black italic mb-2">{saldos.disponivel.toFixed(2)}€</h2>
              <div className="flex justify-between border-t border-white/10 pt-4 text-left">
                <div><p className="text-[8px] text-slate-500 uppercase">Saldo Total</p><p className="font-bold">{saldos.total.toFixed(2)}€</p></div>
                <div className="text-right"><p className="text-[8px] text-slate-500 uppercase">Cartão</p><p className="font-mono text-xs">{user?.email}</p></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
              <h3 className="font-bold text-slate-400 uppercase text-[10px] mb-4">Últimos Movimentos nesta Loja</h3>
              {movimentos.map(m => (
                <div key={m.id} className="flex justify-between py-2 border-b text-sm">
                  <span className="text-slate-500">{new Date(m.dataHora).toLocaleDateString()}</span>
                  <span className={m.tipo === 'ADICIONAR' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                    {m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€
                  </span>
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