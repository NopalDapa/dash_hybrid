<template>
  <div class="h-screen w-full flex flex-col bg-gray-100 overflow-hidden">
    <nav v-if="isConnected" class="bg-gray-100 p-4 flex items-center justify-between px-6"> 
      <div class="flex flex-grow justify-evenly mr-8">
        <router-link
          to="/data"
          class="text-lg font-medium text-gray-700 hover:text-purple-600 relative px-2 pb-1 router-link flex flex-col items-center w-full"
          active-class="font-bold text-purple-600 after:content-[''] after:block after:w-full after:h-1 after:bg-purple-600 after:rounded after:mt-1 after:transition-transform after:scale-x-100 after:origin-left"
          exact-active-class="font-bold text-purple-600 after:scale-x-100"
        >
          Check Data
          <span
            class="mt-1 inline-flex items-center gap-2 rounded border px-2 py-0.5 text-lg font-semibold leading-tight"
            :class="modeBadgeClasses"
          >
            <span class="text-lg font-semibold">mode</span>
            <span>{{ modeLabel }}</span>
          </span>
        </router-link>
        <router-link
          to="/camera"
          class="text-lg font-medium text-gray-700 hover:text-purple-600 relative px-2 pb-1 router-link flex flex-col items-center w-full"
          active-class="font-bold text-purple-600 after:content-[''] after:block after:w-full after:h-1 after:bg-purple-600 after:rounded after:mt-1 after:transition-transform after:scale-x-100 after:origin-left"
          exact-active-class="font-bold text-purple-600 after:scale-x-100"
        >
          Camera
        </router-link>
        <router-link
          to="/konva"
          class="text-lg font-medium text-gray-700 hover:text-purple-600 relative px-2 pb-1 router-link flex flex-col items-center w-full"
          active-class="font-bold text-purple-600 after:content-[''] after:block after:w-full after:h-1 after:bg-purple-600 after:rounded after:mt-1 after:transition-transform after:scale-x-100 after:origin-left"
          exact-active-class="font-bold text-purple-600 after:scale-x-100"
        >
          Konva
        </router-link>
        <router-link
          to="/configuration"
          class="text-lg font-medium text-gray-700 hover:text-purple-600 relative px-2 pb-1 router-link flex flex-col items-center w-full"
          active-class="font-bold text-purple-600 after:content-[''] after:block after:w-full after:h-1 after:bg-purple-600 after:rounded after:mt-1 after:transition-transform after:scale-x-100 after:origin-left"
          exact-active-class="font-bold text-purple-600 after:scale-x-100"
        >
          Configuration
        </router-link>
        <router-link
          to="/slam"
          class="text-lg font-medium text-gray-700 hover:text-purple-600 relative px-2 pb-1 router-link flex flex-col items-center w-full"
          active-class="font-bold text-purple-600 after:content-[''] after:block after:w-full after:h-1 after:bg-purple-600 after:rounded after:mt-1 after:transition-transform after:scale-x-100 after:origin-left"
          exact-active-class="font-bold text-purple-600 after:scale-x-100"
        >
          Slam
        </router-link>
        <router-link
          to="/joystick"
          class="text-lg font-medium text-gray-700 hover:text-purple-600 relative px-2 pb-1 router-link flex flex-col items-center w-full"
          active-class="font-bold text-purple-600 after:content-[''] after:block after:w-full after:h-1 after:bg-purple-600 after:rounded after:mt-1 after:transition-transform after:scale-x-100 after:origin-left"
          exact-active-class="font-bold text-purple-600 after:scale-x-100"
        >
          Joystick
        </router-link>
      </div>
      <button @click="disconnectRos" class="!bg-red-500 !hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
        Disconnect
      </button>
    </nav>
    <router-view class="flex-grow h-full" />
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue';
import { useROS } from './composables/useRos';
import { useModeStatus } from './composables/useModeStatus';
import { useMainStore } from './stores/store';
import { useRosboardStore } from './stores/rosboard';
import { useRouter } from 'vue-router';
import { useJoystick } from './composables/useJoystick'; // Import the new composable
import { useModeSwitchStore } from './stores/modeSwitch';

const { isConnected, initializeROS } = useROS();
const { label: modeLabel, badgeClasses: modeBadgeClasses } = useModeStatus({ topicName: '/mode_switch' });
const mainStore = useMainStore();
const rosboardStore = useRosboardStore();
const modeSwitchStore = useModeSwitchStore();
const router = useRouter();
useJoystick(); // Initialize the joystick composable globally

watch(
  isConnected,
  (connected) => {
    // If we just connected and haven't received/published anything yet,
    // default the UI state to wheel even without a joystick.
    if (connected && modeSwitchStore.mode == null) {
      modeSwitchStore.setMode(true, 'wheel');
    }
  },
  { immediate: true },
);

onMounted(() => {
  const storedHost = localStorage.getItem('rosboardHost');
  const storedPort = localStorage.getItem('rosboardPort');
  if (storedHost && storedPort && !isConnected.value) {
    initializeROS(storedHost, storedPort);
  }
});

const disconnectRos = () => {
  rosboardStore.disconnect(false);
  mainStore.clearAllData();
  router.push('/connect');
};
</script>
