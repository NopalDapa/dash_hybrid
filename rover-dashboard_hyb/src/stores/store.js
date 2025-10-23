import { defineStore } from 'pinia';
import ROSLIB from 'roslib';

export const useMainStore = defineStore('main', {
  state: () => ({
    ros: null,
    loading: false,
    status: null, // 'Connected' | 'Disconnected' | null
    message: null,
    server: '',
    topics: new Map(), // Map<string, string> for topicName -> topicType
    nodes: [], // string[] for node names
    messages: new Map(), // Map<string, any> for topicName -> latestMessage
    subscriptions: new Map(), // Map<string, ROSLIB.Topic> for topicName -> subscriber

    cameraTopics: {}, // Record<string, string> for camera cards

    // ROS Topic instances for DebugView
    topicConfiguration: null,
    topicVelocityAndSteering: null,
    configListener: null,
    robotVelSubscriber: null,
    robotSteeringSubscriber: null,
    robotVelInfoSubscriber: null,
    testTopicPublisher: null,
  }),
  getters: {
    isConnected: (state) => state.status === 'Connected',
  },
  actions: {
    setRos(rosInstance) {
      this.ros = rosInstance;
    },
    setLoading(isLoading) {
      this.loading = isLoading;
    },
    setTopicConfiguration(topic) { this.topicConfiguration = topic; },
    setTopicVelocityAndSteering(topic) { this.topicVelocityAndSteering = topic; },
    setConfigListener(listener) { this.configListener = listener; },
    setRobotVelSubscriber(subscriber) { this.robotVelSubscriber = subscriber; },
    setRobotSteeringSubscriber(subscriber) { this.robotSteeringSubscriber = subscriber; },
    setRobotVelInfoSubscriber(subscriber) { this.robotVelInfoSubscriber = subscriber; },
    setTestTopicPublisher(publisher) { this.testTopicPublisher = publisher; },
    setStatus(newStatus) {
      this.status = newStatus;
    },
    setMessage(newMessage) {
      this.message = newMessage;
    },
    setServer(newServer) {
      this.server = newServer;
    },
    setTopics(newTopics) {
      this.topics = newTopics;
    },
    setNodes(newNodes) {
      this.nodes = newNodes;
    },
    setMessages(topicName, message) {
      this.messages.set(topicName, message);
    },
    addSubscription(topicName, subscriber) {
      this.subscriptions.set(topicName, subscriber);
    },
    setCameraTopic(cardId, topic) {
      if (topic) {
        this.cameraTopics[cardId] = topic;
      } else {
        delete this.cameraTopics[cardId];
      }
    },
    removeSubscription(topicName) {
      if (this.subscriptions.has(topicName)) {
        const subscriber = this.subscriptions.get(topicName);
        subscriber.unsubscribe();
        this.subscriptions.delete(topicName);
        this.messages.delete(topicName);
      }
    },
    clearAllRosData() {
      this.subscriptions.forEach(sub => sub.unsubscribe());
      this.subscriptions.clear();
      this.topics.clear();
      this.nodes = [];
      this.messages.clear();
      this.ros = null;
      this.status = 'Disconnected';
      this.loading = false;

      // Clear DebugView specific topics
      if (this.topicConfiguration) this.topicConfiguration = null;
      if (this.topicVelocityAndSteering) this.topicVelocityAndSteering = null;
      if (this.configListener) this.configListener.unsubscribe();
      if (this.robotVelSubscriber) this.robotVelSubscriber.unsubscribe();
      if (this.robotSteeringSubscriber) this.robotSteeringSubscriber.unsubscribe();
      if (this.robotVelInfoSubscriber) this.robotVelInfoSubscriber.unsubscribe();

      this.configListener = null;
      this.robotVelSubscriber = null;
      this.robotSteeringSubscriber = null;
      this.robotVelInfoSubscriber = null;

      if (this.testTopicPublisher) {
        if (typeof this.testTopicPublisher.unadvertise === 'function') {
          this.testTopicPublisher.unadvertise();
        }
        this.testTopicPublisher = null;
      }
    },
  },
});
