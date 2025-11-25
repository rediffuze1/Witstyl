import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserContextType {
  firstName: string;
  setFirstName: (name: string) => void;
  updateFirstName: (name: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [firstName, setFirstName] = useState('');

  // Charger le prénom depuis localStorage au montage
  useEffect(() => {
    const savedFirstName = localStorage.getItem('userFirstName');
    if (savedFirstName) {
      setFirstName(savedFirstName);
    }
  }, []);

  // Écouter les changements depuis l'API via un événement personnalisé
  useEffect(() => {
    const handleApiUserUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const apiFirstName = customEvent.detail?.firstName;
      if (apiFirstName && apiFirstName !== firstName) {
        setFirstName(apiFirstName);
        localStorage.setItem('userFirstName', apiFirstName);
      }
    };

    window.addEventListener('apiUserUpdated', handleApiUserUpdate);
    return () => {
      window.removeEventListener('apiUserUpdated', handleApiUserUpdate);
    };
  }, [firstName]);

  // Écouter les changements dans localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const savedName = localStorage.getItem('userFirstName');
      if (savedName && savedName !== firstName) {
        setFirstName(savedName);
      }
    };

    // Écouter les événements de changement de localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // Écouter les événements personnalisés pour les changements dans le même onglet
    window.addEventListener('userNameUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userNameUpdated', handleStorageChange);
    };
  }, [firstName]);

  const updateFirstName = (name: string) => {
    setFirstName(name);
    localStorage.setItem('userFirstName', name);
    // Déclencher un événement personnalisé pour notifier les autres composants
    window.dispatchEvent(new CustomEvent('userNameUpdated', { detail: name }));
  };

  return (
    <UserContext.Provider value={{ firstName, setFirstName, updateFirstName }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}


