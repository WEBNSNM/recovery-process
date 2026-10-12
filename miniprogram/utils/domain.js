"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeNow = exports.dayNow = void 0;
exports.inRange = inRange;
exports.medicationDays = medicationDays;
exports.dailyMax = dailyMax;
exports.report = report;
exports.cloneRecord = cloneRecord;
const dayNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
exports.dayNow = dayNow;
const timeNow = () => `${(0, exports.dayNow)()}T${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
exports.timeNow = timeNow;
function inRange(date, from, to) { const day = date.slice(0, 10); return day >= from && day <= to; }
function medicationDays(m, today = (0, exports.dayNow)()) { const end = m.endDate && m.endDate < today ? m.endDate : today; return Math.max(0, Math.round((Date.parse(end) - Date.parse(m.startDate)) / 86400000) + 1); }
function dailyMax(records) {
    const result = {};
    for (const t of records) {
        const d = t.measuredAt.slice(0, 10);
        result[d] = Math.max(result[d] ?? 0, t.value);
    }
    return result;
}
function report(b, from, to) {
    const temperatures = b.temperatures.filter(t => inRange(t.measuredAt, from, to));
    const meds = b.medications.filter(m => m.startDate <= to && (!m.endDate || m.endDate >= from));
    const lines = [`康程病程报告：${from} 至 ${to}`, '每日最高体温：', ...Object.entries(dailyMax(temperatures)).sort().map(([d, v]) => `${d}：${v.toFixed(1)}℃`), '异常体温记录：', ...temperatures.filter(t => t.value >= 37.3 || t.value < 36).map(t => `${t.measuredAt.replace('T', ' ')}：${t.value}℃ ${t.method} ${t.note}`), '用药方案：', ...meds.map(m => `${m.name}（${m.spec}）：${m.dose}${m.unit}/次，每日${m.frequency}次，${m.route}；${m.startDate} 至 ${m.endDate || '持续中'}；${m.note}`), '实际服药/输液记录：', ...b.medicationLogs.filter(l => inRange(l.occurredAt, from, to)).map(l => `${l.occurredAt} ${b.medications.find(m => m.id === l.medicationId)?.name || '未知药物'}：${l.missed ? '漏服' : l.dose + (b.medications.find(m => m.id === l.medicationId)?.unit || '')} ${l.note}`), '主要症状与备注：', ...temperatures.filter(t => t.symptoms.length || t.note).map(t => `${t.measuredAt}：${t.symptoms.join('、')} ${t.note}`), '化验：', ...b.labs.filter(l => inRange(l.testedAt, from, to)).map(l => `${l.testedAt} ${l.name}：${l.value} ${l.unit}；参考 ${l.reference || '未填'}；${l.hospital} ${l.note}`), '重要病程事件：', ...b.events.filter(e => inRange(e.occurredAt, from, to)).map(e => `${e.occurredAt} ${e.title}：${e.detail}`), '此摘要仅供记录与复诊沟通，不自动诊断或推荐用药。'];
    return lines.join('\n');
}
function cloneRecord(value) { return JSON.parse(JSON.stringify(value)); }
