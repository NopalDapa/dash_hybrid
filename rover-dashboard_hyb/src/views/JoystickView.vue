<template>
  <div class="joystick-view p-4">
    <h1 class="text-2xl font-bold mb-4 text-black">Joystick Controller</h1>

    <div v-if="!isConnected" class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4" role="alert">
      <strong class="font-bold">Warning!</strong>
      <span class="block sm:inline"> Not connected to ROS. Please connect to ROS to use the joystick controller.</span>
    </div>

    <div v-else>
      <div v-if="gamepads.length === 0" class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-4" role="alert">
        <strong class="font-bold">Info!</strong>
        <span class="block sm:inline"> No gamepads detected. Please connect a joystick and press a button.</span>
      </div>

      <div v-else>
        <div v-for="(gamepad, index) in gamepads" :key="gamepad.index" class="mb-6 p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
          <h2 class="text-xl font-semibold mb-2">Gamepad {{ index + 1 }}: {{ gamepad.id }}</h2>
          <p class="text-gray-700"><strong>Index:</strong> {{ gamepad.index }}</p>
          <p class="text-gray-700"><strong>Buttons:</strong> {{ gamepad.buttons.length }}</p>
          <p class="text-gray-700"><strong>Axes:</strong> {{ gamepad.axes.length }}</p>

          <div class="mt-4">
            <h3 class="text-lg font-medium text-gray-800">Axes:</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div v-for="(axis, aIndex) in gamepad.axes" :key="aIndex" class="flex items-center">
                <span class="w-16 text-gray-600">Axis {{ aIndex }}:</span>
                <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div class="bg-blue-600 h-2.5 rounded-full" :style="{ width: ((axis + 1) / 2 * 100) + '%' }"></div>
                </div>
                <span class="ml-2 w-12 text-right text-gray-800">{{ axis.toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <div class="mt-4">
            <h3 class="text-lg font-medium text-gray-800">Buttons:</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2">
              <div v-for="(button, bIndex) in gamepad.buttons" :key="bIndex" class="flex items-center space-x-2">
                <span class="text-gray-600">Button {{ bIndex }}:</span>
                <div :class="['w-5 h-5 rounded-full', button.pressed ? 'bg-green-500' : 'bg-gray-300']"></div>
                <span class="text-gray-800">{{ button.pressed ? 'Pressed' : 'Released' }}</span>
              </div>
            </div>
          </div>

          <div class="mt-6">
            <h3 class="text-lg font-medium text-gray-800 mb-2">Visual Joysticks:</h3>
            <div class="flex flex-wrap justify-around gap-4">
              <!-- Left Joystick Visual -->
              <div v-if="gamepad.axes.length >= 2" class="relative w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center shadow-inner">
                <div class="absolute w-24 h-24 bg-gray-300 rounded-full border-2 border-gray-400"></div>
                <div
                  class="absolute w-10 h-10 bg-blue-500 rounded-full shadow-md"
                  :style="{
                    transform: `translate(${gamepad.axes[0] * 30}px, ${gamepad.axes[1] * 30}px)`
                  }"
                ></div>
                <span class="absolute -bottom-6 text-sm text-gray-600">Left Stick</span>
              </div>

              <!-- Right Joystick Visual -->
              <div v-if="gamepad.axes.length >= 4" class="relative w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center shadow-inner">
                <div class="absolute w-24 h-24 bg-gray-300 rounded-full border-2 border-gray-400"></div>
                <div
                  class="absolute w-10 h-10 bg-red-500 rounded-full shadow-md"
                  :style="{
                    transform: `translate(${gamepad.axes[2] * 30}px, ${gamepad.axes[3] * 30}px)`
                  }"
                ></div>
                <span class="absolute -bottom-6 text-sm text-gray-600">Right Stick</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useJoystick } from '../composables/useJoystick';

const { gamepads, isConnected } = useJoystick();
</script>
