<template>
  <div class="min-h-screen w-full flex flex-col bg-gray-100">
    <nav v-if="isConnected" class="bg-gray-100 p-4 flex items-center justify-between px-6"> 
      <div class="flex flex-grow justify-evenly mr-8">
        <router-link
          to="/data"
          class="text-lg font-medium text-gray-700 hover:text-purple-600 relative px-2 pb-1 router-link flex flex-col items-center w-full"
          active-class="font-bold text-purple-600 after:content-[''] after:block after:w-full after:h-1 after:bg-purple-600 after:rounded after:mt-1 after:transition-transform after:scale-x-100 after:origin-left"
          exact-active-class="font-bold text-purple-600 after:scale-x-100"
        >
          Check Data
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
import { useMainStore } from './stores/store';
import { useRouter } from 'vue-router';
import { useJoystick } from './composables/useJoystick'; // Import the new composable

const { isConnected, initializeROS, initializeRosTopics } = useROS();
const mainStore = useMainStore();
const router = useRouter();
useJoystick(); // Initialize the joystick composable globally

onMounted(() => {
  const storedIp = localStorage.getItem('ip');
  const storedPort = localStorage.getItem('port');
  if (storedIp && storedPort && !mainStore.ros) {
    initializeROS(storedIp, storedPort);
  }
});

watch(() => mainStore.ros, (newRosInstance) => {
  if (newRosInstance && mainStore.isConnected) {
    initializeRosTopics(newRosInstance);
  }
});

const disconnectRos = () => {
  if (mainStore.ros) {
    mainStore.ros.close();
    router.push('/connect'); 
  }
};
</script>
