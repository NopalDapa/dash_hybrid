<script setup>
import dataRobot from "../components/dataRobot.vue";
import field from "../components/Field.vue";
import Controller from "../components/Controller.vue";
</script>

<template>
  <div class="flex flex-col md:flex-row m-2 items-start gap-4">
    <field></field>
    <div class="flex flex-col md:flex-col lg:flex-col gap-4 w-full">
      <Controller />
      <dataRobot></dataRobot>
    </div>
  </div>
</template>
