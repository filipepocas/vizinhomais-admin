// src/authLogic.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
        // Admin: rochap.filipe@gmail.com
        if (currentUser.email === 'rochap.filipe@gmail.com') {
          setRole('admin');
        } else {
          const lojaSnap = await getDoc(doc(db, 'lojas', currentUser.uid));
          if (lojaSnap.exists()) {
            setRole('comerciante');
            setPerfil(lojaSnap.data() as Loja);
          } else {
            const clienteSnap = await getDoc(doc(db, 'clientes', currentUser.uid));
            if (clienteSnap.exists()) {
              setRole('cliente');
              setPerfil(clienteSnap.data() as Cliente);
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