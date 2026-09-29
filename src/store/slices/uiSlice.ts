import { createSlice, PayloadAction, createAction } from "@reduxjs/toolkit";

export interface ThemeState {
  mode: "light" | "dark";
  language: "en" | "ar" | "es" | "fr";
}

const initialState: ThemeState = {
  mode: "dark", // Default to dark mode
  language: "en", // Default to English
};

// Create action for initialization
export const initializeUI = createAction("ui/initialize", () => {
  // Get theme and language from localStorage or use defaults
  const savedTheme =
    typeof window !== "undefined"
      ? (localStorage.getItem("theme") as "light" | "dark" | null)
      : null;

  const savedLanguage =
    typeof window !== "undefined"
      ? (localStorage.getItem("language") as "en" | "ar" | "es" | "fr" | null)
      : null;

  return {
    payload: {
      theme: savedTheme || "dark",
      language: savedLanguage || "en",
    },
  };
});

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === "light" ? "dark" : "light";
      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("theme", state.mode);
      }
    },
    setTheme: (state, action: PayloadAction<"light" | "dark">) => {
      state.mode = action.payload;
      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("theme", state.mode);
      }
    },
    setLanguage: (state, action: PayloadAction<"en" | "ar" | "es" | "fr">) => {
      state.language = action.payload;
      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("language", state.language);
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(initializeUI, (state, action) => {
      state.mode = action.payload.theme;
      state.language = action.payload.language;
    });
  },
});

export const { toggleTheme, setTheme, setLanguage } = uiSlice.actions;
export default uiSlice.reducer;
