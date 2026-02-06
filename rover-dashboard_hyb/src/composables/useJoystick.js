import { ref, onMounted, onUnmounted, watch, readonly } from 'vue';
import { useROS } from './useRos';
import { useModeSwitchStore } from '../stores/modeSwitch';

const JOYSTICK_TOPIC = '/web/joystick/input';
const MODE_SWITCH_TOPIC = '/mode_switch';
const PUBLISH_INTERVAL_MS = 50;

// Common mapping for Xbox-like controllers:
// buttons[2] typically maps to X.
const BUTTON_X_INDEX = 2;

export function useJoystick() {
  const { isConnected, publishFloat32MultiArray, publishModeSwitch } = useROS();
  const modeStore = useModeSwitchStore();
  const gamepads = ref([]);
  let animationFrameId = null;
  let lastPublish = 0;

  let lastXPressed = false;
  let currentMode = 'wheel';
  let bootstrapSpamActive = true;

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

      // Toggle mode on rising-edge of X button
      const xPressed = Boolean(gamepad.buttons?.[BUTTON_X_INDEX]?.pressed);
      if (xPressed && !lastXPressed) {
        currentMode = currentMode === 'wheel' ? 'arm' : 'wheel';
        publishModeSwitch(MODE_SWITCH_TOPIC, true, currentMode);
  modeStore.setMode(true, currentMode);

        // Once the user has explicitly switched to arm at least once,
        // stop spamming defaults and only publish on toggles.
        if (currentMode === 'arm') {
          bootstrapSpamActive = false;
        }
      }
      lastXPressed = xPressed;

      // Bootstrap behavior: keep publishing wheel until the user toggles to arm once.
      // This helps downstream consumers latch an initial state even when they connect late.
      if (bootstrapSpamActive && currentMode === 'wheel') {
        publishModeSwitch(MODE_SWITCH_TOPIC, true, 'wheel');
  modeStore.setMode(true, 'wheel');
      }

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
  lastXPressed = false;
      currentMode = 'wheel';
  bootstrapSpamActive = true;
  modeStore.reset();
      return;
    }
  });

  return {
    gamepads: readonly(gamepads),
    isConnected: readonly(isConnected),
  };
}
