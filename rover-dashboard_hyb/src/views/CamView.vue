<template>
  <div class="p-4 flex flex-col h-full">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
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
    <div class="flex flex-1">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 flex-grow">
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
        <VideoStreamCard
          cardTitle="Camera 7"
          cardId="camera7"
          :isSelected="selectedCardId === 'camera7'"
          @card-selected="handleCardSelected"
        />
        <!-- !TOBECHANGE more to go if needed -->
      </div>
      <div v-if="selectedCardId" class="w-80 ml-4 p-4 border border-gray-300 rounded-lg shadow-md">
        <StreamController :selectedCardId="selectedCardId" @close-controller="handleCloseController" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import VideoStreamCard from '../components/VideoStreamCard.vue';
import StreamController from '../components/StreamController.vue';
import { useRosboardStore } from '../stores/rosboard.js';

const selectedCardId = ref(null);
const rosboardStore = useRosboardStore();

onMounted(() => {
  rosboardStore.setDisconnectWhenIdle(false);
  if (rosboardStore.isConfigured) {
    rosboardStore.ensureConnected();
  }
});

onBeforeUnmount(() => {
  rosboardStore.setDisconnectWhenIdle(true);
  rosboardStore.disconnectIfIdle();
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
