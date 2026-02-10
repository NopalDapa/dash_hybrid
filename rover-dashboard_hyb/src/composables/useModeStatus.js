import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRosboardStore } from '../stores/rosboard';
import { useModeSwitchStore } from '../stores/modeSwitch';

// Contract:
// - Subscribe to a ROSboard topic (default: /mode_switch)
// - Expect payload: { enabled: boolean, mode: "wheel"|"arm" }
// - Expose normalized status string for UI ("Wheel"/"Arm"/"OFF"/"--")

export function useModeStatus(options = {}) {
  const topicName = options.topicName ?? '/mode_switch';
  const rosboardStore = useRosboardStore();
  const modeStore = useModeSwitchStore();

  const enabled = ref(null); // boolean | null
  const mode = ref(null); // string | null

  const updateFromPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    if (typeof payload.enabled === 'boolean') {
      enabled.value = payload.enabled;
    }

    if (typeof payload.mode === 'string') {
      mode.value = payload.mode;
    }
  };

  const updateFromLocal = () => {
    if (typeof modeStore.enabled === 'boolean') {
      enabled.value = modeStore.enabled;
    }
    if (typeof modeStore.mode === 'string') {
      mode.value = modeStore.mode;
    }
  };

  const label = computed(() => {
    if (enabled.value === false) {
      return 'OFF';
    }
    const m = String(mode.value ?? '').toLowerCase();
    if (m === 'wheel') {
      return 'Wheel';
    }
    if (m === 'arm') {
      return 'Arm';
    }
    return '--';
  });

  const badgeClasses = computed(() => {
    if (enabled.value === false) {
      return 'bg-gray-200 text-gray-700 border-gray-300';
    }
    const m = String(mode.value ?? '').toLowerCase();
    if (m === 'wheel') {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (m === 'arm') {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    return 'bg-gray-100 text-gray-600 border-gray-200';
  });

  let stop = null;

  onMounted(() => {
    // keep ROSboard subscription active while the top-level app is mounted
    rosboardStore.subscribe(topicName, { maxUpdateRate: 10 });

    stop = rosboardStore.$subscribe((_mutation, state) => {
      const payload = state.latestMessages?.[topicName];
      updateFromPayload(payload);

      // If ROSboard doesn't provide this topic, fall back to locally-published state.
      if (!payload) {
        updateFromLocal();
      }
    });

    // populate immediately if already cached
    updateFromPayload(rosboardStore.latestMessages?.[topicName]);
    updateFromLocal();
  });

  // Also watch local store changes to update UI immediately
  watch(
    () => [modeStore.enabled, modeStore.mode],
    () => {
      const payload = rosboardStore.latestMessages?.[topicName];
      if (!payload) {
        updateFromLocal();
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (stop) {
      stop();
      stop = null;
    }
    rosboardStore.unsubscribe(topicName);
  });

  return {
    topicName,
    enabled: computed(() => enabled.value),
    mode: computed(() => mode.value),
    label,
    badgeClasses,
  };
}
