// src/authLogic.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Cliente, Loja } from './types';

// Definição do que o Contexto de Autenticação vai partilhar com a App
interface AuthContextType {
  user: User | null;
  role: 'admin' | 'comerciante' | 'cliente' | null;
  perfil: Cliente | Loja | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  role: null, 
  perfil: null, 
  loading: true 
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'comerciante' | 'cliente' | null>(null);
  const [perfil, setPerfil] = useState<Cliente | Loja | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Monitor de estado do Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        
        // REGRA DE OURO: Verificar se é o teu email de Admin
        if (currentUser.email === 'rochap.filipe@gmail.com') {
          setRole('admin');
          setPerfil(null);
        } else {
          // Se não for admin, procura nas Lojas
          try {
            const lojaDoc = await getDoc(doc(db, 'lojas', currentUser.uid));
            if (lojaDoc.exists()) {
              setRole('comerciante');
              setPerfil(lojaDoc.data() as Loja);
            } else {
              // Se não for loja, procura nos Clientes
              const clienteDoc = await getDoc(doc(db, 'clientes', currentUser.uid));
              if (clienteDoc.exists()) {
                setRole('cliente');
                setPerfil(clienteDoc.data() as Cliente);
              } else {
                setRole(null);
                setPerfil(null);
              }
            }
          } catch (error) {
            console.error("Erro ao procurar perfil:", error);
          }
        }
      } else {
        // Se ninguém estiver logado, limpa tudo
        setUser(null);
        setRole(null);
        setPerfil(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, perfil, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar a autenticação em qualquer ecrã
export const useAuth = () => useContext(AuthContext);