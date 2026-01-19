import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import VueKonva from "vue-konva";

const pinia = createPinia();
const app = createApp(App);

app.use(router);
app.use(VueKonva);
app.use(pinia);
app.mount("#app");
