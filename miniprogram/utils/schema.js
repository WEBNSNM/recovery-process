"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.column = exports.definitions = void 0;
exports.validateRecord = validateRecord;
exports.validateBackup = validateBackup;
exports.definitions = {
    temperatures: { table: 'temperatures', fields: ['measuredAt', 'value', 'method', 'symptoms', 'note'] },
    medications: { table: 'medications', fields: ['name', 'spec', 'unit', 'dose', 'frequency', 'route', 'startDate', 'endDate', 'note'] },
    medicationLogs: { table: 'medication_logs', fields: ['medicationId', 'occurredAt', 'dose', 'missed', 'note'] },
    labs: { table: 'labs', fields: ['testedAt', 'name', 'value', 'unit', 'reference', 'hospital', 'note'] },
    events: { table: 'events', fields: ['occurredAt', 'title', 'detail'] }
};
const column = (s) => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
exports.column = column;
function date(value, time = false) {
    if (typeof value !== 'string' || !(time ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})?$/ : /^\d{4}-\d{2}-\d{2}$/).test(value))
        throw Error('日期时间格式无效');
    const day = value.slice(0, 10);
    const d = new Date(day + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== day || !Number.isFinite(new Date(value).getTime()))
        throw Error('日期时间无效');
}
function number(v, min, max = 1e12) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
        throw Error('数值超出有效范围');
}
function required(v) {
    if (typeof v !== 'string' || !v.trim())
        throw Error('请填写必填字段');
}
function validateRecord(resource, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw Error('记录格式无效');
    if (input.schemaVersion !== undefined && input.schemaVersion !== 1)
        throw Error('记录版本不支持');
    const out = { schemaVersion: 1 };
    for (const f of exports.definitions[resource].fields) {
        const v = input[f];
        out[f] = v ?? (f === 'symptoms' ? [] : f === 'missed' ? false : '');
        if (typeof v === 'string' && v.length > 10000)
            throw Error('字段过长');
    }
    if (resource === 'temperatures') {
        date(out.measuredAt, true);
        number(out.value, 30, 45);
        if (Math.abs(out.value * 10 - Math.round(out.value * 10)) > 1e-6)
            throw Error('体温仅支持一位小数');
        if (!['腋温', '口温', '耳温', '其他'].includes(out.method))
            throw Error('测量方式无效');
        if (!Array.isArray(out.symptoms) || out.symptoms.some((s) => typeof s !== 'string'))
            throw Error('症状格式无效');
    }
    if (resource === 'medications') {
        required(out.name);
        required(out.unit);
        required(out.route);
        number(out.dose, 0.000001);
        number(out.frequency, 1, 100);
        if (!Number.isInteger(out.frequency))
            throw Error('每日次数需为整数');
        date(out.startDate);
        if (out.endDate) {
            date(out.endDate);
            if (out.endDate < out.startDate)
                throw Error('结束日期不能早于开始日期');
        }
    }
    if (resource === 'medicationLogs') {
        required(out.medicationId);
        date(out.occurredAt, true);
        number(out.dose, out.missed ? 0 : 0.000001);
        if (typeof out.missed !== 'boolean')
            throw Error('漏服状态无效');
    }
    if (resource === 'labs') {
        date(out.testedAt);
        required(out.name);
        required(out.unit);
        number(out.value, 0);
    }
    if (resource === 'events') {
        date(out.occurredAt, true);
        required(out.title);
    }
    for (const f of exports.definitions[resource].fields)
        if (!['value', 'dose', 'frequency', 'missed', 'symptoms'].includes(f) && typeof out[f] !== 'string')
            throw Error('文本字段格式无效');
    return out;
}
function validateBackup(b) {
    if (!b || b.backupVersion !== 1 || typeof b.exportedAt !== 'string')
        throw Error('备份版本或结构不支持');
    const out = { backupVersion: 1, exportedAt: b.exportedAt };
    for (const k of Object.keys(exports.definitions)) {
        if (!Array.isArray(b[k]) || b[k].length > 10000)
            throw Error('备份缺少记录列表或过大');
        const ids = new Set();
        out[k] = b[k].map((x) => {
            if (typeof x.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(x.id) || ids.has(x.id))
                throw Error('备份记录 ID 无效或重复，仅支持字母、数字、下划线和短横线');
            ids.add(x.id);
            return { id: x.id, ...validateRecord(k, x) };
        });
    }
    const ids = new Set(out.medications.map((m) => m.id));
    if (out.medicationLogs.some((l) => !ids.has(l.medicationId)))
        throw Error('服药记录缺少对应方案');
    return out;
}
