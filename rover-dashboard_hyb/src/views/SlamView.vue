<template>
  <div class="p-4 h-full">
    <div class="border-2 border-gray-300 rounded-lg p-4 h-full">
      <h1 class="text-2xl font-bold mb-4 text-black">SLAM Viewer</h1>
      <div class="h-[calc(100%-40px)]">
        <MapViewer />
      </div>
    </div>
  </div>
</template>

<script setup>
import MapViewer from '../components/MapViewer.vue';
</script>
