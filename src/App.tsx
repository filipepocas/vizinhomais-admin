import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, query, where, addDoc, orderBy, updateDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { Loja, Movimento } from './interfaces';

const App = () => {
  const { user, role, perfil, loading: authLoading } = useAuth();
  const [email, setLocalEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [novaLoja, setNovaLoja] = useState({ nome: '', email: '', nif: '', percentual: 10 });
  const [statsAdmin, setStatsAdmin] = useState({ totalGerado: 0, totalResgatado: 0 });

  const [venda, setVenda] = useState({ clienteEmail: '', valor: 0 });
  const [resgate, setResgate] = useState({ clienteEmail: '', valor: 0 });
  const [isScanning, setIsScanning] = useState(false);
  const [editNomeLoja, setEditNomeLoja] = useState('');

  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [saldoTotal, setSaldoTotal] = useState(0);

  useEffect(() => {
    if (!user || !role) return;
    const fetchData = async () => {
      try {
        if (role === 'admin') {
          const lojasSnap = await getDocs(collection(db, 'lojas'));
          setLojas(lojasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
          const movsSnap = await getDocs(collection(db, 'movimentos'));
          const todos = movsSnap.docs.map(d => d.data() as Movimento);
          setStatsAdmin({
            totalGerado: todos.filter(m => m.tipo === 'ADICIONAR').reduce((a, b) => a + b.valorCashback, 0),
            totalResgatado: todos.filter(m => m.tipo === 'SUBTRAIR').reduce((a, b) => a + b.valorCashback, 0)
          });
        } else {
          const field = role === 'comerciante' ? 'lojaId' : 'clienteId';
          const q = query(collection(db, 'movimentos'), where(field, '==', role === 'comerciante' ? user.uid : user.email), orderBy('dataHora', 'desc'));
          const snap = await getDocs(q);
          const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento));
          setMovimentos(lista);
          if (role === 'cliente') {
            setSaldoTotal(lista.reduce((acc, curr) => curr.tipo === 'ADICIONAR' ? acc + curr.valorCashback : acc - curr.valorCashback, 0));
          }
          if (role === 'comerciante' && perfil) {
            setEditNomeLoja((perfil as Loja).nomeLoja);
          }
        }
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [role, user, perfil]);

  useEffect(() => {
    if (isScanning && role === 'comerciante') {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((text) => {
        setVenda(v => ({ ...v, clienteEmail: text }));
        setResgate(r => ({ ...r, clienteEmail: text }));
        setIsScanning(false);
        scanner.clear();
      }, () => {});
      return () => { scanner.clear(); };
    }
  }, [isScanning, role]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Falha no login."); }
    finally { setIsSubmitting(false); }
  };

  const lancarOperacao = async (tipo: 'ADICIONAR' | 'SUBTRAIR', dados: { clienteEmail: string, valor: number }) => {
    if (!perfil || dados.valor <= 0) return;
    setIsSubmitting(true);
    try {
      const loja = perfil as Loja;
      const valorCB = tipo === 'ADICIONAR' ? (dados.valor * loja.percentualCB) / 100 : dados.valor;
      
      if (tipo === 'SUBTRAIR') {
        const q = query(collection(db, 'movimentos'), where('clienteId', '==', dados.clienteEmail));
        const s = await getDocs(q);
        const saldo = s.docs.map(d => d.data() as Movimento).reduce((a, b) => b.tipo === 'ADICIONAR' ? a + b.valorCashback : a - b.valorCashback, 0);
        if (saldo < dados.valor) { alert("Saldo insuficiente!"); return; }
      }

      const novoMov: any = {
        tipo,
        valorVenda: tipo === 'ADICIONAR' ? dados.valor : 0,
        valorCashback: valorCB,
        clienteId: dados.clienteEmail,
        lojaId: user?.uid,
        nomeLoja: loja.nomeLoja,
        dataHora: new Date().toISOString()
      };
      await addDoc(collection(db, 'movimentos'), novoMov);
      setMovimentos([novoMov, ...movimentos]);
      alert("Operação concluída!");
      setVenda({ clienteEmail: '', valor: 0 }); setResgate({ clienteEmail: '', valor: 0 });
    } catch (e: any) { alert(e.message); }
    finally { setIsSubmitting(false); }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center font-black">VIZINHO+...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[3rem] w-full max-w-md shadow-2xl border-t-8 border-blue-600">
          <h1 className="text-5xl font-black italic tracking-tighter text-center mb-10 text-slate-900">V+</h1>
          {error && <p className="text-red-500 text-center mb-4 font-bold">{error}</p>}
          <div className="space-y-4">
            <input type="email" placeholder="Email" className="w-full p-5 bg-slate-100 rounded-2xl outline-none" onChange={e => setLocalEmail(e.target.value)} required />
            <input type="password" placeholder="Password" className="w-full p-5 bg-slate-100 rounded-2xl outline-none" onChange={e => setPassword(e.target.value)} required />
            <button disabled={isSubmitting} className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition">Entrar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black italic">V+</div>
          <span className="font-black uppercase tracking-tighter text-slate-900">Painel {role}</span>
        </div>
        <button onClick={() => signOut(auth)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600">Sair</button>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {role === 'admin' && (
          <div className="grid lg:grid-cols-3 gap-8">
             <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Saldo em Rede</p>
                <h2 className="text-4xl font-black italic">{(statsAdmin.totalGerado - statsAdmin.totalResgatado).toFixed(2)}€</h2>
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border shadow-sm p-8">
              <h3 className="font-black text-xs uppercase mb-6 tracking-widest">Lojas Adesas</h3>
              <div className="divide-y">
                {lojas.map(l => (
                  <div key={l.id} className="p-4 flex justify-between items-center">
                    <span className="font-bold">{l.nomeLoja}</span>
                    <span className="text-blue-600 font-black">{l.percentualCB}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-blue-600 uppercase text-[10px] tracking-widest">Nova Operação</h3>
                <button onClick={() => setIsScanning(true)} className="bg-slate-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase">Scan QR</button>
              </div>
              {isScanning && <div id="reader" className="mb-6 rounded-2xl overflow-hidden"></div>}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-400">Dados da Venda</p>
                <input type="email" placeholder="Email do Cliente" className="w-full p-4 bg-slate-50 rounded-xl font-bold" value={venda.clienteEmail} onChange={e => setVenda({...venda, clienteEmail: e.target.value})} />
                <input type="number" placeholder="Valor Compra €" className="w-full p-4 bg-slate-50 rounded-xl text-3xl font-black" value={venda.valor || ''} onChange={e => setVenda({...venda, valor: Number(e.target.value)})} />
                <button onClick={() => lancarOperacao('ADICIONAR', venda)} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black uppercase">Dar Cashback</button>
                <div className="pt-6 border-t border-dashed">
                  <p className="text-[10px] font-black uppercase text-orange-400 mb-4">Ou Resgatar Saldo</p>
                  <input type="number" placeholder="Valor Desconto €" className="w-full p-4 bg-slate-50 rounded-xl text-xl font-black mb-4" value={resgate.valor || ''} onChange={e => setResgate({...resgate, valor: Number(e.target.value), clienteEmail: venda.clienteEmail})} />
                  <button onClick={() => lancarOperacao('SUBTRAIR', { clienteEmail: venda.clienteEmail, valor: resgate.valor })} className="w-full bg-orange-500 text-white p-5 rounded-2xl font-black uppercase">Aplicar Desconto</button>
                </div>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
              <h3 className="font-black text-xs uppercase mb-6 tracking-widest">Últimos Movimentos</h3>
              <div className="space-y-4">
                {movimentos.map(m => (
                  <div key={m.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-500">{m.clienteId}</span>
                    <span className={`font-black ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {role === 'cliente' && (
          <div className="max-w-md mx-auto text-center">
            <div className="bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl mb-8">
              <div className="bg-white p-6 rounded-[2rem] inline-block mb-6"><QRCodeSVG value={user.email || ""} size={150} /></div>
              <h2 className="text-6xl font-black italic">{saldoTotal.toFixed(2)}€</h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase mt-4">{user.email}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;