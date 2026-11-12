import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAppI18n, type Locale } from '../src/i18n';
import { useHealthStore } from '../src/stores/health';
import HealthView from '../src/views/HealthView.vue';
import { fakeServer, json, stopFakeServer } from './fake-server';

type Answer = { status: number; body: unknown } | 'network-error';

// A server that answers per service: /api/<service>/health -> answers[service] (default Up).
function stubServices(answers: Partial<Record<string, Answer>> = {}) {
  return fakeServer(async ({ url }) => {
    const service = url.split('/')[2] ?? '';
    const answer = answers[service] ?? { status: 200, body: { status: 'UP' } };
    if (answer === 'network-error') throw new TypeError('Failed to fetch');
    return json(answer.status, answer.body);
  });
}

async function mountView(locale: Locale = 'en') {
  const wrapper = mount(HealthView, { global: { plugins: [createAppI18n(locale)] } });
  await flushPromises();
  return wrapper;
}

const row = (wrapper: Awaited<ReturnType<typeof mountView>>, service: string) => ({
  status: wrapper.find(`[data-test="row-${service}"] [data-test="status"]`).text(),
  message: wrapper.find(`[data-test="row-${service}"] [data-test="message"]`),
});

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => stopFakeServer());

describe('health screen', () => {
  it('shows three Up rows when every service is up', async () => {
    const server = stubServices();
    const wrapper = await mountView();
    for (const service of ['auth', 'chat', 'ai']) {
      expect(row(wrapper, service).status).toBe('Up');
      expect(row(wrapper, service).message.exists()).toBe(false);
    }
    expect(server).toHaveBeenCalledTimes(3);
  });

  it('shows one service Down with the SERVICE_UNAVAILABLE message, the others Up', async () => {
    stubServices({ chat: { status: 503, body: { code: 'SERVICE_UNAVAILABLE' } } });
    const wrapper = await mountView();
    expect(row(wrapper, 'chat').status).toBe('Down');
    expect(row(wrapper, 'chat').message.text()).toBe('This service is not available right now.');
    expect(row(wrapper, 'auth').status).toBe('Up');
    expect(row(wrapper, 'ai').status).toBe('Up');
  });

  it('shows the UNKNOWN message for a code it does not know, never the server text', async () => {
    stubServices({ ai: { status: 500, body: { code: 'NEW_SERVER_CODE', message: 'raw server text' } } });
    const wrapper = await mountView();
    expect(row(wrapper, 'ai').message.text()).toBe('Something unexpected happened.');
    expect(wrapper.html()).not.toContain('raw server text');
  });

  it('shows the network message when the server cannot be reached', async () => {
    stubServices({ auth: 'network-error', chat: 'network-error', ai: 'network-error' });
    const wrapper = await mountView();
    for (const service of ['auth', 'chat', 'ai']) {
      expect(row(wrapper, service).message.text()).toBe('Cannot reach the server. Check your connection.');
    }
  });

  it('shows Vietnamese for a Vietnamese browser', async () => {
    stubServices({ chat: { status: 503, body: { code: 'SERVICE_UNAVAILABLE' } } });
    const wrapper = await mountView('vi');
    expect(row(wrapper, 'chat').status).toBe('Không hoạt động');
    expect(row(wrapper, 'chat').message.text()).toBe('Dịch vụ này hiện không khả dụng.');
  });

  it('disables "Check again" while checking and runs a new round when pressed', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const server = fakeServer(async () => {
      await gate;
      return json(200, { status: 'UP' });
    });

    const wrapper = mount(HealthView, { global: { plugins: [createAppI18n('en')] } });
    await flushPromises();
    const button = wrapper.find('[data-test="check-again"]');
    expect(button.attributes('disabled')).toBeDefined();
    expect(row(wrapper, 'auth').status).toBe('Checking…');

    release();
    await flushPromises();
    expect(button.attributes('disabled')).toBeUndefined();

    await button.trigger('click');
    await flushPromises();
    expect(server).toHaveBeenCalledTimes(6);
  });
});

describe('health store', () => {
  it('runs one round when checkAll is called twice fast', async () => {
    const server = stubServices();
    const store = useHealthStore();
    await Promise.all([store.checkAll(), store.checkAll()]);
    expect(server).toHaveBeenCalledTimes(3);
    expect(store.checking).toBe(false);
  });
});
