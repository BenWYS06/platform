import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppI18n } from '../src/i18n';
import { createAppRouter } from '../src/router';
import { fakeServer, json, stopFakeServer } from './fake-server';

afterEach(() => stopFakeServer());

describe('app', () => {
  it('mounts and shows the health screen on /', async () => {
    fakeServer(async () => json(200, { status: 'UP' }));
    const router = createAppRouter(createMemoryHistory());
    await router.push('/');
    const wrapper = mount(App, { global: { plugins: [createPinia(), createAppI18n('en'), router] } });
    await flushPromises();
    expect(wrapper.find('[data-test="health-view"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Server status');
  });
});
