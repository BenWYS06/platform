import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppRouter } from '../src/router';

describe('app', () => {
  it('mounts and shows the health screen on /', async () => {
    const router = createAppRouter(createMemoryHistory());
    await router.push('/');
    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } });
    await flushPromises();
    expect(wrapper.find('[data-test="health-view"]').exists()).toBe(true);
  });
});
