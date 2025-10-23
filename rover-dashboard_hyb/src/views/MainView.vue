<template>
  <div class="p-4 h-full">
    <div class="mb-4 flex flex-col md:flex-row gap-2">
      <!-- ROS Status -->
      <div class="flex-1 p-4 border rounded-lg shadow-md bg-white">
        <h2 class="text-xl text-black font-semibold mb-2">ROS Status</h2>
        <p class="text-xl text-black">IP: {{ mainStore.server }} || PORT: 9090</p>
        <p class="text-xl" :class="{ 'text-green-600': mainStore.status === 'Connected', 'text-red-600': mainStore.status === 'Disconnected', 'text-gray-600': mainStore.status === null }">
          Status: {{ mainStore.status || 'Not Connected' }} - {{ mainStore.message }}
        </p>
        <div class="mt-2">
          <NetworkDisplay />
        </div>
      </div>
      <!-- Robot Info -->
      <div class="flex-1 p-4 border rounded-lg shadow-md bg-white" id="robot-info-box">
        <h2 class="text-xl text-black font-semibold mb-2">Robot Info</h2>
        <div class="space-y-2">
          <p class="text-black"><strong>Velocity:</strong> <span id="info-velocity">{{ robotVelocity.toFixed(2) }}</span> m/s</p>
          <p class="text-black"><strong>Steering:</strong> <span id="info-steering">{{ robotSteering.toFixed(2) }}</span> rad</p>
          <p class="text-black"><strong>Lookahead:</strong> <span id="info-lookahead">0.0</span> m</p>
        </div>
      </div>
    </div>


    <div class="flex flex-col md:flex-row gap-1 mt-2 h-[calc(100%-120px-theme('height.96'))]"></div>
    <div class="flex flex-col md:flex-row gap-1 mt-2 h-[calc(100%-120px-theme('height.96'))]">
      <div class="md:w-1/5 flex flex-col gap-2">
        <div class="p-4 border rounded-lg shadow-md bg-white flex-grow">
          <h2 class="text-xl text-black font-semibold mb-4">ROS Nodes ({{ mainStore.nodes.length }})</h2>
          <ul class="list-disc pl-5 text-gray-700 max-h-64 overflow-y-auto">
            <li v-for="node in mainStore.nodes" :key="node" class="mb-1">{{ node }}</li>
          </ul>
        </div>
      </div>

      <div class="md:w-4/5 flex flex-col gap-2">
        <div class="p-4 border rounded-lg shadow-md bg-white flex-grow">
          <h2 class="text-xl text-black font-semibold mb-4">ROS Topics ({{ mainStore.topics.size }})</h2>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-800">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Topic</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Type</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Message</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="[topicName, topicType] in mainStore.topics" :key="topicName">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ topicName }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ topicType }}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">
                    <div v-if="mainStore.messages.has(topicName)" class="max-h-20 overflow-y-auto bg-gray-50 p-2 rounded-md">
                      <pre class="text-xs">{{ JSON.stringify(mainStore.messages.get(topicName), null, 2) }}</pre>
                    </div>
                    <div v-else>No message yet</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useMainStore } from '../stores/store.js';
import { useROS } from '../composables/useRos.js';
import NetworkDisplay from '../components/NetworkDisplay.vue';
const mainStore = useMainStore();
const {
  initializeROS,
  startMonitoring,
} = useROS();

const robotVelocity = ref(0.0);
const robotSteering = ref(0.0);

// setup subscribers 
const setupRosSubscribers = () => {
  if (!mainStore.isConnected || !mainStore.robotVelInfoSubscriber || !mainStore.robotSteeringSubscriber) {
    return;
  }
  mainStore.robotVelInfoSubscriber.subscribe(msg => {
    robotVelocity.value = msg.data;
  });
  mainStore.robotSteeringSubscriber.subscribe(msg => {
    robotSteering.value = msg.data;
  });
};

const cleanupRosSubscribers = () => {
  if (mainStore.robotVelInfoSubscriber) mainStore.robotVelInfoSubscriber.unsubscribe();
  if (mainStore.robotSteeringSubscriber) mainStore.robotSteeringSubscriber.unsubscribe();
};

onMounted(() => {
  // use default localhost if no server is set
  if (!mainStore.server) {
    initializeROS('127.0.0.1', 9090);
  }

  startMonitoring();

  // setup subscriber listener
  if (mainStore.isConnected) {
    setupRosSubscribers();
  }
  watch(() => mainStore.isConnected, (val) => {
    if (val) {
      setupRosSubscribers();
    } else {
      cleanupRosSubscribers();
    }
  }, { immediate: true });
});


onUnmounted(() => {
  cleanupRosSubscribers();
});

// This function renders a nested list recursively for messages
// Using JSON.stringify for now for simplicity in display
const renderMessage = (data) => {
  return data; 
};
</script>
