import { it, expect } from 'vitest';
import { reactive } from 'vue';
import { cloneRecord } from '../src/domain';
it('copies Vue reactive records without losing symptoms or modifying original', () => { const original = reactive({ symptoms: ['乏力'], value: 38.2 }); const copy = cloneRecord(original); copy.symptoms.push('畏寒'); expect(original.symptoms).toEqual(['乏力']); expect(copy.value).toBe(38.2); });
