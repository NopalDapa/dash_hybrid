<template>
  <div class="p-4 bg-gray-100 min-h-screen">

    <div class="container mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">

        <div class="md:col-span-1">
          <div class="bg-white shadow-md rounded-lg p-6" id="robot-info-box">
            <h2 class="text-xl text-black font-semibold mb-4">Robot Info</h2>
            <div class="space-y-2">
              <p class="text-black"><strong>Velocity:</strong> <span id="info-velocity">{{ robotVelocity.toFixed(2) }}</span> m/s</p>
              <p class="text-black"><strong>Steering:</strong> <span id="info-steering">{{ robotSteering.toFixed(2) }}</span> rad</p>
              <p class="text-black"><strong>Lookahead:</strong> <span id="info-lookahead">0.0</span> m</p>
            </div>
          </div>
        </div>

        <div class="md:col-span-4">
          <div class="bg-white shadow-md rounded-lg p-6" id="config-panel">
            <h2 class="text-xl font-semibold text-blue-600 mb-4">Configuration Panel</h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-for="(name, index) in configurationNames" :key="index" class="flex flex-col">
                <label class="block text-gray-700 text-sm font-bold mb-2" :for="`config-${index + 1}`">{{ name }}</label>
                <input :id="`config-${index + 1}`" v-model.number="configurations[index]"
                  class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                  type="number" min="-100" />
              </div>
            </div>

            <div class="flex space-x-2 mt-6">
              <button @click="onSaveConfiguration" class="px-4 py-2 !bg-green-500 text-white rounded-md !hover:bg-green-600">Apply</button>
              <button @click="onResetConfig" class="px-4 py-2 !bg-yellow-500 text-white rounded-md !hover:bg-yellow-600">Reset</button>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useMainStore } from '../stores/store';
import { useROS } from '../composables/useRos';

const mainStore = useMainStore();
const { isConnected, publishTestValue, subscribeToTopic, unsubscribeFromTopic } = useROS(); 

const robotVelocity = ref(0.0);
const robotSteering = ref(0.0);
const configurationNames = [
  // nama params
  "k_p_wheel",
  "k_i_wheel", 
  "k_d_wheel", 
  "k_d_steering", 
  "wheel_radius",
  "encoder_ppr", 
  "cnt_to_meter", 
  "max_steering_deg", 
  "min_steering_deg",
  "max_steering_pwm",
   "min_steering_pwm", 
   "mid_steering_pwm",
  "max_wheel_velocity_pwm", 
  "min_wheel_velocity_pwm", 
  "max_wheel_integral_pwm",
  "min_wheel_integral_pwm", 
  "wheel_base", 
  "tuning", 
  "K_model",
  "test"
];

const configurations = ref(Array(configurationNames.length).fill(0));
const canPublishTestValue = computed(() => mainStore.status === 'Connected');
const testTopicName = '/test';
const testTopicType = 'std_msgs/msg/Int32';
const testTopicIndex = configurationNames.indexOf('test');
let lastPublishedTestValue = null;

const currentTestMessage = computed(() => {
  const message = mainStore.messages.get(testTopicName);
  if (!message) return null;
  if (typeof message === 'number') return message;
  if (typeof message.data === 'number') return message.data;
  if (message.data && typeof message.data.data === 'number') return message.data.data;
  return null;
});

watch(currentTestMessage, (val) => {
  if (typeof val === 'number' && testTopicIndex !== -1) {
    lastPublishedTestValue = val;
    if (configurations.value[testTopicIndex] !== val) {
      configurations.value[testTopicIndex] = val;
    }
  }
}, { immediate: true });

if (testTopicIndex !== -1) {
  watch(() => configurations.value[testTopicIndex], (val) => {
    if (!Number.isFinite(val)) {
      return;
    }
    if (!canPublishTestValue.value) {
      return;
    }
    if (val === lastPublishedTestValue) {
      return;
    }
    publishTestValue(val);
    lastPublishedTestValue = val;
  });
}

const ensureTestTopicSubscription = () => {
  if (!mainStore.isConnected) {
    return;
  }
  subscribeToTopic(testTopicName, testTopicType);
  if (testTopicIndex !== -1) {
    const currentValue = configurations.value[testTopicIndex];
    if (Number.isFinite(currentValue)) {
      publishTestValue(currentValue);
      lastPublishedTestValue = currentValue;
    }
  }
};

// Functions for ROS communication
const setupRosSubscribers = () => {
  if (!mainStore.isConnected || !mainStore.configListener) {
    console.warn("ROS not connected or listeners not initialized.");
    return;
  }

  mainStore.configListener.subscribe(msg => {
    const received = msg.data.slice(0, configurationNames.length);
    while (received.length < configurationNames.length) {
      received.push(0);
    }

    if (testTopicIndex !== -1) {
      const incomingTestValue = received[testTopicIndex];
      if (Number.isFinite(incomingTestValue)) {
        lastPublishedTestValue = incomingTestValue;
      }
    }

    configurations.value = received;
    console.log("Received configuration from ROS:", msg.data);
  });

  mainStore.robotVelInfoSubscriber.subscribe(msg => {
    robotVelocity.value = msg.data;
  });

  mainStore.robotSteeringSubscriber.subscribe(msg => {
    robotSteering.value = msg.data;
  });
};

const cleanupRosSubscribers = () => {
  if (mainStore.configListener) mainStore.configListener.unsubscribe();
  if (mainStore.robotVelSubscriber) mainStore.robotVelSubscriber.unsubscribe();
  if (mainStore.robotSteeringSubscriber) mainStore.robotSteeringSubscriber.unsubscribe();
  if (mainStore.robotVelInfoSubscriber) mainStore.robotVelInfoSubscriber.unsubscribe();
};


const onSaveConfiguration = () => {
  if (mainStore.topicConfiguration) {
    mainStore.topicConfiguration.publish({ data: configurations.value });
    console.log("Published configuration:", configurations.value);
  } else {
    console.warn("Configuration topic not initialized.");
  }
};

const onResetConfig = () => {
  configurations.value = Array(configurationNames.length).fill(0);
  if (mainStore.topicConfiguration) {
    mainStore.topicConfiguration.publish({ data: configurations.value });
    console.log("Reset configuration to zeros");
  } else {
    console.warn("Configuration topic not initialized.");
  }
};

// Keyboard controls for velocity and steering
let uiTargetVelocity = 0;
let uiTargetSteering = 0;

const handleKeyDown = (event) => {
  if (!mainStore.topicVelocityAndSteering) {
    console.warn("Velocity and Steering topic not initialized.");
    return;
  }

  switch (event.key) {
    case 'w': uiTargetVelocity += 0.1; break;
    case 's': uiTargetVelocity -= 0.1; break;
    case 'j': uiTargetVelocity = 2.0; break;
    case 'g': uiTargetVelocity = -1.0; break;
    case 'm': uiTargetSteering -= 0.1; break;
    case 'n': uiTargetSteering = 0.0; break;
    case 'b': uiTargetSteering += 0.1; break;
    case ' ':
      uiTargetVelocity = 0.0;
      uiTargetSteering = 0.0;
      break;
    case 'Enter':
      onSaveConfiguration();
      return; // Don't publish velocity/steering for Enter
  }
  mainStore.topicVelocityAndSteering.publish({ data: [uiTargetVelocity, uiTargetSteering] });
};

// Lifecycle hooks
onMounted(() => {
  // Add keyboard listener
  window.addEventListener('keydown', handleKeyDown);

  // Watch for ROS connection status
  watch(isConnected, (newVal) => {
    if (newVal) {
      setupRosSubscribers();
      ensureTestTopicSubscription();
    } else {
      cleanupRosSubscribers();
      unsubscribeFromTopic(testTopicName);
      lastPublishedTestValue = null;
    }
  }, { immediate: true }); // Run immediately to check initial connection
});

onUnmounted(() => {
  cleanupRosSubscribers();
  window.removeEventListener('keydown', handleKeyDown);
  unsubscribeFromTopic(testTopicName);
});
</script>
