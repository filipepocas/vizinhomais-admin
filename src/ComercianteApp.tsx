// src/ComercianteApp.tsx
import React, { useState } from 'react';
import { auth } from './firebase';
import { useAuth } from './authLogic';

const ComercianteApp: React.FC = () => {
  const { perfil } = useAuth();
  const [numCartao, setNumCartao] = useState('');

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <h2 style={{ color: '#2e7d32', marginBottom: '5px' }}>{perfil?.nome || 'Loja Aderente'}</h2>
        <span style={{ fontSize: '14px', color: '#666' }}>NIF: {perfil?.nif} | Cashback: {perfil && 'percentualCB' in perfil ? perfil.percentualCB : 0}%</span>
      </header>

      <main style={{ textAlign: 'center' }}>
        <div style={{ padding: '30px', border: '2px dashed #2e7d32', borderRadius: '15px', backgroundColor: '#f1f8e9' }}>
          <h3 style={{ marginTop: 0 }}>Nova Operação</h3>
          <p>Lê o código de barras ou insere o número do cartão:</p>
          <input 
            type="text" 
            placeholder="Nº do Cartão do Cliente" 
            value={numCartao}
            onChange={(e) => setNumCartao(e.target.value)}
            style={{ width: '100%', padding: '15px', fontSize: '20px', boxSizing: 'border-box', marginBottom: '15px', textAlign: 'center', borderRadius: '8px', border: '1px solid #ccc' }}
          />
          <button style={{ width: '100%', padding: '15px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
            Identificar Cliente
          </button>
        </div>
        
        <button onClick={() => auth.signOut()} style={{ marginTop: '30px', padding: '10px 20px', background: 'none', border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer' }}>
          Terminar Sessão
        </button>
      </main>
    </div>
  );
};

export default ComercianteApp;