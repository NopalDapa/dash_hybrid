import { ref, onMounted, onUnmounted, watch, readonly } from 'vue';
import { useROS } from './useRos';

const JOYSTICK_TOPIC = '/web/joystick/input';
const PUBLISH_INTERVAL_MS = 50;

export function useJoystick() {
  const { isConnected, publishFloat32MultiArray } = useROS();
  const gamepads = ref([]);
  let animationFrameId = null;
  let lastPublish = 0;

  const handleGamepadConnected = (event) => {
    console.log('Gamepad connected:', event.gamepad);
    gamepads.value = navigator.getGamepads().filter((gp) => gp !== null);
  };

  const handleGamepadDisconnected = (event) => {
    console.log('Gamepad disconnected:', event.gamepad);
    gamepads.value = navigator.getGamepads().filter((gp) => gp !== null);
  };

  const pollGamepads = (timestamp) => {
    const currentGamepads = navigator.getGamepads();
    gamepads.value = Array.from(currentGamepads).filter((gp) => gp !== null);

    if (
      isConnected.value &&
      gamepads.value.length > 0 &&
      timestamp - lastPublish >= PUBLISH_INTERVAL_MS
    ) {
      const gamepad = gamepads.value[0];
      const data = [];
      gamepad.axes.forEach((axis) => data.push(axis));
      gamepad.buttons.forEach((button) => data.push(button.pressed ? 1.0 : 0.0));
      publishFloat32MultiArray(JOYSTICK_TOPIC, data);
      lastPublish = timestamp;
    }

    animationFrameId = window.requestAnimationFrame(pollGamepads);
  };

  onMounted(() => {
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
    animationFrameId = window.requestAnimationFrame(pollGamepads);
  });

  onUnmounted(() => {
    window.removeEventListener('gamepadconnected', handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  });

  watch(isConnected, (connected) => {
    if (!connected) {
      lastPublish = 0;
    }
  });

  return {
    gamepads: readonly(gamepads),
    isConnected: readonly(isConnected),
  };
}
