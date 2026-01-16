import { createApp } from "vue";
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import "./style.css";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(VueKonva);
app.mount("#app");
