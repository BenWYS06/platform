// Job: start the web app: styles, i18n, router, Pinia, then mount.
import './styles/main.css';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { createAppI18n } from './i18n';
import { createAppRouter } from './router';

const i18n = createAppI18n();
document.documentElement.lang = i18n.global.locale.value;

createApp(App).use(createPinia()).use(i18n).use(createAppRouter()).mount('#app');
