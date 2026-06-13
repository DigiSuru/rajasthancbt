import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set) => ({
      userApiKey: '',
      setUserApiKey: (key) => set({ userApiKey: key }),
      
      showApiSetup: true,
      setShowApiSetup: (show) => set({ showApiSetup: show }),

      examFontSize: 1, // 0: Small, 1: Normal, 2: Large
      setExamFontSize: (size) => set({ examFontSize: size }),
      
      // We can persist current active test so a refresh doesn't destroy it
      activeTestState: null, // { currentQuiz, answers, visited, markedForReview, timeLeft, currentQuestionIndex, testViewState }
      setActiveTestState: (stateUpdate) => set((prev) => ({ 
        activeTestState: prev.activeTestState ? { ...prev.activeTestState, ...stateUpdate } : stateUpdate 
      })),
      clearActiveTest: () => set({ activeTestState: null }),
    }),
    {
      name: 'cbt-creator-storage',
      partialize: (state) => ({ 
        userApiKey: state.userApiKey, 
        examFontSize: state.examFontSize,
        activeTestState: state.activeTestState 
      }), // only persist these
    }
  )
);
