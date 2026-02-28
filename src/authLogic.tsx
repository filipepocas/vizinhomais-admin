import React, { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { Cliente, Loja } from './interfaces';

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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        // Regra do Administrador (Teu email) [cite: 13]
        if (currentUser.email === 'rochap.filipe@gmail.com') {
          setRole('admin');
        } else {
          // Tenta encontrar na coleção de lojas
          const lojaDoc = await getDoc(doc(db, 'lojas', currentUser.uid));
          if (lojaDoc.exists()) {
            setRole('comerciante');
            setPerfil(lojaDoc.data() as Loja);
          } else {
            // Tenta encontrar na coleção de clientes
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
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, perfil, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);