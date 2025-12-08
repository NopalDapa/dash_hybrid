import { defineStore } from 'pinia';

export const useMainStore = defineStore('main', {
  state: () => ({
    loading: false,
    status: null, // 'Connected' | 'Disconnected' | null
    message: null,
    server: '',
    topics: new Map(), // Map<string, string> for topicName -> topicType
    nodes: [], // string[] for node names
    messages: new Map(), // Map<string, any> for topicName -> latestMessage
    cameraTopics: {}, // Record<string, string> for camera cards
  }),
  getters: {
    isConnected: (state) => state.status === 'Connected',
  },
  actions: {
    setLoading(isLoading) {
      this.loading = isLoading;
    },
    setStatus(newStatus) {
      this.status = newStatus;
    },
    setMessage(newMessage) {
      this.message = newMessage;
    },
    clearMessage() {
      this.message = null;
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
    setTopicMessage(topicName, message) {
      this.messages.set(topicName, message);
    },
    removeTopicMessage(topicName) {
      this.messages.delete(topicName);
    },
    resetTopics() {
      this.topics = new Map();
      this.messages = new Map();
    },
    setCameraTopic(cardId, topic) {
      if (topic) {
        this.cameraTopics[cardId] = topic;
      } else {
        delete this.cameraTopics[cardId];
      }
    },
    clearAllData() {
      this.resetTopics();
      this.nodes = [];
      this.status = 'Disconnected';
      this.loading = false;
      this.message = null;
    },
  },
});
