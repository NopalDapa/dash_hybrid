<template>
  <div class="p-4 h-full">
    <div class="mb-4 flex flex-col md:flex-row gap-2">
      <!-- ROS Status -->
      <div class="flex-1 p-4 border rounded-lg shadow-md bg-white">
        <h2 class="text-xl text-black font-semibold mb-2">ROSboard Status</h2>
        <p class="text-xl text-black">
          Host: {{ rosboardStore.host || mainStore.server || '—' }} ||
          Port: {{ rosboardStore.port || '—' }}
        </p>
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
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Topic</th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Type</th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Message</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="[topicName, topicType] in mainStore.topics" :key="topicName">
                  <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ topicName }}</td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{{ topicType }}</td>
                  <td class="px-4 py-4 text-sm text-gray-500">
                    <div v-if="mainStore.messages.has(topicName)" class="max-h-24 overflow-y-auto bg-gray-50 p-2 rounded-md">
                      <pre class="text-xs">{{ JSON.stringify(mainStore.messages.get(topicName), null, 2) }}</pre>
                    </div>
                    <div v-else class="text-xs text-gray-400">Belum ada pesan</div>
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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useMainStore } from '../stores/store.js';
import { useRosboardStore } from '../stores/rosboard.js';
import { useROS } from '../composables/useRos.js';
import NetworkDisplay from '../components/NetworkDisplay.vue';
const mainStore = useMainStore();
const rosboardStore = useRosboardStore();
const {
  startMonitoring,
  isConnected,
  subscribeToTopic,
  unsubscribeFromTopic,
} = useROS();

const robotVelocity = ref(0.0);
const robotSteering = ref(0.0);
const subscribedTopics = ref(new Set());

const ROBOT_SPEED_TOPIC = '/master/target_speed';
const ROBOT_STEERING_TOPIC = '/master/target_steering';

const robotVelocityMessage = computed(() => mainStore.messages.get(ROBOT_SPEED_TOPIC));
const robotSteeringMessage = computed(() => mainStore.messages.get(ROBOT_STEERING_TOPIC));

watch(robotVelocityMessage, (msg) => {
  const value = msg?.data;
  if (typeof value === 'number') {
    robotVelocity.value = value;
  }
}, { immediate: true });

watch(robotSteeringMessage, (msg) => {
  const value = msg?.data;
  if (typeof value === 'number') {
    robotSteering.value = value;
  }
}, { immediate: true });

const subscribeAll = () => {
  ensureTopicSubscribed(ROBOT_SPEED_TOPIC, { maxUpdateRate: 15 });
  ensureTopicSubscribed(ROBOT_STEERING_TOPIC, { maxUpdateRate: 15 });
  mainStore.topics.forEach((type, name) => {
    if (isCameraTopic(name, type)) {
      return;
    }
    ensureTopicSubscribed(name, { maxUpdateRate: 10 });
  });
};

const unsubscribeAll = () => {
  subscribedTopics.value.forEach((topicName) => {
    unsubscribeFromTopic(topicName);
    mainStore.removeTopicMessage(topicName);
  });
  subscribedTopics.value = new Set();
};

onMounted(() => {
  startMonitoring();

  if (isConnected.value) {
    subscribeAll();
  }

  watch(isConnected, (connected) => {
    if (connected) {
      subscribeAll();
    } else {
      unsubscribeAll();
    }
  }, { immediate: true });
});

onUnmounted(() => {
  unsubscribeAll();
});

watch(
  () => mainStore.topics,
  (topicsMap) => {
    const desiredTopics = new Set(topicsMap.keys());
    desiredTopics.add(ROBOT_SPEED_TOPIC);
    desiredTopics.add(ROBOT_STEERING_TOPIC);

    desiredTopics.forEach((topicName) => {
      const topicType = topicsMap.get(topicName);
      if (isCameraTopic(topicName, topicType)) {
        return;
      }
      const options = topicName === ROBOT_SPEED_TOPIC || topicName === ROBOT_STEERING_TOPIC
        ? { maxUpdateRate: 15 }
        : { maxUpdateRate: 10 };
      ensureTopicSubscribed(topicName, options);
    });

    const next = new Set(subscribedTopics.value);
    Array.from(next).forEach((topic) => {
      if (!desiredTopics.has(topic)) {
        unsubscribeFromTopic(topic);
        next.delete(topic);
        mainStore.removeTopicMessage(topic);
      }
    });
    subscribedTopics.value = next;
  },
  { deep: true },
);

const ensureTopicSubscribed = (topicName, options = {}) => {
  const trimmed = topicName?.trim();
  if (!trimmed || subscribedTopics.value.has(trimmed)) {
    return;
  }
  subscribeToTopic(trimmed, mainStore.topics.get(trimmed), options);
  const next = new Set(subscribedTopics.value);
  next.add(trimmed);
  subscribedTopics.value = next;
};

const isCameraTopic = (topicName, topicType) => {
  const name = topicName?.toLowerCase() ?? '';
  const type = topicType?.toLowerCase() ?? '';
  return name.includes("image") || name.includes("camera") ||
    type.includes("sensor_msgs/msg/image") ||
    type.includes("sensor_msgs/msg/compressedimage") ||
    type.includes("sensor_msgs/image") ||
    type.includes("sensor_msgs/compressedimage") ||
    type.includes("theora_image_transport");
};
</script>
