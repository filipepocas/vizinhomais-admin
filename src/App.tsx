import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, orderBy, doc, setDoc, Timestamp } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import type { Movimento, Loja, Cliente, Operador } from './interfaces';

/**
 * APP CENTRAL - VIZINHO+
 * Lógica de Saldos 48h, Gestão de 3 Áreas e Operações de Caixa.
 */

const App = () => {
  const { user, role, perfil, loading } = useAuth();
  
  // ESTADOS DE LOGIN E UI
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState<'home' | 'movimentos' | 'config'>('home');

  // ESTADOS DE DADOS
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);

  // ESTADOS DE FORMULÁRIOS
  const [formMov, setFormMov] = useState({ clienteEmail: '', valorVenda: 0, doc: '', pin: '' });
  const [formLoja, setFormLoja] = useState({ nome: '', email: '', nif: '', pc: 10, atividade: '' });

  // 1. LÓGICA DE CÁLCULO DE SALDOS (REANÁLISE PENTELHO PÁG 5)
  // O saldo só fica disponível 48h após o movimento de ADICIONAR.
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
        // Subtrações e Descontos retiram sempre do total e do disponível imediatamente
        totalTeorico -= m.valorCashback;
        disponivel -= m.valorCashback;
      }
    });

    return { 
      total: totalTeorico, 
      disponivel: disponivel < 0 && role !== 'admin' ? 0 : disponivel 
    };
  }, [movimentos, role]);

  // 2. CARREGAMENTO DE DADOS POR PERFIL
  useEffect(() => {
    if (!user || !role) return;

    const fetchData = async () => {
      // Se for Admin, carrega todas as lojas
      if (role === 'admin') {
        const s = await getDocs(collection(db, 'lojas'));
        setLojas(s.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
      }

      // Se for Comerciante, carrega os seus operadores
      if (role === 'comerciante') {
        const qOp = query(collection(db, 'operadores'), where('lojaId', '==', user.uid));
        const sOp = await getDocs(qOp);
        setOperadores(sOp.docs.map(d => ({ id: d.id, ...d.data() } as Operador)));
      }

      // Carrega movimentos (Filtra por Cliente ou por Loja)
      const campoFiltro = role === 'cliente' ? 'clienteId' : 'lojaId';
      const valorFiltro = role === 'cliente' ? user.email : user.uid;
      
      const qMov = query(
        collection(db, 'movimentos'),
        where(campoFiltro, '==', valorFiltro),
        orderBy('dataHora', 'desc')
      );
      
      const sMov = await getDocs(qMov);
      setMovimentos(sMov.docs.map(d => ({ id: d.id, ...d.data() } as Movimento)));
    };

    fetchData();
  }, [user, role]);

  // 3. FUNÇÃO DE LOGIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Erro no login. Verifique as credenciais.");
    }
  };
  // 4. FUNÇÕES DE OPERAÇÃO (COMERCIANTE) - ANALISE PÁG 5 E 6
  const handleMovimento = async (tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO') => {
    if (!formMov.pin || formMov.pin.length !== 5) return alert("PIN de 5 dígitos obrigatório!");
    if (!perfil) return;

    // Validação do Operador
    const opValido = operadores.find(o => o.codigo === formMov.pin);
    if (!opValido) return alert("PIN de Operador inválido!");

    // Validação de Saldo para Desconto
    if (tipo === 'DESCONTO' && formMov.valorVenda > saldos.disponivel) {
      return alert("Saldo disponível insuficiente para este desconto!");
    }

    const valorCB = tipo === 'ADICIONAR' 
      ? (formMov.valorVenda * (perfil as Loja).percentualCB) / 100 
      : formMov.valorVenda;

    const novoMov: Omit<Movimento, 'id'> = {
      tipo,
      valorVenda: formMov.valorVenda,
      valorCashback: valorCB,
      clienteId: formMov.clienteEmail, // No futuro, buscar UID pelo email/cartão
      lojaId: user!.uid,
      nomeLoja: (perfil as Loja).nomeLoja,
      dataHora: new Date().toISOString(),
      docOrigem: formMov.doc,
      operadorNome: opValido.nome
    };

    try {
      await addDoc(collection(db, 'movimentos'), novoMov);
      alert("Movimento registado com sucesso!");
      setFormMov({ clienteEmail: '', valorVenda: 0, doc: '', pin: '' });
      window.location.reload(); // Recarrega para atualizar saldos
    } catch (err) { alert("Erro ao registar movimento."); }
  };

  // 5. INTERFACE DO ADMINISTRADOR
  const renderAdmin = () => (
    <div className="grid gap-8">
      <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-xl">
        <h2 className="text-3xl font-black italic">Gestão de Rede V+</h2>
        <p className="text-slate-400 text-sm mt-2">Controlo total de Lojas e Cashback Global.</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        <form onSubmit={criarLojaAdmin} className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-4">
          <p className="font-black text-[10px] uppercase text-blue-600 tracking-widest">Nova Loja Aderente</p>
          <input type="text" placeholder="Nome da Loja" className="input-v" onChange={e => setFormLoja({...formLoja, nome: e.target.value})} required />
          <input type="email" placeholder="Email de Acesso" className="input-v" onChange={e => setFormLoja({...formLoja, email: e.target.value})} required />
          <input type="text" placeholder="NIF" className="input-v" onChange={e => setFormLoja({...formLoja, nif: e.target.value})} required />
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase italic">% Cashback:</span>
            <input type="number" className="w-20 p-3 bg-blue-50 text-blue-600 font-black rounded-xl" value={formLoja.pc} onChange={e => setFormLoja({...formLoja, pc: Number(e.target.value)})} />
          </div>
          <button className="btn-dark w-full text-xs">Ativar Comerciante</button>
        </form>

        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <p className="font-black text-[10px] uppercase text-slate-400 mb-6 tracking-widest">Lojas Registadas ({lojas.length})</p>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {lojas.map(l => (
              <div key={l.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center border border-slate-100">
                <span className="font-bold text-sm uppercase">{l.nomeLoja}</span>
                <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black">{l.percentualCB}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // 6. INTERFACE DO COMERCIANTE
  const renderComerciante = () => (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
        <h3 className="font-black text-[10px] uppercase text-blue-600 tracking-widest">Operação de Caixa</h3>
        <div className="space-y-4">
          <input type="text" placeholder="Email ou Nº Cartão Cliente" className="input-v" value={formMov.clienteEmail} onChange={e => setFormMov({...formMov, clienteEmail: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <input type="number" placeholder="Valor €" className="input-v text-2xl font-black" value={formMov.valorVenda || ''} onChange={e => setFormMov({...formMov, valorVenda: Number(e.target.value)})} />
            <input type="text" placeholder="Fatura / Doc" className="input-v uppercase" value={formMov.doc} onChange={e => setFormMov({...formMov, doc: e.target.value})} />
          </div>
          <input type="password" placeholder="PIN OPERADOR (5 DÍGITOS)" className="input-v text-center tracking-[1em]" maxLength={5} value={formMov.pin} onChange={e => setFormMov({...formMov, pin: e.target.value})} />
          
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button onClick={() => handleMovimento('ADICIONAR')} className="btn-dark text-[10px] bg-green-600 hover:bg-green-700">Adicionar Saldo</button>
            <button onClick={() => handleMovimento('DESCONTO')} className="btn-primary text-[10px]">Descontar Saldo</button>
          </div>
          <button onClick={() => handleMovimento('SUBTRAIR')} className="w-full text-[9px] font-black uppercase text-red-500 hover:underline">Emitir Nota de Crédito (Subtrair)</button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border p-10 shadow-sm">
        <h3 className="font-black text-[10px] uppercase text-slate-400 mb-8 tracking-widest">Histórico de Hoje</h3>
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {movimentos.map(m => (
            <div key={m.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border-l-4 border-blue-600">
              <div>
                <p className="text-xs font-black">{m.clienteId}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase">{m.operadorNome} • {m.docOrigem || 'Sem Doc'}</p>
              </div>
              <span className={`font-black italic ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>
                {m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 7. INTERFACE DO CLIENTE (PÁG 1 E 2)
  const renderCliente = () => (
    <div className="max-w-md mx-auto space-y-8">
      <div className="card-cliente relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="bg-white p-6 rounded-[2.5rem] mb-10 shadow-inner flex justify-center border-4 border-slate-900">
          <QRCodeSVG value={(perfil as Cliente)?.numCartao || user?.email || ""} size={160} />
        </div>
        <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4 text-center">Saldo Disponível (48h)</p>
        <h2 className="text-7xl font-black italic tracking-tighter mb-10 text-center">{saldos.disponivel.toFixed(2)}€</h2>
        
        <div className="w-full pt-8 border-t border-white/10 flex justify-between items-center">
          <div className="text-left">
            <p className="text-[8px] font-black text-slate-500 uppercase">Saldo Total</p>
            <p className="font-black text-xl">{saldos.total.toFixed(2)}€</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-500 uppercase">ID Cartão</p>
            <p className="font-mono text-xs">{(perfil as Cliente)?.numCartao}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
        <p className="font-black text-[10px] uppercase text-slate-400 mb-6 tracking-widest text-center">Meus Movimentos</p>
        <div className="space-y-4">
          {movimentos.map(m => (
            <div key={m.id} className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-[10px] font-bold uppercase">{m.nomeLoja}</span>
              <span className={`font-black text-sm ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-slate-900'}`}>
                {m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-white border-b px-8 py-6 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-blue-100">V+</div>
          <span className="font-black text-slate-900 uppercase tracking-tighter text-xl">Vizinho+</span>
        </div>
        <button onClick={() => signOut(auth)} className="bg-slate-100 text-slate-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-50 hover:text-red-600 transition">Sair</button>
      </nav>

      <main className="p-8 max-w-7xl mx-auto w-full flex-1">
        {role === 'admin' && renderAdmin()}
        {role === 'comerciante' && renderComerciante()}
        {role === 'cliente' && renderCliente()}
      </main>
    </div>
  );
};

export default App;