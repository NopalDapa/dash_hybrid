import { computed, readonly, ref, watch } from 'vue';
import { useMainStore } from '../stores/store';
import { useRosboardStore } from '../stores/rosboard';

const KONVA_WS_INSTALL_PATH = '/home/nopal/dash_hybrid_baru/konva_ws/install';

let watchersInitialized = false;
let monitorInterval = null;
let cachedInvoke = null;

const canUseTauri = () => typeof window !== 'undefined' && '__TAURI__' in window;

let rclNodeSingleton = null;

const ensureInvoke = async () => {
  if (canUseTauri()) {
    if (!cachedInvoke) {
      const { invoke } = await import('@tauri-apps/api/tauri');
      cachedInvoke = invoke;
    }
    return cachedInvoke;
  }

  if (rclNodeSingleton) {
    return rclNodeSingleton;
  }

  const rclnodejs = await import('rclnodejs');

  // Ensure custom interfaces from our ROS2 overlay are discoverable even when
  // the dashboard process wasn't launched from a sourced shell.
  // rclnodejs relies on AMENT_PREFIX_PATH to locate message/interface packages.
  if (typeof process !== 'undefined' && process?.env) {
    const existing = process.env.AMENT_PREFIX_PATH || '';
    const parts = existing.split(':').filter(Boolean);
    if (!parts.includes(KONVA_WS_INSTALL_PATH)) {
      parts.unshift(KONVA_WS_INSTALL_PATH);
      process.env.AMENT_PREFIX_PATH = parts.join(':');
    }
  }

  if (!rclnodejs.isInitialized()) {
    await rclnodejs.init();
  }
  const node = rclnodejs.createNode('web_dashboard_bridge');
  rclnodejs.spin(node);
  rclNodeSingleton = { node, rclnodejs };
  return rclNodeSingleton;
};

const deriveNodesFromTopics = (topicsMap) => {
  const nodes = new Set();
  for (const name of topicsMap.keys()) {
    const tokens = String(name).split('/').filter(Boolean);
    if (tokens.length > 0) {
      nodes.add(tokens[0]);
    }
  }
  return Array.from(nodes).sort();
};

const initGlobalWatchers = (mainStore, rosboardStore) => {
  if (watchersInitialized) {
    return;
  }

  watch(
    () => rosboardStore.status,
    (status) => {
      switch (status) {
        case 'connected':
          mainStore.setStatus('Connected');
          mainStore.setLoading(false);
          mainStore.setMessage(`Connected to ROSboard${rosboardStore.url ? ` (${rosboardStore.url})` : ''}`);
          break;
        case 'connecting':
          mainStore.setStatus(null);
          mainStore.setLoading(true);
          mainStore.setMessage('Connecting to ROSboard…');
          break;
        case 'error':
          mainStore.setStatus('Disconnected');
          mainStore.setLoading(false);
          mainStore.setMessage(rosboardStore.lastError ?? 'ROSboard connection error.');
          break;
        default:
          mainStore.setStatus('Disconnected');
          if (!mainStore.loading) {
            mainStore.setMessage('Disconnected from ROSboard.');
          }
          break;
      }
    },
    { immediate: true },
  );

  watch(
    () => rosboardStore.topics,
    (topicsObj) => {
      const topicsMap = new Map(Object.entries(topicsObj ?? {}));
      mainStore.setTopics(topicsMap);
      mainStore.setNodes(deriveNodesFromTopics(topicsMap));

      const validTopics = new Set(topicsMap.keys());
      for (const existing of Array.from(mainStore.messages.keys())) {
        if (!validTopics.has(existing)) {
          mainStore.removeTopicMessage(existing);
        }
      }
    },
    { immediate: true, deep: true },
  );

  watch(
    () => rosboardStore.latestMessages,
    (messagesObj) => {
      if (!messagesObj) {
        return;
      }
      for (const [topicName, payload] of Object.entries(messagesObj)) {
        mainStore.setTopicMessage(topicName, payload);
      }
    },
    { immediate: true, deep: true },
  );

  watchersInitialized = true;
};

export function useROS() {
  const mainStore = useMainStore();
  const rosboardStore = useRosboardStore();

  initGlobalWatchers(mainStore, rosboardStore);

  const rosPlaceholder = ref(null);
  const isConnected = computed(() => rosboardStore.status === 'connected');

  const initializeROS = (host, port) => {
    const trimmedHost = host?.trim() ?? '';
    const parsedPort = port ? Number(port) : undefined;

    mainStore.setLoading(true);
    mainStore.setServer(trimmedHost);
    mainStore.setStatus(null);
    mainStore.setMessage(`Connecting to ROSboard server at ${trimmedHost}${parsedPort ? `:${parsedPort}` : ''}…`);

    rosboardStore.configure({ host: trimmedHost, port: parsedPort });
    rosboardStore.setDisconnectWhenIdle(false);
    rosboardStore.connect();
  };

  const updateTopics = () => {
    const topicsMap = new Map(Object.entries(rosboardStore.topics ?? {}));
    mainStore.setTopics(topicsMap);
    mainStore.setNodes(deriveNodesFromTopics(topicsMap));
  };

  const updateNodes = () => {
    mainStore.setNodes(deriveNodesFromTopics(mainStore.topics));
  };

  const subscribeToTopic = (topicName, _topicType, options = {}) => {
    const trimmedName = topicName?.trim();
    if (!trimmedName) {
      return;
    }
    rosboardStore.subscribe(trimmedName, options);
  };

  const unsubscribeFromTopic = (topicName) => {
    const trimmedName = topicName?.trim();
    if (!trimmedName) {
      return;
    }
    rosboardStore.unsubscribe(trimmedName);
    mainStore.removeTopicMessage(trimmedName);
  };

  const startMonitoring = () => {
    if (typeof window === 'undefined' || monitorInterval) {
      return;
    }
    monitorInterval = window.setInterval(() => {
      if (rosboardStore.status === 'connected') {
        updateTopics();
      }
    }, 2000);
  };

  const stopMonitoring = () => {
    if (typeof window === 'undefined' || !monitorInterval) {
      return;
    }
    window.clearInterval(monitorInterval);
    monitorInterval = null;
  };

  const setRosParameter = async (nodeName, paramName, paramValue) => {
    if (!nodeName || !paramName) {
      console.warn('Parameter name or node name missing.');
      return;
    }
    try {
      await callTauri('set_ros_parameter', {
        nodeName,
        paramName,
        value: paramValue,
      });
      mainStore.setMessage(`Parameter ${nodeName}.${paramName} updated.`);
    } catch (error) {
      console.error('Failed to set ROS parameter', error);
      mainStore.setMessage(`Failed to set parameter ${nodeName}.${paramName}.`);
    }
  };

  const publishFloat32MultiArray = async (topicName, data) => {
    if (!topicName) {
      console.warn('Topic name required for publish.');
      return;
    }
    try {
      if (canUseTauri()) {
        const invoke = await ensureInvoke();
        await invoke('publish_float32_multi_array', { topicName, data });
      } else {
        const bridge = await ensureInvoke();
        if (!bridge) {
          throw new Error('ROS bridge unavailable');
        }
        const { node, rclnodejs } = bridge;
        const publisherKey = `pub:${topicName}`;
        if (!node[publisherKey]) {
          node[publisherKey] = node.createPublisher('std_msgs/msg/Float32MultiArray', topicName);
        }
        const message = rclnodejs.createMessage('std_msgs/msg/Float32MultiArray', { data });
        node[publisherKey].publish(message);
      }
      mainStore.setMessage(`Published ${topicName}`);
    } catch (error) {
      /*console.error(`Failed to publish ${topicName}`, error);
      mainStore.setMessage(`Failed to publish to ${topicName}.`);*/
    }
  };

  const publishTestValue = async (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      mainStore.setMessage('Invalid value for /test topic.');
      return;
    }
    try {
      if (canUseTauri()) {
        const invoke = await ensureInvoke();
        await invoke('publish_int32', {
          topicName: '/test',
          value: Math.trunc(numericValue),
        });
      } else {
        const bridge = await ensureInvoke();
        if (!bridge) {
          throw new Error('ROS bridge unavailable');
        }
        const { node, rclnodejs } = bridge;
        const publisherKey = `pub:/test`;
        if (!node[publisherKey]) {
          node[publisherKey] = node.createPublisher('std_msgs/msg/Int32', '/test');
        }
        const message = rclnodejs.createMessage('std_msgs/msg/Int32', {
          data: Math.trunc(numericValue),
        });
        node[publisherKey].publish(message);
      }
      mainStore.setMessage(`Published /test value: ${Math.trunc(numericValue)}`);
    } catch (error) {
      /*console.error('Failed to publish /test value', error);
      mainStore.setMessage('Failed to publish /test value.');*/
    }
  };

  const publishInt16 = async (topicName, value) => {
    const intValue = Number(value);
    if (!Number.isFinite(intValue)) {
      mainStore.setMessage(`Invalid value for ${topicName}.`);
      return;
    }
    try {
      if (canUseTauri()) {
        const invoke = await ensureInvoke();
        await invoke('publish_int16', {
          topicName,
          value: Math.trunc(intValue),
        });
      } else {
        const bridge = await ensureInvoke();
        if (!bridge) {
          throw new Error('ROS bridge unavailable');
        }
        const { node, rclnodejs } = bridge;
        const publisherKey = `pub:${topicName}`;
        if (!node[publisherKey]) {
          node[publisherKey] = node.createPublisher('std_msgs/msg/Int16', topicName);
        }
        const message = rclnodejs.createMessage('std_msgs/msg/Int16', {
          data: Math.trunc(intValue),
        });
        node[publisherKey].publish(message);
      }
    } catch (error) {
      /*console.error(`Failed to publish ${topicName}`, error);
      mainStore.setMessage(`Failed to publish to ${topicName}.`);*/
    }
  };

  const publishModeSwitch = async (topicName, enabled, mode) => {
    const trimmedName = topicName?.trim();
    if (!trimmedName) {
      console.warn('Topic name required for publish.');
      return;
    }
    const normalizedMode = String(mode ?? '').toLowerCase();
    if (normalizedMode !== 'wheel' && normalizedMode !== 'arm') {
      mainStore.setMessage(`Invalid mode for ${trimmedName}.`);
      return;
    }

    try {
      if (canUseTauri()) {
        // No native command for custom msg publish yet.
        // Fallback to JS rclnodejs path for now.
        throw new Error('ModeSwitch publish not implemented for Tauri runtime');
      }

      const bridge = await ensureInvoke();
      if (!bridge) {
        throw new Error('ROS bridge unavailable');
      }
      const { node, rclnodejs } = bridge;
      const publisherKey = `pub:${trimmedName}`;
      if (!node[publisherKey]) {
        node[publisherKey] = node.createPublisher('global_interfaces/msg/ModeSwitch', trimmedName);
      }
      const message = rclnodejs.createMessage('global_interfaces/msg/ModeSwitch', {
        enabled: Boolean(enabled),
        mode: normalizedMode,
      });
      node[publisherKey].publish(message);
    } catch (error) {
      /*console.error(`Failed to publish ${trimmedName}`, error);
      mainStore.setMessage(`Failed to publish to ${trimmedName}.`);*/
    }
  };

  return {
    ros: readonly(rosPlaceholder),
    loading: readonly(mainStore.loading),
    server: readonly(mainStore.server),
    status: readonly(mainStore.status),
    message: readonly(mainStore.message),
    topics: readonly(mainStore.topics),
    nodes: readonly(mainStore.nodes),
    messages: readonly(mainStore.messages),
    isConnected,
    initializeROS,
    updateTopics,
    updateNodes,
    subscribeToTopic,
    unsubscribeFromTopic,
    setRosParameter,
    publishFloat32MultiArray,
    publishTestValue,
    publishInt16,
    publishModeSwitch,
    startMonitoring,
    stopMonitoring,
  };
}
