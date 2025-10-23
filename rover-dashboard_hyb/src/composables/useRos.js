import { ref, readonly, computed, watch } from 'vue'; // Added ref and watch
import ROSLIB from 'roslib';
import { useMainStore } from '../stores/store';

let monitorInterval = null;
let watchersInitialized = false;

const initGlobalWatchers = (mainStore, subscribeToTopic, unsubscribeFromTopic, startMonitoring, stopMonitoring) => {
  if (watchersInitialized) {
    return;
  }

  watch(
    () => mainStore.topics,
    (newTopics, oldTopics) => {
      if (!(newTopics instanceof Map)) {
        return;
      }
      const previous = oldTopics instanceof Map ? oldTopics : new Map();

      newTopics.forEach((type, name) => {
        if (!previous.has(name)) {
          subscribeToTopic(name, type);
        }
      });

      previous.forEach((type, name) => {
        if (!newTopics.has(name)) {
          unsubscribeFromTopic(name);
        }
      });
    },
    { deep: true },
  );

  watch(
    () => mainStore.status,
    (status) => {
      if (status === 'Connected') {
        startMonitoring();
      } else if (status === 'Disconnected' || status === null) {
        stopMonitoring();
      }
    },
    { immediate: true },
  );

  watchersInitialized = true;
};

export function useROS() {
  const mainStore = useMainStore();
  const rosRef = ref(null); // Local ref for ROS instance

  // Watch for changes in mainStore.ros and update rosRef
  watch(() => mainStore.ros, (newRos) => {
    rosRef.value = newRos;
  }, { immediate: true });

  function initializeROS(ip, port) {
    const url = `ws://${ip}:${port}`;
    console.log(`Attempting to connect to ROS at: ${url}`);
    mainStore.setLoading(true);
    mainStore.setServer(ip);
    mainStore.setStatus(null); // Reset status on new connection attempt

    const rosConnection = new ROSLIB.Ros({ url });

    mainStore.setRos(rosConnection);
    console.log('ROS instance set in store:', mainStore.ros);

    rosConnection.on('connection', () => {
      mainStore.setMessage(`Connected to ROS master: ${url}`);
      mainStore.setLoading(false);
      mainStore.setStatus('Connected');
      console.log('ROS connection successful. isConnected:', mainStore.isConnected);
      initializeRosTopics(rosConnection);
    });

    rosConnection.on('error', (error) => {
      mainStore.setMessage(`Error connecting to ROS: ${url} - ${error.message || error}`);
      mainStore.setLoading(false);
      mainStore.setStatus('Disconnected');
      console.error('ROS connection error:', error);
      console.log('ROS connection failed. isConnected:', mainStore.isConnected);
    });

    rosConnection.on('close', () => {
      console.log('ROS connection closed');
      mainStore.setMessage(`Closed connection to ROS master: ${url}`);
      mainStore.setLoading(false);
      mainStore.clearAllRosData();
      console.log('ROS connection closed. isConnected:', mainStore.isConnected);
    });
  }

  function initializeRosTopics(rosInstance) {
    if (!rosInstance) {
      console.warn("ROS instance not provided for topic initialization.");
      return;
    }

    // Publishers
    const topicConfiguration = new ROSLIB.Topic({
      ros: rosInstance,
      name: '/web/config/configuration',
      messageType: 'std_msgs/Float32MultiArray'
    });
    mainStore.setTopicConfiguration(topicConfiguration);

    const topicVelocityAndSteering = new ROSLIB.Topic({
      ros: rosInstance,
      name: '/master/ui_target_velocity_and_steering',
      messageType: 'std_msgs/Float32MultiArray'
    });
    mainStore.setTopicVelocityAndSteering(topicVelocityAndSteering);


    // Subscribers
    const configListener = new ROSLIB.Topic({
      ros: rosInstance,
      name: '/web/config/configuration_init',
      messageType: 'std_msgs/Float32MultiArray'
    });
    mainStore.setConfigListener(configListener);

    const robotVelSubscriber = new ROSLIB.Topic({
      ros: rosInstance,
      name: '/motor_main/velocity_feedback',
      messageType: 'std_msgs/Float32'
    });
    mainStore.setRobotVelSubscriber(robotVelSubscriber);

    const robotVelInfoSubscriber = new ROSLIB.Topic({
      ros: rosInstance,
      name: '/master/target_speed',
      messageType: 'std_msgs/Float32'
    });
    mainStore.setRobotVelInfoSubscriber(robotVelInfoSubscriber);

    const robotSteeringSubscriber = new ROSLIB.Topic({
      ros: rosInstance,
      name: '/master/target_steering',
      messageType: 'std_msgs/Float32'
    });
    mainStore.setRobotSteeringSubscriber(robotSteeringSubscriber);

    // Request initial config
    const reqConfig = new ROSLIB.Topic({
      ros: rosInstance,
      name: '/web/config/request_config',
      messageType: 'std_msgs/Int16'
    });
    reqConfig.publish({});
  }

  // Helper to compare two Maps so we only update if topics truly changed.
  const areMapsEqual = (a, b) => {
    if (a.size !== b.size) return false;
    for (const [key, val] of a.entries()) {
      if (!b.has(key) || b.get(key) !== val) return false;
    }
    return true;
  };

  function updateTopics() {
    if (mainStore.ros && mainStore.isConnected) {
      mainStore.ros.getTopics((result) => {
        const newMap = new Map();
        for (let i = 0; i < result.topics.length; i++) {
          const topicName = result.topics[i];
          // Ignore /rosout if desired
          if (topicName === '/rosout') continue;
          newMap.set(topicName, result.types[i]);
        }

        if (!areMapsEqual(mainStore.topics, newMap)) {
          mainStore.setTopics(newMap);
          mainStore.setMessage(`Found ${mainStore.topics.size} topics.`);
        }
      }, (error) => {
        mainStore.setMessage(`Error listing topics: ${error.message || error}`);
        console.error('Error listing topics:', error);
      });
    } else {
      mainStore.setMessage('ROS not connected. Cannot list topics.');
    }
  }

  function updateNodes() {
    if (mainStore.ros && mainStore.isConnected) {
      mainStore.ros.getNodes((result) => {
        if (JSON.stringify(mainStore.nodes) !== JSON.stringify(result)) {
          mainStore.setNodes(result);
          mainStore.setMessage(`Found ${mainStore.nodes.length} nodes.`);
        }
      }, (error) => {
        mainStore.setMessage(`Error listing nodes: ${error.message || error}`);
        console.error('Error listing nodes:', error);
      });
    } else {
      mainStore.setMessage('ROS not connected. Cannot list nodes.');
    }
  }

  const isCameraImageTopic = (topicName, topicType) => {
    const type = (topicType || '').toLowerCase();
    if (
      type.includes('sensor_msgs/msg/image') ||
      type.includes('sensor_msgs/image') ||
      type.includes('sensor_msgs/msg/compressedimage') ||
      type.includes('sensor_msgs/compressedimage') ||
      type.includes('theora_image_transport/msg/packet')
    ) {
      return true;
    }

    const name = (topicName || '').toLowerCase();
    return name.includes('/camera') && name.includes('image');
  };

  function subscribeToTopic(topicName, topicType) {
    if (!mainStore.ros || !mainStore.isConnected) {
      mainStore.setMessage('ROS not connected. Cannot subscribe.');
      return;
    }
    if (mainStore.subscriptions.has(topicName)) {
      // Already subscribed
      return;
    }

    if (isCameraImageTopic(topicName, topicType)) {
      mainStore.setMessage(`Skipping camera topic on rosbridge: ${topicName}`);
      return;
    }

    const subscriber = new ROSLIB.Topic({
      ros: mainStore.ros,
      name: topicName,
      messageType: topicType,
      throttle_rate: 100,
    });

    subscriber.subscribe((msg) => {
      mainStore.setMessages(topicName, msg);
    });

    mainStore.addSubscription(topicName, subscriber);
    mainStore.setMessage(`Subscribed to topic: ${topicName}`);
  }

  function unsubscribeFromTopic(topicName) {
    mainStore.removeSubscription(topicName);
    mainStore.setMessage(`Unsubscribed from topic: ${topicName}`);
  }

  function setRosParameter(nodeName, paramName, paramValue) {
    if (!mainStore.ros || !mainStore.isConnected) {
      console.error("ROS not connected. Cannot set parameter.");
      return;
    }

    // ROS 2 parameters are typically accessed directly via ROSLIB.Param
    // rosbridge_websocket expects parameter names in the format "node_name;param_name"
    const rosParamName = `${nodeName}:${paramName}`;
    const rosParam = new ROSLIB.Param({
      ros: mainStore.ros,
      name: rosParamName
    });

    rosParam.set(paramValue, function() {
      console.log(`Parameter ${rosParamName} set to ${paramValue}.`);
    mainStore.setMessage(`Parameter ${rosParamName} set to ${paramValue}`);
  }, function(error) {
      console.error(`Error setting parameter ${rosParamName}:`, error);
      mainStore.setMessage(`Error setting parameter ${rosParamName}: ${error.message || error}`);
    });
  }

  function ensureTestTopicPublisher() {
    if (!mainStore.testTopicPublisher) {
      if (!mainStore.ros) {
        console.warn('ROS instance not ready.');
        return null;
      }
      const testTopic = new ROSLIB.Topic({
        ros: mainStore.ros,
        name: '/test',
        messageType: 'std_msgs/msg/Int32'
      });
      mainStore.setTestTopicPublisher(testTopic);
    }
    return mainStore.testTopicPublisher;
  }

  function publishTestValue(nextValue) {
    if (!mainStore.ros || !mainStore.isConnected) {
      console.warn('ROS not connected. Cannot publish test value.');
      mainStore.setMessage('ROS not connected. Cannot publish test value.');
      return;
    }

    const numericValue = Number(nextValue);
    if (!Number.isFinite(numericValue)) {
      console.warn('Invalid value provided for test topic publish:', nextValue);
      return;
    }

    const publisher = ensureTestTopicPublisher();
    if (!publisher) {
      console.warn('Failed to initialize test topic publisher.');
      return;
    }

    const intValue = Math.trunc(numericValue);
    publisher.publish({ data: intValue });
    mainStore.setMessage(`Published /test value: ${intValue}`);
  }

  const startMonitoring = () => {
    if (monitorInterval) {
      return;
    }
    monitorInterval = setInterval(() => {
      if (mainStore.status === 'Connected') {
        updateTopics();
        updateNodes();
      }
    }, 1000);
  };

  const stopMonitoring = () => {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
  };

  initGlobalWatchers(mainStore, subscribeToTopic, unsubscribeFromTopic, startMonitoring, stopMonitoring);

  return {
    ros: readonly(rosRef), // Return the local reactive ref
    loading: readonly(mainStore.loading),
    server: readonly(mainStore.server),
    status: readonly(mainStore.status),
    message: readonly(mainStore.message),
    topics: readonly(mainStore.topics),
    nodes: readonly(mainStore.nodes),
    messages: readonly(mainStore.messages),
    isConnected: computed(() => mainStore.isConnected),
    initializeROS,
    updateTopics,
    updateNodes,
    subscribeToTopic,
    unsubscribeFromTopic,
    setRosParameter, // Expose this function
    initializeRosTopics, // Expose this function
    publishTestValue,
    startMonitoring,
    stopMonitoring,
  };
}
