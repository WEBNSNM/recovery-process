import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import * as schema from '../server/schema';
import * as domain from '../src/domain';
function page() { let definition: any; const request = vi.fn(async () => ({ data: [] })); const sandbox = { require: (p: string) => p.endsWith('api') ? { request } : p.endsWith('schema') ? schema : domain, Page: (p: any) => definition = p, wx: { showToast: vi.fn(), pageScrollTo: vi.fn(), nextTick: vi.fn() }, Date, console }; vm.runInNewContext(fs.readFileSync('miniprogram/pages/index/index.js', 'utf8'), sandbox); definition.setData = (patch: any) => { for (const [key, val] of Object.entries(patch)) {
    const bits = key.split('.');
    let obj = definition.data;
    for (const bit of bits.slice(0, -1))
        obj = obj[bit];
    obj[bits[bits.length - 1]] = val;
} }; return { page: definition, request }; }
describe('native mini program bindings', () => {
    it('binds every template event to an implemented handler', () => { const { page: p } = page(); const wxml = fs.readFileSync('miniprogram/pages/index/index.wxml', 'utf8'); for (const match of wxml.matchAll(/bind\w+="(\w+)"/g))
        expect(typeof p[match[1]], match[1]).toBe('function'); expect(wxml).not.toMatch(/\{\{[^}]*\.indexOf\(/); });
    it('preserves symptoms when editing and validates before sending', async () => { const { page: p, request } = page(); p.data.temperatures = [{ id: 't1', measuredAt: '2026-10-12T10:00', value: 38.1, method: '腋温', symptoms: ['乏力'], note: '' }]; p.edit({ currentTarget: { dataset: { resource: 'temperatures', id: 't1' } } }); expect(p.data.form.symptoms).toEqual(['乏力']); expect(p.data.symptomOptions.find((x: any) => x.name === '乏力').checked).toBe(true); p.data.form.value = '55'; await p.save(); expect(request).not.toHaveBeenCalled(); expect(p.data.error).toContain('数值'); });
    it('updates date and time independently', () => { const { page: p } = page(); p.data.form.measuredAt = '2026-10-12T10:00'; p.datePart({ currentTarget: { dataset: { key: 'measuredAt', part: 'date' } }, detail: { value: '2026-10-11' } }); expect(p.data.form.measuredAt).toBe('2026-10-11T10:00'); p.datePart({ currentTarget: { dataset: { key: 'measuredAt', part: 'time' } }, detail: { value: '15:35' } }); expect(p.data.form.measuredAt).toBe('2026-10-11T15:35'); });
});
