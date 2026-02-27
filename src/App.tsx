// src/App.tsx
import React from 'react';
import { useAuth } from './authLogic';
import Login from './Login';
import AdminApp from './AdminApp';
import ComercianteApp from './ComercianteApp';

const App: React.FC = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 2s linear infinite', margin: '0 auto 15px' }}></div>
          <p>A carregar VizinhoMais...</p>
        </div>
      </div>
    );
  }

  // Se não houver utilizador, mostra o Login
  if (!user) {
    return <Login />;
  }

  // Se houver utilizador, decide o painel baseado no Role (definido no authLogic)
  if (role === 'admin') {
    return <AdminApp />;
  }

  if (role === 'comerciante') {
    return <ComercianteApp />;
  }

  // Se for Cliente (ou perfil ainda não definido no Firestore)
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#1a73e8' }}>VizinhoMais</h1>
      <div style={{ margin: '20px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', maxWidth: '400px' }}>
        <h3>Bem-vindo, {user.email}</h3>
        <p>A tua conta está ativa, mas ainda não tens um perfil de Comerciante associado.</p>
        <p style={{ fontSize: '13px', color: '#666' }}>Se és um Cliente, a App móvel estará disponível brevemente.</p>
        <button onClick={() => auth.signOut()} style={{ marginTop: '15px', padding: '10px 20px', cursor: 'pointer' }}>Sair</button>
      </div>
    </div>
  );
};

export default App;