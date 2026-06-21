import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { Workspace } from '../types';

interface WorkspaceContextType {
  user: User | null;
  authReady: boolean;
  geminiApiKey: string;
  openaiApiKey: string;
  useSystemGeminiKey: boolean;
  setGeminiApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setUseSystemGeminiKey: (use: boolean) => void;
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  workspaces: Workspace[];
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [geminiApiKey, setGeminiApiKeyState] = useState(() => localStorage.getItem('mentor_ai_gemini_key') || '');
  const [openaiApiKey, setOpenaiApiKeyState] = useState(() => localStorage.getItem('mentor_ai_openai_key') || '');
  const [useSystemGeminiKey, setUseSystemGeminiKeyState] = useState(() => localStorage.getItem('mentor_ai_use_system_key') !== 'false'); // Mặc định là true nếu không set
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('w1');

  const workspaces: Workspace[] = [
    { id: 'w1', name: 'Dự án chính' },
    { id: 'w2', name: 'Personal Workspace' },
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const setGeminiApiKey = (key: string) => {
    setGeminiApiKeyState(key);
    localStorage.setItem('mentor_ai_gemini_key', key);
  };

  const setOpenaiApiKey = (key: string) => {
    setOpenaiApiKeyState(key);
    localStorage.setItem('mentor_ai_openai_key', key);
  };

  const setUseSystemGeminiKey = (use: boolean) => {
    setUseSystemGeminiKeyState(use);
    localStorage.setItem('mentor_ai_use_system_key', String(use));
  };

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        authReady,
        geminiApiKey,
        openaiApiKey,
        useSystemGeminiKey,
        setGeminiApiKey,
        setOpenaiApiKey,
        setUseSystemGeminiKey,
        activeWorkspaceId,
        setActiveWorkspaceId,
        workspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
