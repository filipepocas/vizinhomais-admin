// src/App.tsx
import React from 'react';
import { auth } from './firebase'; // Importação que faltava para corrigir o erro da imagem
import { useAuth } from './authLogic';
import Login from './Login';
import AdminApp from './AdminApp';
import ComercianteApp from './ComercianteApp';

const App: React.FC = () => {
  const { user, role, loading } = useAuth();

  // 1. Ecrã de carregamento inicial
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p>A carregar VizinhoMais...</p>
        </div>
      </div>
    );
  }

  // 2. Se não houver sessão ativa, mostra o Login
  if (!user) {
    return <Login />;
  }

  // 3. Encaminhamento por Perfis (Roles)
  // Se for o teu email (Admin)
  if (role === 'admin') {
    return <AdminApp />;
  }

  // Se for uma conta de Loja (Comerciante)
  if (role === 'comerciante') {
    return <ComercianteApp />;
  }

  // 4. Ecrã padrão para Clientes ou Perfis novos (Checklist: área de cliente)
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#1a73e8' }}>VizinhoMais</h1>
      <div style={{ margin: '20px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', maxWidth: '400px' }}>
        <h3>Bem-vindo, {user.email}</h3>
        <p>A tua conta está ativa.</p>
        <p style={{ fontSize: '13px', color: '#666' }}>
          Se és um Cliente, os teus dados de cashback estarão visíveis aqui em breve. [cite: 19]
        </p>
        <button 
          onClick={() => auth.signOut()} 
          style={{ marginTop: '15px', padding: '10px 20px', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Sair
        </button>
      </div>
    </div>
  );
};

export default App;