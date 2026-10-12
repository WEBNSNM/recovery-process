import { describe, it, expect } from 'vitest';
import { validateRecord, validateBackup } from '../server/schema';
describe('health data validation', () => {
    it('rejects impossible temperatures and invalid dates', () => {
        expect(() => validateRecord('temperatures', { measuredAt: '2026-02-30T10:00', value: 39, method: '腋温', symptoms: [] })).toThrow();
        expect(() => validateRecord('temperatures', { measuredAt: '2026-10-12T10:00', value: 55, method: '腋温', symptoms: [] })).toThrow();
    });
    it('rejects reverse medication dates', () => expect(() => validateRecord('medications', { name: '药物', spec: '4mg', unit: '片', dose: 1, frequency: 1, route: '口服', startDate: '2026-10-12', endDate: '2026-10-01' })).toThrow());
    it('rejects incomplete backups rather than erasing records', () => expect(() => validateBackup({ backupVersion: 1, temperatures: [] })).toThrow());
    it('keeps camelCase backup fields and record version', () => expect(validateRecord('labs', { testedAt: '2026-10-12', name: 'CRP', value: 0, unit: 'mg/L' })).toMatchObject({ testedAt: '2026-10-12', schemaVersion: 1, value: 0 }));
});
