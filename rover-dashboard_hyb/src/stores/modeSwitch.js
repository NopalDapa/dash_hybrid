import { defineStore } from 'pinia';

// Single source of truth for dashboard UI-mode state.
// This is used as a UI fallback when ROSboard doesn't echo custom messages.
export const useModeSwitchStore = defineStore('modeSwitch', {
  state: () => ({
    enabled: null, // boolean | null
    mode: null, // 'wheel' | 'arm' | null
    bootstrapped: false,
  }),
  actions: {
    setMode(enabled, mode) {
      if (typeof enabled === 'boolean') {
        this.enabled = enabled;
      }
      if (typeof mode === 'string') {
        this.mode = mode;
      }
    },
    markBootstrapped() {
      this.bootstrapped = true;
    },
    reset() {
      this.enabled = null;
      this.mode = null;
      this.bootstrapped = false;
    },
  },
});
