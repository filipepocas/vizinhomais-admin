import React, { useState, useEffect } from 'react';
import { useAuth } from './authLogic';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, query, where, addDoc, orderBy } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { Loja, Movimento } from './interfaces';

const App = () => {
  const { user, role, perfil, loading: authLoading } = useAuth();
  const [email, setLocalEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados Admin
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [novaLoja, setNovaLoja] = useState({ nome: '', email: '', nif: '', percentual: 10, atividade: '' });
  const [statsAdmin, setStatsAdmin] = useState({ totalGerado: 0, totalResgatado: 0 });

  // Estados Comerciante/Cliente
  const [venda, setVenda] = useState({ clienteEmail: '', valor: 0, doc: '' });
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [saldoTotal, setSaldoTotal] = useState(0);
  const [saldoDisponivel, setSaldoDisponivel] = useState(0);

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
            totalResgatado: todos.filter(m => m.tipo !== 'ADICIONAR').reduce((a, b) => a + b.valorCashback, 0)
          });
        } else {
          const field = role === 'comerciante' ? 'lojaId' : 'clienteId';
          const q = query(collection(db, 'movimentos'), where(field, '==', role === 'comerciante' ? user.uid : user.email), orderBy('dataHora', 'desc'));
          const snap = await getDocs(q);
          const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movimento));
          setMovimentos(lista);
          
          if (role === 'cliente') {
            const total = lista.reduce((acc, curr) => curr.tipo === 'ADICIONAR' ? acc + curr.valorCashback : acc - curr.valorCashback, 0);
            setSaldoTotal(total);
            // Lógica das 48 horas (Saldo Disponível) [cite: 6, 64]
            const quarentaOitoHorasAtras = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            const disponivel = lista.filter(m => m.dataHora < quarentaOitoHorasAtras || m.tipo !== 'ADICIONAR')
                                   .reduce((acc, curr) => curr.tipo === 'ADICIONAR' ? acc + curr.valorCashback : acc - curr.valorCashback, 0);
            setSaldoDisponivel(disponivel > total ? total : disponivel);
          }
        }
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [role, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setError("Falha na autenticação. Verifique os dados."); }
    finally { setIsSubmitting(false); }
  };

  const lancarOperacao = async (tipo: 'ADICIONAR' | 'DESCONTO', dados: { clienteEmail: string, valor: number, doc: string }) => {
    if (!perfil || dados.valor <= 0) return;
    setIsSubmitting(true);
    try {
      const loja = perfil as Loja;
      const valorCB = tipo === 'ADICIONAR' ? (dados.valor * loja.percentualCB) / 100 : dados.valor;
      
      const novoMov: any = {
        tipo,
        valorVenda: tipo === 'ADICIONAR' ? dados.valor : 0,
        valorCashback: valorCB,
        clienteId: dados.clienteEmail,
        lojaId: user?.uid,
        nomeLoja: loja.nomeLoja,
        dataHora: new Date().toISOString(),
        docOrigem: dados.doc
      };
      await addDoc(collection(db, 'movimentos'), novoMov);
      setMovimentos([novoMov, ...movimentos]);
      alert("Operação registada!");
      setVenda({ clienteEmail: '', valor: 0, doc: '' });
    } catch (e: any) { alert(e.message); }
    finally { setIsSubmitting(false); }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center font-black text-2xl animate-pulse">VIZINHO+</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[2.5rem] w-full max-w-md shadow-2xl border-t-8 border-blue-600">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black italic tracking-tighter text-slate-900">V+</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Login Unificado</p>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold mb-6 text-center">{error}</div>}
          <div className="space-y-4">
            <input type="email" placeholder="Utilizador (Email)" className="w-full p-5 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600" onChange={e => setLocalEmail(e.target.value)} required />
            <input type="password" placeholder="Palavra-passe" className="w-full p-5 bg-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600" onChange={e => setPassword(e.target.value)} required />
            <button disabled={isSubmitting} className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl">Entrar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-white border-b px-8 py-5 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-blue-200">V+</div>
          <h2 className="font-black text-slate-900 text-xl tracking-tighter uppercase">Painel <span className="text-blue-600">{role}</span></h2>
        </div>
        <button onClick={() => signOut(auth)} className="text-[10px] font-black text-slate-400 bg-slate-50 px-5 py-2 rounded-full hover:bg-red-50 hover:text-red-600 transition uppercase tracking-widest">Logout</button>
      </nav>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {role === 'admin' && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[80px] opacity-30"></div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Saldo Global em Rede</p>
                <h2 className="text-5xl font-black italic tracking-tighter">{(statsAdmin.totalGerado - statsAdmin.totalResgatado).toFixed(2)}€</h2>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
                <h3 className="font-black text-xs uppercase mb-6 tracking-widest text-slate-800">Lojas Ativas ({lojas.length})</h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {lojas.map(l => (
                    <div key={l.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                      <span className="font-black text-xs uppercase">{l.nomeLoja}</span>
                      <span className="text-blue-600 font-black italic">{l.percentualCB}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border shadow-sm p-10">
              <h3 className="font-black text-xs uppercase mb-8 border-b pb-4 tracking-widest">Histórico Global de Movimentos</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-400 uppercase text-[10px] font-black">
                    <tr><th className="pb-4">Data</th><th className="pb-4">Loja</th><th className="pb-4">Cliente</th><th className="pb-4 text-right">Valor</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {movimentos.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 font-mono text-xs">{new Date(m.dataHora).toLocaleDateString()}</td>
                        <td className="py-4 font-black text-xs uppercase">{m.nomeLoja}</td>
                        <td className="py-4 text-slate-500">{m.clienteId}</td>
                        <td className={`py-4 text-right font-black italic ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>
                          {m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {role === 'comerciante' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Ponto de Venda</h3>
                  <button onClick={() => setIsScanning(!isScanning)} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100">Scanner QR</button>
               </div>
               <div className="space-y-6">
                  {isScanning && <div id="reader" className="rounded-3xl overflow-hidden border-4 border-slate-100 mb-6"></div>}
                  <input type="email" placeholder="Email do Cliente" className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-0 outline-none focus:ring-2 focus:ring-blue-600" value={venda.clienteEmail} onChange={e => setVenda({...venda, clienteEmail: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Valor €" className="w-full p-5 bg-slate-50 rounded-2xl text-2xl font-black outline-none border-0 focus:ring-2 focus:ring-blue-600" value={venda.valor || ''} onChange={e => setVenda({...venda, valor: Number(e.target.value)})} />
                    <input type="text" placeholder="Nº Fatura" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none border-0 focus:ring-2 focus:ring-blue-600 uppercase" value={venda.doc} onChange={e => setVenda({...venda, doc: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <button onClick={() => lancarOperacao('ADICIONAR', venda)} className="bg-slate-900 text-white p-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-green-600 transition">Atribuir CB</button>
                    <button onClick={() => lancarOperacao('DESCONTO', venda)} className="bg-white border-2 border-slate-900 text-slate-900 p-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-orange-50 transition">Descontar</button>
                  </div>
               </div>
            </div>
            <div className="bg-white rounded-[3rem] border shadow-sm p-10">
              <h3 className="font-black text-xs uppercase mb-8 tracking-widest">Últimas Operações</h3>
              <div className="space-y-4">
                {movimentos.map(m => (
                  <div key={m.id} className="p-5 bg-slate-50 rounded-2xl flex justify-between items-center group">
                    <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">{m.clienteId}</p><p className="text-[10px] font-mono">{m.docOrigem || 'Sem Doc'}</p></div>
                    <span className={`font-black italic text-lg ${m.tipo === 'ADICIONAR' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo === 'ADICIONAR' ? '+' : '-'}{m.valorCashback.toFixed(2)}€</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {role === 'cliente' && (
          <div className="max-w-md mx-auto space-y-8">
            <div className="bg-slate-950 p-12 rounded-[3.5rem] text-white shadow-2xl flex flex-col items-center border-b-[12px] border-blue-600 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
               <div className="bg-white p-6 rounded-[2.5rem] mb-10 shadow-2xl border-4 border-slate-800"><QRCodeSVG value={user.email || ""} size={160} /></div>
               <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4 text-center">Saldo Disponível (48h)</p>
               <h2 className="text-7xl font-black italic tracking-tighter mb-8">{saldoDisponivel.toFixed(2)}€</h2>
               <div className="w-full pt-8 border-t border-white/10 flex justify-between items-center">
                  <div className="text-left"><p className="text-[8px] font-black text-slate-500 uppercase">Saldo Total</p><p className="font-black text-lg">{saldoTotal.toFixed(2)}€</p></div>
                  <div className="text-right"><p className="text-[8px] font-black text-slate-500 uppercase">Cartão Nº</p><p className="font-mono text-xs">{user.uid.substring(0,10).toUpperCase()}</p></div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;