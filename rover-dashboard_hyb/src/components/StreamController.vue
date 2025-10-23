<template>
  <div class="relative">
    <button @click="closeController" class="absolute top-0 right-0 p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
    <h3 class="text-lg font-semibold text-gray-800 mb-4">Control for {{ selectedCardId }}</h3>

    <div class="mb-4">
      <label for="fps-slider" class="block text-sm font-medium text-gray-700 mb-1">FPS:</label>
      <input
        type="range"
        id="fps-slider"
        min="1"
        max="60"
        v-model="fps"
        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        @change="updateCameraParam('fps', fps)"
      />
      <span class="text-sm text-gray-600">{{ fps }} FPS</span>
    </div>

    <div class="mb-4">
      <label for="brightness-slider" class="block text-sm font-medium text-gray-700 mb-1">Brightness:</label>
      <input
        type="range"
        id="brightness-slider"
        min="0"
        max="100"
        v-model="brightness"
        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        @change="updateCameraParam('brightness', brightness / 100.0)"
      />
      <span class="text-sm text-gray-600">{{ brightness }}%</span>
    </div>

    <div class="mb-4">
      <label for="contrast-slider" class="block text-sm font-medium text-gray-700 mb-1">Contrast:</label>
      <input
        type="range"
        id="contrast-slider"
        min="0"
        max="100"
        v-model="contrast"
        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        @change="updateCameraParam('contrast', contrast / 100.0)"
      />
      <span class="text-sm text-gray-600">{{ contrast }}%</span>
    </div>

    <div class="mb-4">
      <label for="saturation-slider" class="block text-sm font-medium text-gray-700 mb-1">Saturation:</label>
      <input
        type="range"
        id="saturation-slider"
        min="0"
        max="100"
        v-model="saturation"
        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        @change="updateCameraParam('saturation', saturation / 100.0)"
      />
      <span class="text-sm text-gray-600">{{ saturation }}%</span>
    </div>

    <div class="mb-4">
      <label for="hue-slider" class="block text-sm font-medium text-gray-700 mb-1">Hue:</label>
      <input
        type="range"
        id="hue-slider"
        min="0"
        max="100"
        v-model="hue"
        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        @change="updateCameraParam('hue', hue / 100.0)"
      />
      <span class="text-sm text-gray-600">{{ hue }}%</span>
    </div>

    <div class="mb-4">
      <label for="gain-slider" class="block text-sm font-medium text-gray-700 mb-1">Gain:</label>
      <input
        type="range"
        id="gain-slider"
        min="0"
        max="100"
        v-model="gain"
        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        @change="updateCameraParam('gain', gain / 100.0)"
      />
      <span class="text-sm text-gray-600">{{ gain }}%</span>
    </div>

    <div class="mb-4">
      <label for="exposure-slider" class="block text-sm font-medium text-gray-700 mb-1">Exposure:</label>
      <input
        type="range"
        id="exposure-slider"
        min="0"
        max="100"
        v-model="exposure"
        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        @change="updateCameraParam('exposure', exposure / 100.0)"
      />
      <span class="text-sm text-gray-600">{{ exposure }}%</span>
    </div>

    <button
      @click="applySettings"
      class="w-full !bg-indigo-600 text-white py-2 px-4 rounded-md !hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      Apply Settings
    </button>
  </div>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from 'vue';
import { useROS } from '../composables/useRos.js';

const props = defineProps({
  selectedCardId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['close-controller']);

const { ros, isConnected, setRosParameter } = useROS();

const fps = ref(30); // Default to 30 FPS
const brightness = ref(50); // Default to 50%
const contrast = ref(50);
const saturation = ref(50);
const hue = ref(50);
const gain = ref(50);
const exposure = ref(50);

// Watch for changes in selectedCardId to potentially load settings or reset
watch(() => props.selectedCardId, (newId) => {
  console.log(`Controller selected for: ${newId}`);
  // In a real application, you would fetch current settings for newId here
  // For now, we'll just reset to default or some arbitrary values
  fps.value = 30;
  brightness.value = 50;
  contrast.value = 50;
  saturation.value = 50;
  hue.value = 50;
  gain.value = 50;
  exposure.value = 50;
});

const updateCameraParam = (paramName, value) => {
  if (!isConnected.value) {
    console.error('Not connected to ROS. Cannot apply settings.');
    return;
  }
  const nodeName = 'camera_publisher_node'; // Your ROS node name
  setRosParameter(nodeName, paramName, value);
};

const applySettings = () => {
  // The settings are applied on @change event of each slider,
  // so this button can be used for a final "sync" or just as a visual cue.
  // For now, we'll just log that settings are "applied".
  console.log(`All settings for ${props.selectedCardId} are being updated via individual controls.`);
  alert(`Settings applied for ${props.selectedCardId}`);
};

const closeController = () => {
  emit('close-controller');
};
</script>
