import { ref, onMounted, onUnmounted, watch, readonly } from 'vue';
import ROSLIB from 'roslib';
import { useROS } from './useRos'; 

export function useJoystick() {
  const { ros, isConnected } = useROS();
  const gamepads = ref([]);
  let animationFrameId = null;
  let joystickPublisher = null;

  const initJoystickPublisher = () => {
    if (ros.value && isConnected.value && !joystickPublisher) {
      joystickPublisher = new ROSLIB.Topic({
        ros: ros.value,
        name: '/web/joystick/input',
        messageType: 'std_msgs/Float32MultiArray'
      });
      console.log('Joystick publisher initialized globally.');
    } else if (!isConnected.value && joystickPublisher) {
      // If disconnected, clear the publisher
      joystickPublisher = null;
      console.log('Joystick publisher cleared globally due to disconnection.');
    }
  };

  watch(isConnected, (newVal) => {
    if (newVal) {
      initJoystickPublisher();
    } else {
      joystickPublisher = null; // Clear publisher on disconnect
    }
  });

  onMounted(() => {
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);
    initJoystickPublisher(); 
    pollGamepads();
  });

  onUnmounted(() => {
    window.removeEventListener('gamepadconnected', handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    joystickPublisher = null; 
  });

  function handleGamepadConnected(event) {
    console.log('Joystick connected globally:', event.gamepad);
    gamepads.value = navigator.getGamepads().filter(gp => gp !== null);
  }

  function handleGamepadDisconnected(event) {
    console.log('Joystick disconnected globally:', event.gamepad);
    gamepads.value = navigator.getGamepads().filter(gp => gp !== null);
  }

  function pollGamepads() {
    const currentGamepads = navigator.getGamepads();
    gamepads.value = Array.from(currentGamepads).filter(gp => gp !== null);

    if (isConnected.value && joystickPublisher && gamepads.value.length > 0) {
      gamepads.value.forEach(gamepad => {
        const data = [];
        gamepad.axes.forEach(axis => data.push(axis));
        gamepad.buttons.forEach(button => data.push(button.pressed ? 1.0 : 0.0));

        const message = new ROSLIB.Message({
          data: data
        });
        joystickPublisher.publish(message);
      });
    }

    animationFrameId = requestAnimationFrame(pollGamepads);
  }

  return {
    gamepads: readonly(gamepads),
    isConnected: readonly(isConnected) 
  };
}
