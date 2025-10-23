<template>
  <div class="flex items-center space-x-2">
    <span class="text-gray-400">Ping:</span>
    <span :class="pingClass">
      {{ typeof ping === 'number' ? `${ping}ms` : ping }}
    </span>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useMainStore } from '../stores/store';
// import { invoke } from '@tauri-apps/api/tauri'; // Import invoke 

const mainStore = useMainStore();
const ping = ref('N/A');
const BAD_PING_THRESHOLD = 150; // Threshold for a "bad" ping in ms
let intervalId;

const pingClass = computed(() => {
  if (typeof ping.value !== 'number') {
    return 'text-red-500'; 
  }
  return ping.value > BAD_PING_THRESHOLD ? 'text-yellow-500' : 'text-green-500'; 
});

// HTTP request timing
const webPing = async (host) => {
  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); 
    
    await fetch(`http://${host}:9090`, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const endTime = performance.now();
    return Math.round(endTime - startTime);
  } catch (error) {
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    
    if (responseTime < 1000 && error.name !== 'AbortError') {
      return responseTime;
    }
    throw error;
  }
};

onMounted(() => {
  intervalId = setInterval(async () => {
    if (mainStore.server) {
      try {
        // TAURI VERSION 
        // const result = await invoke('ping_ip', { host: mainStore.server, timeout: 1000 });
        // ping.value = result;
        
        // WEB VERSION
        const result = await webPing(mainStore.server);
        ping.value = result;
      } catch (error) {
        console.error('Ping failed:', error);
        ping.value = 'Timeout';
      }
    } else {
      ping.value = 'N/A';
    }
  }, 2000);
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});
</script>
