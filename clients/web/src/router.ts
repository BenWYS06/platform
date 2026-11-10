// Job: the routes of the web app.
import { createRouter, createWebHistory, type RouterHistory } from 'vue-router';
import HealthView from './views/HealthView.vue';

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  return createRouter({
    history,
    routes: [{ path: '/', name: 'health', component: HealthView }],
  });
}
