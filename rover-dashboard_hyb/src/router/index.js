import { createRouter, createWebHistory } from 'vue-router';
import MainView from '../views/MainView.vue';
import CameraView from '../views/CamView.vue';
import DebugView from '../views/DebugView.vue';
import SlamView from '../views/SlamView.vue';
import ConnectionView from '../views/ConnectionView.vue';
import JoystickView from '../views/JoystickView.vue';

const routes = [
  {
    path: '/',
    redirect: '/connect',
  },
  {
    path: '/connect',
    name: 'Connect',
    component: ConnectionView,
  },
  {
    path: '/data',
    name: 'Data',
    component: MainView,
  },
  {
    path: '/camera',
    name: 'Camera',
    component: CameraView,
  },
  {
    path: '/configuration',
    name: 'Debug',
    component: DebugView,
  },
  {
    path: '/slam',
    name: 'Science',
    component: SlamView,
  },
  {
    path: '/joystick',
    name: 'Joystick',
    component: JoystickView,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
