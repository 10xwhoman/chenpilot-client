import { createSlice, PayloadAction, createAction } from '@reduxjs/toolkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemeState {
  mode: 'light' | 'dark';
}

/**
 * Describes the current state of an in-progress automatic retry sequence.
 * `null` when no retry is active.
 */
export interface RetryStatus {
  /** Human-readable label for what is being retried (e.g. "Sending message") */
  label: string;
  /** 1-based index of the attempt that is currently in-flight */
  attempt: number;
  /** Total number of attempts that will be made before giving up */
  maxAttempts: number;
  /** Epoch ms at which the next retry will fire (used to drive a countdown) */
  nextRetryAt: number;
}

export interface UIState extends ThemeState {
  retryStatus: RetryStatus | null;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: UIState = {
  mode: 'dark',
  retryStatus: null,
};

// ─── Standalone init action ───────────────────────────────────────────────────

export const initializeUI = createAction('ui/initialize', () => {
  const savedTheme =
    typeof window !== 'undefined'
      ? (localStorage.getItem('theme') as 'light' | 'dark' | null)
      : null;
  return { payload: savedTheme || 'dark' };
});

// ─── Slice ────────────────────────────────────────────────────────────────────

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', state.mode);
      }
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.mode = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', state.mode);
      }
    },
    /**
     * Called by the retry interceptor before each retry attempt.
     * Overwrites any previous status with the latest attempt info.
     */
    setRetryStatus: (state, action: PayloadAction<RetryStatus>) => {
      state.retryStatus = action.payload;
    },
    /**
     * Called by the retry interceptor when the request finally succeeds,
     * permanently fails, or is not eligible for retry.
     */
    clearRetryStatus: (state) => {
      state.retryStatus = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(initializeUI, (state, action) => {
      state.mode = action.payload;
    });
  },
});

export const { toggleTheme, setTheme, setRetryStatus, clearRetryStatus } = uiSlice.actions;
export default uiSlice.reducer;
