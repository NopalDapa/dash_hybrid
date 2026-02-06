<template>
  <div
    :class="['border', 'rounded-lg', 'shadow-md', 'p-2', 'flex', 'flex-col', 'h-full', 'min-h-0', 'overflow-hidden', 'cursor-pointer', { 'border-indigo-500 ring-2 ring-indigo-500': isSelected, 'border-gray-300': !isSelected }]"
    @click="selectCard"
  >
    <div v-if="!isZoomed" class="flex justify-between items-center mb-1">
      <h2 class="text-sm font-semibold text-gray-800">{{ cardTitle }}</h2>
      <button @click.stop="toggleInputForm" class="p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <svg v-if="showInputForm" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div v-if="showInputForm && !isZoomed" class="mb-1" @click.stop>
      <label :for="`video-topic-input-${_uid}`" class="block text-xs font-medium text-gray-700 mb-0.5">Topic:</label>
      <input
        type="text"
        :id="`video-topic-input-${_uid}`"
        v-model="currentTopic"
        placeholder="/camera/image_raw"
        class="block text-black w-full px-2 py-1 text-xs border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
      />
    </div>

    <!-- Video Container Wrapper -->
    <div class="flex-grow relative rounded-md overflow-hidden flex items-center justify-center min-h-0 min-w-0">
        <!-- Square wrapper: max-w-full & max-h-full keeps it inside the cell, aspect-square forces 1:1 -->
        <div :class="[isZoomed ? 'w-full h-full' : 'aspect-square max-w-full max-h-full', 'overflow-hidden rounded-md bg-gray-50']">
            <img
                v-if="displayMode === 'image' && frameSrc"
                :src="frameSrc"
                :alt="cardTitle + ' Video Stream'"
                :class="['block w-full h-full', isZoomed ? 'object-contain' : 'object-fill']"
            />
            <div v-else class="w-full h-full flex items-center justify-center p-2 text-gray-400 text-center text-xs">
                {{ statusMessage }}
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, getCurrentInstance, watch, watchEffect, onBeforeUnmount } from 'vue';
import { useMainStore } from '../stores/store.js';
import { useRosboardStore } from '../stores/rosboard.js';

const props = defineProps({
  cardTitle: {
    type: String,
    required: true,
  },
  cardId: {
    type: String,
    required: true,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
  isZoomed: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['card-selected']);

const mainStore = useMainStore();
const rosboardStore = useRosboardStore();
const { uid: _uid } = getCurrentInstance(); // For unique IDs in template

const currentTopic = computed({
  get() {
    return mainStore.cameraTopics[props.cardId] ?? '';
  },
  set(value) {
    mainStore.setCameraTopic(props.cardId, value?.trim() ?? '');
  },
});

const showInputForm = ref(true);
const frameSrc = ref(null);
const frameError = ref(null);
const displayMode = ref('idle');

const toggleInputForm = () => {
  showInputForm.value = !showInputForm.value;
};

const selectCard = () => {
  if (props.isZoomed) return; // Don't re-trigger when already zoomed
  emit('card-selected', props.cardId);
};

const latestMessage = computed(() => {
  const topic = currentTopic.value;
  if (!topic) {
    return null;
  }
  return rosboardStore.latestMessages[topic] ?? null;
});

watch(
  () => currentTopic.value,
  (newTopic, oldTopic) => {
    if (oldTopic) {
      rosboardStore.unsubscribe(oldTopic);
    }
    if (newTopic) {
      rosboardStore.subscribe(newTopic, { maxUpdateRate: 30 });
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  const topic = currentTopic.value;
  if (topic) {
    rosboardStore.unsubscribe(topic);
  }
});

watchEffect(() => {
  frameError.value = null;
  frameSrc.value = null;
  displayMode.value = 'idle';

  const topic = currentTopic.value;
  if (!topic) {
    return;
  }

  const message = latestMessage.value;
  if (!message) {
    if (rosboardStore.status === 'error' && rosboardStore.lastError) {
      frameError.value = rosboardStore.lastError;
      displayMode.value = 'error';
    } else if (rosboardStore.status === 'disconnected') {
      displayMode.value = 'disconnected';
    } else {
      displayMode.value = rosboardStore.isConnected ? 'waiting' : 'connecting';
    }
    return;
  }

  if (message._error) {
    frameError.value = message._error;
    displayMode.value = 'error';
    return;
  }

  const type = rosboardStore.topics?.[topic] ?? message._topic_type ?? '';
  if (type.includes('Image') && typeof message._data_jpeg === 'string' && message._data_jpeg.length > 0) {
    frameSrc.value = `data:image/jpeg;base64,${message._data_jpeg}`;
    displayMode.value = 'image';
    return;
  }

  frameError.value = `Topic ${topic} bertipe ${type || 'tidak diketahui'} belum didukung untuk streaming.`;
  displayMode.value = 'error';
});

const statusMessage = computed(() => {
  if (frameError.value) {
    return frameError.value;
  }
  if (displayMode.value === 'idle') {
    return 'Silakan isi topic kamera terlebih dahulu.';
  }
  if (displayMode.value === 'connecting') {
    return 'Menghubungkan ke ROSboard...';
  }
  if (displayMode.value === 'waiting') {
    return 'Menunggu frame pertama dari ROSboard...';
  }
  if (displayMode.value === 'disconnected') {
    return 'Belum terhubung ke ROSboard.';
  }
  return 'Tidak ada video stream.';
});
</script>