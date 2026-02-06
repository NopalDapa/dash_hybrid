<template>
  <div class="p-2 flex flex-col h-full">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
      <div>
        <p class="text-sm text-gray-700">
          Status ROSboard:
          <span :class="['font-medium', statusClass]">{{ statusLabel }}</span>
          <span v-if="rosboardStore.url" class="text-xs text-gray-500 ml-2">({{ rosboardStore.url }})</span>
        </p>
        <p class="text-xs text-gray-500">
          Topik aktif: {{ rosboardStore.activeTopicCount }}
        </p>
        <p v-if="rosboardStore.lastError" class="text-xs text-red-600 mt-1">
          {{ rosboardStore.lastError }}
        </p>
      </div>
      <button
        type="button"
        class="px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
        :disabled="!rosboardStore.isConfigured"
        @click="handleReconnect"
      >
        Reconnect
      </button>
    </div>
    
    <!-- Main Grid Layout -->
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <div class="grid grid-cols-3 grid-rows-2 gap-1 w-full h-full">
        <VideoStreamCard
          cardTitle="Camera 1"
          cardId="camera1"
          :isSelected="selectedCardId === 'camera1'"
          @card-selected="handleCardSelected"
        />
        <VideoStreamCard
          cardTitle="Camera 2"
          cardId="camera2"
          :isSelected="selectedCardId === 'camera2'"
          @card-selected="handleCardSelected"
        />
        <VideoStreamCard
          cardTitle="Camera 3"
          cardId="camera3"
          :isSelected="selectedCardId === 'camera3'"
          @card-selected="handleCardSelected"
        />
        <VideoStreamCard
          cardTitle="Camera 4"
          cardId="camera4"
          :isSelected="selectedCardId === 'camera4'"
          @card-selected="handleCardSelected"
        />
        <VideoStreamCard
          cardTitle="Camera 5"
          cardId="camera5"
          :isSelected="selectedCardId === 'camera5'"
          @card-selected="handleCardSelected"
        />
        <VideoStreamCard
          cardTitle="Camera 6"
          cardId="camera6"
          :isSelected="selectedCardId === 'camera6'"
          @card-selected="handleCardSelected"
        />
      </div>
    </div>

    <!-- Zoom Overlay -->
    <div v-if="zoomedCardId" @click.self="closeZoom" class="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center">
      <!-- Close Button - on top of everything -->
      <button 
        @click="closeZoom" 
        class="fixed top-6 right-6 z-[100] w-16 h-16 flex items-center justify-center bg-black hover:bg-gray-800 text-white text-4xl font-black rounded-full shadow-2xl focus:outline-none border-2 border-white"
      >
        X
      </button>
      <div @click.self="closeZoom" class="relative w-full h-full flex flex-col bg-white overflow-hidden">
        <div @click.self="closeZoom" class="flex-grow w-full h-full">
          <VideoStreamCard
            :cardTitle="zoomedCardId"
            :cardId="zoomedCardId"
            :isSelected="false"
            :isZoomed="true"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import VideoStreamCard from '../components/VideoStreamCard.vue';
import StreamController from '../components/StreamController.vue';
import { useRosboardStore } from '../stores/rosboard.js';

const selectedCardId = ref(null);
const zoomedCardId = ref(null);
const rosboardStore = useRosboardStore();

onMounted(() => {
  rosboardStore.setDisconnectWhenIdle(false);
  if (rosboardStore.isConfigured) {
    rosboardStore.ensureConnected();
  }
});

const statusLabel = computed(() => {
  if (!rosboardStore.isConfigured) {
    return 'Belum dikonfigurasi';
  }
  if (rosboardStore.status === 'connected') {
    return 'Terhubung';
  }
  if (rosboardStore.status === 'connecting') {
    return 'Menghubungkan...';
  }
  if (rosboardStore.status === 'error') {
    return 'Gagal terhubung';
  }
  return 'Terputus';
});

const statusClass = computed(() => {
  if (!rosboardStore.isConfigured) {
    return 'text-gray-500';
  }
  if (rosboardStore.status === 'connected') {
    return 'text-green-600';
  }
  if (rosboardStore.status === 'error') {
    return 'text-red-600';
  }
  if (rosboardStore.status === 'connecting') {
    return 'text-yellow-600';
  }
  return 'text-gray-600';
});

const handleCardSelected = (cardId) => {
  selectedCardId.value = cardId;
  zoomedCardId.value = cardId; // Auto zoom when clicked
};

const closeZoom = () => {
  zoomedCardId.value = null;
};

const handleCloseController = () => {
  selectedCardId.value = null;
};

const handleReconnect = () => {
  if (!rosboardStore.isConfigured) {
    return;
  }
  rosboardStore.connect();
};
</script>