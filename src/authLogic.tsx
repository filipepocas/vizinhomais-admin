// src/authLogic.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Cliente, Loja } from './types';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'comerciante' | 'cliente' | null>(null);
  const [perfil, setPerfil] = useState<Cliente | Loja | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Monitoriza se há alguém logado
    return onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        
        // 1. Verificar se é o Admin (Teu Email)
        if (currentUser.email === 'rochap.filipe@gmail.com') {
          setRole('admin');
        } else {
          // 2. Tentar encontrar na coleção de Lojas
          const lojaDoc = await getDoc(doc(db, 'lojas', currentUser.uid));
          if (lojaDoc.exists()) {
            setRole('comerciante');
            setPerfil(lojaDoc.data() as Loja);
          } else {
            // 3. Tentar encontrar na coleção de Clientes
            const clienteDoc = await getDoc(doc(db, 'clientes', currentUser.uid));
            if (clienteDoc.exists()) {
              setRole('cliente');
              setPerfil(clienteDoc.data() as Cliente);
            }
          }
        }
      } else {
        setUser(null);
        setRole(null);
        setPerfil(null);
      }
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, perfil, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);