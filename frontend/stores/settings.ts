import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Settings } from '@/types';

interface SettingsStore extends Settings {
  setOpenaiApiKey: (key: string) => void;
  setModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      openaiApiKey: '',
      model: 'gpt-3.5-turbo',
      setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
      setModel: (model) => set({ model }),
    }),
    {
      name: 'settings-storage',
    }
  )
);
