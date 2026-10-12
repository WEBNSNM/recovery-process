import { it, expect } from 'vitest';
import worker from '../server/index';
it('refuses to expose an unconfigured remote health database', async () => { const res = await worker.fetch(new Request('https://kangcheng.example/api/export'), {} as any); expect(res.status).toBe(503); });
it('rejects a missing household key before accessing records', async () => { const res = await worker.fetch(new Request('https://kangcheng.example/api/export'), { DATA_ACCESS_KEY: 'private-test-value' } as any); expect(res.status).toBe(401); });
