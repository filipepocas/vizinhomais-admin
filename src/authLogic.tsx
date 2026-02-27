// src/authLogic.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Cliente, Loja } from './interfaces';

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
        if (currentUser.email === 'rochap.filipe@gmail.com') {
          setRole('admin');
        } else {
          try {
            const lojaSnap = await getDoc(doc(db, 'lojas', currentUser.uid));
            if (lojaSnap.exists()) {
              setRole('comerciante');
              setPerfil(lojaSnap.data() as Loja);
            } else {
              const cliSnap = await getDoc(doc(db, 'clientes', currentUser.uid));
              if (cliSnap.exists()) {
                setRole('cliente');
                setPerfil(cliSnap.data() as Cliente);
              }
            }
          } catch (e) {
            console.error("Erro de permissão ou dados:", e);
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