import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import App from '../src/App.vue';
import { createAppI18n } from '../src/i18n';
import { createAppRouter } from '../src/router';

afterEach(() => vi.unstubAllGlobals());

describe('app', () => {
  it('mounts and shows the health screen on /', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"status":"UP"}', { headers: { 'Content-Type': 'application/json' } })),
    );
    const router = createAppRouter(createMemoryHistory());
    await router.push('/');
    const wrapper = mount(App, { global: { plugins: [createPinia(), createAppI18n('en'), router] } });
    await flushPromises();
    expect(wrapper.find('[data-test="health-view"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Server status');
  });
});
