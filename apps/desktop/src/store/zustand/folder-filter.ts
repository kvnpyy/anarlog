import { create } from "zustand";

interface FolderFilterState {
  activeFolderPath: string | null;
  setActiveFolderPath: (path: string | null) => void;
  toggleActiveFolderPath: (path: string) => void;
}

export const useFolderFilter = create<FolderFilterState>((set, get) => ({
  activeFolderPath: null,
  setActiveFolderPath: (path) => set({ activeFolderPath: path }),
  toggleActiveFolderPath: (path) =>
    set({
      activeFolderPath: get().activeFolderPath === path ? null : path,
    }),
}));
