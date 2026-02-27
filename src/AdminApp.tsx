// src/AdminApp.tsx
import React from 'react';
import { auth } from './firebase';

const AdminApp: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1a73e8', paddingBottom: '10px' }}>
        <h1 style={{ color: '#1a73e8', margin: 0 }}>Painel Administrador</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span>{auth.currentUser?.email}</span>
          <button onClick={() => auth.signOut()} style={{ padding: '8px 16px', cursor: 'pointer', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}>Sair</button>
        </div>
      </header>
      
      <main style={{ marginTop: '30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
            <h3>Gestão de Lojas</h3>
            <p>Configurar percentuais de cashback e NIFs das lojas.</p>
            <button style={{ padding: '10px', width: '100%', cursor: 'pointer' }}>Ver Lojas</button>
          </div>
          <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
            <h3>Gestão de Clientes</h3>
            <p>Consultar saldos totais e movimentos globais.</p>
            <button style={{ padding: '10px', width: '100%', cursor: 'pointer' }}>Ver Clientes</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminApp;