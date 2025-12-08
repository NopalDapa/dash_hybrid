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

const CONFIG_FEEDBACK_TOPIC = '/web/config/configuration_init';
const CONFIG_COMMAND_TOPIC = '/web/config/configuration';
const CONFIG_REQUEST_TOPIC = '/web/config/request_config';
const VELOCITY_COMMAND_TOPIC = '/master/ui_target_velocity_and_steering';
const ROBOT_SPEED_TOPIC = '/master/target_speed';
const ROBOT_STEERING_TOPIC = '/master/target_steering';
const TEST_TOPIC = '/test';

const mainStore = useMainStore();
const {
  isConnected,
  subscribeToTopic,
  unsubscribeFromTopic,
  publishFloat32MultiArray,
  publishTestValue,
  publishInt16,
} = useROS();

const robotVelocity = ref(0.0);
const robotSteering = ref(0.0);

const configurationNames = [
  'k_p_wheel',
  'k_i_wheel',
  'k_d_wheel',
  'k_d_steering',
  'wheel_radius',
  'encoder_ppr',
  'cnt_to_meter',
  'max_steering_deg',
  'min_steering_deg',
  'max_steering_pwm',
  'min_steering_pwm',
  'mid_steering_pwm',
  'max_wheel_velocity_pwm',
  'min_wheel_velocity_pwm',
  'max_wheel_integral_pwm',
  'min_wheel_integral_pwm',
  'wheel_base',
  'tuning',
  'K_model',
  'test',
];

const configurations = ref(Array(configurationNames.length).fill(0));
const testTopicIndex = configurationNames.indexOf('test');
let lastPublishedTestValue = null;

const configurationMessage = computed(() => mainStore.messages.get(CONFIG_FEEDBACK_TOPIC));
const robotVelocityMessage = computed(() => mainStore.messages.get(ROBOT_SPEED_TOPIC));
const robotSteeringMessage = computed(() => mainStore.messages.get(ROBOT_STEERING_TOPIC));
const testMessage = computed(() => mainStore.messages.get(TEST_TOPIC));

watch(configurationMessage, (msg) => {
  if (!msg || !Array.isArray(msg.data)) {
    return;
  }
  const received = msg.data.slice(0, configurationNames.length);
  while (received.length < configurationNames.length) {
    received.push(0);
  }
  configurations.value = received;

  if (testTopicIndex !== -1) {
    const incomingTestValue = received[testTopicIndex];
    if (Number.isFinite(incomingTestValue)) {
      lastPublishedTestValue = incomingTestValue;
    }
  }
}, { immediate: true });

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

watch(testMessage, (msg) => {
  const value = typeof msg?.data === 'number' ? msg.data : undefined;
  if (typeof value === 'number' && testTopicIndex !== -1) {
    if (configurations.value[testTopicIndex] !== value) {
      configurations.value[testTopicIndex] = value;
    }
    lastPublishedTestValue = value;
  }
}, { immediate: true });

if (testTopicIndex !== -1) {
  watch(
    () => configurations.value[testTopicIndex],
    (val) => {
      if (!Number.isFinite(val)) {
        return;
      }
      if (!isConnected.value) {
        return;
      }
      if (val === lastPublishedTestValue) {
        return;
      }
      publishTestValue(val);
      lastPublishedTestValue = val;
    },
  );
}

const subscribeAll = () => {
  subscribeToTopic(CONFIG_FEEDBACK_TOPIC, undefined, { maxUpdateRate: 5 });
  subscribeToTopic(ROBOT_SPEED_TOPIC, undefined, { maxUpdateRate: 20 });
  subscribeToTopic(ROBOT_STEERING_TOPIC, undefined, { maxUpdateRate: 20 });
  subscribeToTopic(TEST_TOPIC, undefined, { maxUpdateRate: 5 });
  publishInt16(CONFIG_REQUEST_TOPIC, 0);
};

const unsubscribeAll = () => {
  unsubscribeFromTopic(CONFIG_FEEDBACK_TOPIC);
  unsubscribeFromTopic(ROBOT_SPEED_TOPIC);
  unsubscribeFromTopic(ROBOT_STEERING_TOPIC);
  unsubscribeFromTopic(TEST_TOPIC);
};

const onSaveConfiguration = () => {
  publishFloat32MultiArray(CONFIG_COMMAND_TOPIC, configurations.value);
};

const onResetConfig = () => {
  configurations.value = Array(configurationNames.length).fill(0);
  publishFloat32MultiArray(CONFIG_COMMAND_TOPIC, configurations.value);
};

let uiTargetVelocity = 0;
let uiTargetSteering = 0;

const publishVelocityCommand = () => {
  publishFloat32MultiArray(VELOCITY_COMMAND_TOPIC, [uiTargetVelocity, uiTargetSteering]);
};

const handleKeyDown = (event) => {
  switch (event.key) {
    case 'w':
      uiTargetVelocity += 0.1;
      break;
    case 's':
      uiTargetVelocity -= 0.1;
      break;
    case 'j':
      uiTargetVelocity = 2.0;
      break;
    case 'g':
      uiTargetVelocity = -1.0;
      break;
    case 'm':
      uiTargetSteering -= 0.1;
      break;
    case 'n':
      uiTargetSteering = 0.0;
      break;
    case 'b':
      uiTargetSteering += 0.1;
      break;
    case ' ':
      uiTargetVelocity = 0.0;
      uiTargetSteering = 0.0;
      break;
    case 'Enter':
      onSaveConfiguration();
      return;
    default:
      return;
  }
  publishVelocityCommand();
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);

  watch(
    isConnected,
    (connected) => {
      if (connected) {
        subscribeAll();
      } else {
        unsubscribeAll();
        lastPublishedTestValue = null;
      }
    },
    { immediate: true },
  );
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  unsubscribeAll();
});
</script>
