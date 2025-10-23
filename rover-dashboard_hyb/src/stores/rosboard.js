import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import JSON5 from 'json5';

const MSG_PING = 'p';
const MSG_PONG = 'q';
const MSG_MSG = 'm';
const MSG_TOPICS = 't';
const MSG_SYSTEM = 'y';
const MSG_SUB = 's';
const MSG_UNSUB = 'u';

const PING_SEQ = 's';
const PONG_SEQ = 's';
const PONG_TIME = 't';

const DEFAULT_UPDATE_RATE = 24;

const readyStates = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

export const useRosboardStore = defineStore('rosboard', {
  state: () => ({
    host: '',
    port: 8888,
    status: 'disconnected', // 'connecting' | 'connected' | 'error' | 'disconnected'
    lastError: null,
    socket: null,
    topics: {},
    latestMessages: {},
    systemInfo: null,
    disconnectWhenIdle: true,
    _activeTopics: markRaw(new Map()), // topic -> { count, maxUpdateRate }
    _subscribedTopics: markRaw(new Set()), // topics currently subscribed on the socket
  }),
  getters: {
    url(state) {
      if (!state.host) {
        return null;
      }
      return `${state.host}:${state.port}`;
    },
    isConnected(state) {
      return state.status === 'connected';
    },
    isConfigured(state) {
      return Boolean(state.host);
    },
    activeTopicCount() {
      return this._activeTopics.size;
    },
  },
  actions: {
    configure({ host, port }) {
      if (typeof host === 'string') {
        this.host = host.trim();
      }
      if (port !== undefined && port !== null) {
        const parsedPort = Number(port);
        this.port = Number.isFinite(parsedPort) ? parsedPort : 8888;
      }
    },
    setDisconnectWhenIdle(shouldDisconnect) {
      this.disconnectWhenIdle = Boolean(shouldDisconnect);
      if (this.disconnectWhenIdle && this._activeTopics.size === 0) {
        this.disconnect(false);
      } else if (!this.disconnectWhenIdle && this._activeTopics.size > 0) {
        this.connect();
      }
    },
    ensureConnected() {
      if (!this.isConfigured) {
        this.lastError = 'ROSboard host belum dikonfigurasi.';
        return;
      }
      if (!this.socket || this.socket.readyState === readyStates.CLOSED) {
        this.connect();
      }
    },
    disconnectIfIdle() {
      if (this.disconnectWhenIdle && this._activeTopics.size === 0) {
        this.disconnect(false);
      }
    },
    connect() {
      if (!this.host) {
        this.lastError = 'ROSboard host belum dikonfigurasi.';
        return;
      }
      if (this.socket && (this.socket.readyState === readyStates.OPEN || this.socket.readyState === readyStates.CONNECTING)) {
        return;
      }

      this.disconnect(false);

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${this.host}:${this.port}/rosboard/v1`;

      try {
        const ws = new WebSocket(wsUrl);
        this.socket = ws;
        this.status = 'connecting';
        this.lastError = null;

        ws.onopen = () => {
          this.status = 'connected';
          this._flushSubscriptions();
        };

        ws.onclose = () => {
          this.status = 'disconnected';
          this.socket = null;
          this._subscribedTopics.clear();
          if (!this.disconnectWhenIdle && this._activeTopics.size > 0) {
            // attempt reconnection once if still needed
            window.setTimeout(() => {
              if (this._activeTopics.size > 0 && !this.socket) {
                this.connect();
              }
            }, 1000);
          }
        };

        ws.onerror = () => {
          this.status = 'error';
          this.lastError = `Gagal terhubung ke ROSboard di ${wsUrl}`;
        };

        ws.onmessage = (event) => {
          this._handleMessage(event.data);
        };
      } catch (error) {
        this.status = 'error';
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    },
    disconnect(clearConfig = false) {
      if (clearConfig) {
        this.host = '';
        this.port = 8888;
      }
      if (this.socket) {
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onopen = null;
        this.socket.onmessage = null;
        try {
          this.socket.close();
        } catch (error) {
          // ignore
        }
        this.socket = null;
      }
      this.status = 'disconnected';
      this._subscribedTopics.clear();
    },
    subscribe(topicName, options = {}) {
      const trimmedName = typeof topicName === 'string' ? topicName.trim() : '';
      if (!trimmedName) {
        return;
      }

      const existing = this._activeTopics.get(trimmedName) ?? { count: 0, maxUpdateRate: options.maxUpdateRate ?? DEFAULT_UPDATE_RATE };
      existing.count += 1;
      if (options.maxUpdateRate && options.maxUpdateRate !== existing.maxUpdateRate) {
        existing.maxUpdateRate = options.maxUpdateRate;
        if (this.socket && this.socket.readyState === readyStates.OPEN) {
          this._sendSubscribe(trimmedName, existing.maxUpdateRate);
        }
      }
      this._activeTopics.set(trimmedName, existing);

      if (this.socket && this.socket.readyState === readyStates.OPEN) {
        this._sendSubscribe(trimmedName, existing.maxUpdateRate);
      } else if (!this.socket || this.socket.readyState === readyStates.CLOSED) {
        this.connect();
      }
    },
    unsubscribe(topicName) {
      const trimmedName = typeof topicName === 'string' ? topicName.trim() : '';
      if (!trimmedName) {
        return;
      }

      const existing = this._activeTopics.get(trimmedName);
      if (!existing) {
        return;
      }

      existing.count -= 1;
      if (existing.count <= 0) {
        this._activeTopics.delete(trimmedName);
        if (this.socket && this.socket.readyState === readyStates.OPEN && this._subscribedTopics.has(trimmedName)) {
          this._sendUnsubscribe(trimmedName);
        }
        this._subscribedTopics.delete(trimmedName);
        this._removeCachedTopic(trimmedName);

        if (this.disconnectWhenIdle && this._activeTopics.size === 0) {
          this.disconnect(false);
        }
      } else {
        this._activeTopics.set(trimmedName, existing);
      }
    },
    clearAllSubscriptions() {
      if (this.socket && this.socket.readyState === readyStates.OPEN) {
        for (const topic of this._subscribedTopics) {
          this._sendUnsubscribe(topic);
        }
      }
      this._activeTopics.clear();
      this._subscribedTopics.clear();
      this.latestMessages = {};
    },
    _flushSubscriptions() {
      if (!this.socket || this.socket.readyState !== readyStates.OPEN) {
        return;
      }
      for (const [topicName, { maxUpdateRate }] of this._activeTopics.entries()) {
        this._sendSubscribe(topicName, maxUpdateRate);
      }
    },
    _removeCachedTopic(topicName) {
      if (Object.prototype.hasOwnProperty.call(this.latestMessages, topicName)) {
        const { [topicName]: _, ...rest } = this.latestMessages;
        this.latestMessages = rest;
      }
      if (Object.prototype.hasOwnProperty.call(this.topics, topicName)) {
        const { [topicName]: __, ...restTopics } = this.topics;
        this.topics = restTopics;
      }
    },
    _sendSubscribe(topicName, maxUpdateRate = DEFAULT_UPDATE_RATE) {
      if (!this.socket || this.socket.readyState !== readyStates.OPEN) {
        return;
      }
      const payload = [MSG_SUB, { topicName, maxUpdateRate }];
      try {
        this.socket.send(JSON.stringify(payload));
        this._subscribedTopics.add(topicName);
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    },
    _sendUnsubscribe(topicName) {
      if (!this.socket || this.socket.readyState !== readyStates.OPEN) {
        return;
      }
      const payload = [MSG_UNSUB, { topicName }];
      try {
        this.socket.send(JSON.stringify(payload));
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    },
    _sendPong(seq) {
      if (!this.socket || this.socket.readyState !== readyStates.OPEN) {
        return;
      }
      const payload = [MSG_PONG, { [PONG_SEQ]: seq, [PONG_TIME]: Date.now() }];
      try {
        this.socket.send(JSON.stringify(payload));
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    },
    _handleMessage(raw) {
      let data;
      try {
        data = JSON.parse(raw);
      } catch (error) {
        try {
          data = JSON5.parse(raw);
        } catch (err) {
          this.lastError = err instanceof Error ? err.message : String(err);
          return;
        }
      }

      if (!Array.isArray(data) || data.length < 2) {
        return;
      }

      const [msgType, payload] = data;

      switch (msgType) {
        case MSG_PING: {
          const seq = payload?.[PING_SEQ];
          if (seq !== undefined) {
            this._sendPong(seq);
          }
          break;
        }
        case MSG_MSG: {
          const topicName = payload?._topic_name;
          if (!topicName) {
            return;
          }
          if (payload?._topic_type) {
            this.topics = {
              ...this.topics,
              [topicName]: payload._topic_type,
            };
          }
          this.latestMessages = {
            ...this.latestMessages,
            [topicName]: payload,
          };
          if (payload?._error) {
            this.lastError = payload._error;
          }
          break;
        }
        case MSG_TOPICS: {
          if (payload && typeof payload === 'object') {
            this.topics = payload;
          }
          break;
        }
        case MSG_SYSTEM: {
          this.systemInfo = payload ?? null;
          break;
        }
        default:
          break;
      }
    },
  },
});
