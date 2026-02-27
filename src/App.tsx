// src/App.tsx
import React from 'react';
import { useAuth } from './authLogic';

const App: React.FC = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <h2>A carregar o VizinhoMais...</h2>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h1>VizinhoMais</h1>
        <p>Ecrã de Login (Vamos criar a seguir)</p>
        <button onClick={() => alert('Próximo passo!')}>Entrar</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Bem-vindo, {user.email}</h1>
      <p>O teu cargo é: <strong>{role || 'A aguardar atribuição...'}</strong></p>
      <button onClick={() => window.location.reload()}>Sair</button>
    </div>
  );
};

export default App;