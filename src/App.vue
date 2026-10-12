<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { list, write, backup, restore } from './services/api';
import type { Backup, Temperature, Medication, Lab, MedicationLog, Event as CourseEvent } from './types';
import { symptoms, labNames } from './types';
import { dayNow, timeNow, inRange, medicationDays, report, cloneRecord } from './domain';
import LineChart from './LineChart.vue';
const validPages = ['home', 'temperature', 'medication', 'lab', 'trend'];
const initialPage = location.hash.slice(1);
const page = ref(validPages.includes(initialPage) ? initialPage : 'home'), temps = ref<Temperature[]>([]), meds = ref<Medication[]>([]), labs = ref<Lab[]>([]), logs = ref<MedicationLog[]>([]), events = ref<CourseEvent[]>([]);
const loading = ref(false), busy = ref(false), error = ref(''), toast = ref(''), editId = ref('');
const blankTemp = () => ({ measuredAt: timeNow(), value: '' as number | string, method: '腋温', symptoms: [] as string[], note: '' });
const blankMed = () => ({ name: '', spec: '', unit: '片', dose: '' as number | string, frequency: 1, route: '口服', startDate: dayNow(), endDate: '', note: '', effectiveDate: dayNow(), changeMode: 'adjustment' });
const blankLab = () => ({ testedAt: dayNow(), name: labNames[0], value: '' as number | string, unit: '', reference: '', hospital: '', note: '' });
const tempForm = ref(blankTemp()), medForm = ref(blankMed()), labForm = ref(blankLab()), logForm = ref({ medicationId: '', occurredAt: timeNow(), dose: '' as number | string, missed: false, note: '' }), eventForm = ref({ occurredAt: timeNow(), title: '', detail: '' });
const selectedLab = ref(''), from = ref(dayNow()), to = ref(dayNow());
function range(days: number) { const d = new Date(dayNow() + 'T00:00:00'); d.setDate(d.getDate() - days + 1); from.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; to.value = dayNow(); }
range(7);
function msg(s: string) { toast.value = s; setTimeout(() => toast.value = '', 2500); }
async function reload() { loading.value = true; error.value = ''; try {
    [temps.value, meds.value, labs.value, logs.value, events.value] = await Promise.all([list<Temperature>('temperatures'), list<Medication>('medications'), list<Lab>('labs'), list<MedicationLog>('medicationLogs'), list<CourseEvent>('events')]);
}
catch (e) {
    error.value = (e as Error).message;
}
finally {
    loading.value = false;
} }
onMounted(() => { reload(); window.addEventListener('hashchange', () => { const next = location.hash.slice(1); if (validPages.includes(next) && next !== page.value)
    go(next); }); });
watch(page, p => { if (location.hash.slice(1) !== p)
    location.hash = p; });
const accessKey = ref(sessionStorage.getItem('kangcheng-access-key') || '');
function connect() { sessionStorage.setItem('kangcheng-access-key', accessKey.value); reload(); }
async function action(fn: () => Promise<void>) { if (busy.value)
    return; busy.value = true; error.value = ''; try {
    await fn();
}
catch (e) {
    error.value = (e as Error).message;
}
finally {
    busy.value = false;
} }
function go(p: string) { page.value = p; editId.value = ''; tempForm.value = blankTemp(); medForm.value = blankMed(); labForm.value = blankLab(); }
async function persist(resource: string, payload: any) { await action(async () => { await write(resource, editId.value ? 'PUT' : 'POST', payload, editId.value || undefined); editId.value = ''; tempForm.value = blankTemp(); medForm.value = blankMed(); labForm.value = blankLab(); await reload(); msg('保存成功'); }); }
function edit(resource: string, record: any) { editId.value = record.id; if (resource === 'temperatures')
    tempForm.value = cloneRecord(record); if (resource === 'medications')
    medForm.value = { ...cloneRecord(record), effectiveDate: dayNow(), changeMode: 'adjustment' }; if (resource === 'labs')
    labForm.value = cloneRecord(record); window.scrollTo({ top: 0, behavior: 'smooth' }); }
async function del(resource: string, id: string) { if (confirm(resource === 'medications' ? '删除该用药方案及对应实际执行记录？' : '确定删除这条记录吗？'))
    await action(async () => { await write(resource, 'DELETE', {}, id); await reload(); msg('已删除'); }); }
async function addLog() { await action(async () => { await write('medicationLogs', 'POST', { ...logForm.value, dose: Number(logForm.value.dose) }); logForm.value = { medicationId: '', occurredAt: timeNow(), dose: '', missed: false, note: '' }; await reload(); msg('执行记录已保存'); }); }
async function addEvent() { await action(async () => { await write('events', 'POST', eventForm.value); eventForm.value = { occurredAt: timeNow(), title: '', detail: '' }; await reload(); msg('事件已保存'); }); }
async function exportBackup() { await action(async () => { const b = await backup(); const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `kangcheng-${dayNow()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }); }
async function importBackup(e: globalThis.Event) { const target = e.target as HTMLInputElement; const f = target.files?.[0]; if (f && confirm('恢复会替换所有现有数据，请先备份。确定继续？'))
    await action(async () => { await restore(await f.text()); await reload(); msg('恢复完成'); }); target.value = ''; }
const latest = computed(() => [...temps.value].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0]);
const maxToday = computed(() => Math.max(0, ...temps.value.filter(x => x.measuredAt.startsWith(dayNow())).map(x => x.value)));
const activeMeds = computed(() => meds.value.filter(m => m.startDate <= dayNow() && (!m.endDate || m.endDate >= dayNow())));
const sortedTemps = computed(() => [...temps.value].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)));
const sortedLabs = computed(() => [...labs.value].sort((a, b) => b.testedAt.localeCompare(a.testedAt)));
const labKeys = computed(() => Array.from(new Set(labs.value.map(l => JSON.stringify([l.name, l.unit])))));
const chartLabs = computed(() => labs.value.filter(l => JSON.stringify([l.name, l.unit]) === (selectedLab.value || labKeys.value[0]) && inRange(l.testedAt, from.value, to.value)));
const chartTemps = computed(() => temps.value.filter(t => inRange(t.measuredAt, from.value, to.value)).map(t => ({ date: t.measuredAt, value: t.value })));
const timeline = computed(() => [...events.value.filter(e => inRange(e.occurredAt, from.value, to.value)).map(e => ({ id: e.id, resource: 'events', date: e.occurredAt, title: e.title, detail: e.detail })), ...temps.value.filter(t => inRange(t.measuredAt, from.value, to.value) && t.symptoms.length).map(t => ({ id: t.id, resource: 'temperatures', date: t.measuredAt, title: t.symptoms.join('、'), detail: t.note }))].sort((a, b) => a.date.localeCompare(b.date)));
const summary = computed(() => report({ backupVersion: 1, exportedAt: '', temperatures: temps.value, medications: meds.value, medicationLogs: logs.value, labs: labs.value, events: events.value }, from.value, to.value));
async function copyReport() { await action(async () => { await navigator.clipboard.writeText(summary.value); msg('报告已复制'); }); }
</script>
<template>
<div class="app">
<header>
<div>
<small>家庭病程记录 · MVP</small>
<h1>康程记录</h1>
</div>
<button @click="exportBackup" :disabled="busy">备份</button>
</header>
<div v-if="error" class="notice error" role="alert">{{error}} <button @click="reload">重试</button>
</div>
<p v-if="loading" class="empty">正在读取数据库…</p>
<details class="connection">
<summary>家庭数据连接设置</summary>
<label>访问密钥<input type="password" v-model="accessKey" autocomplete="off" placeholder="本地开发无需填写">
</label>
<button @click="connect">连接</button>
</details>
<main v-if="!loading">
<section v-if="page==='home'">
<div class="notice">通过接口保存至本项目独立数据库。请定期备份；仅用于病程记录，不提供诊断或用药建议。</div>
<div class="cards">
<div class="card accent">
<small>今日最高体温</small>
<strong>{{maxToday?maxToday.toFixed(1)+'℃':'—'}}</strong>
</div>
<div class="card">
<small>最近体温</small>
<strong>{{latest?latest.value.toFixed(1)+'℃':'—'}}</strong>
<span>{{latest?.measuredAt.replace('T',' ')||'暂无记录'}}</span>
</div>
</div>
<div class="section-title">快捷记录</div>
<div class="quick">
<button @click="go('temperature')">＋ 记体温</button>
<button @click="go('medication')">＋ 记用药</button>
<button @click="go('lab')">＋ 记化验</button>
</div>
<div class="section-title">当前正在使用的药物</div>
<div v-if="!activeMeds.length" class="empty">暂无当前用药方案，请添加医生处方。</div>
<div v-for="m in activeMeds" :key="m.id" class="item">
<div>
<b>{{m.name}}</b>
<span>{{m.dose}}{{m.unit}} × {{m.frequency}}次/日 · {{m.route}}</span>
</div>
<em>已用 {{medicationDays(m)}} 天</em>
</div>
<div class="section-title">最近一次化验</div>
<div v-if="!labs.length" class="empty">暂无化验记录</div>
<div v-for="l in sortedLabs.filter(x=>x.testedAt===sortedLabs[0]?.testedAt)" :key="l.id" class="item">
<div>
<b>{{l.name}}</b>
<span>{{l.testedAt}} · {{l.hospital||'未填写医院'}}</span>
</div>
<em>{{l.value}} {{l.unit}}</em>
</div>
</section>
<section v-else-if="page==='temperature'">
<div class="page-head">
<h2>{{editId?'编辑体温':'体温记录'}}</h2>
<button @click="go('temperature')" v-if="editId">取消编辑</button>
</div>
<form @submit.prevent="persist('temperatures',{...tempForm,value:Number(tempForm.value)})" class="form">
<label>测量日期和时间<input v-model="tempForm.measuredAt" type="datetime-local" required>
</label>
<label>体温（℃）<input v-model="tempForm.value" type="number" step="0.1" min="30" max="45" required>
</label>
<label>测量方式<select v-model="tempForm.method">
<option>腋温</option>
<option>口温</option>
<option>耳温</option>
<option>其他</option>
</select>
</label>
<div>症状<div class="checks">
<label v-for="s in symptoms" :key="s">
<input type="checkbox" :value="s" v-model="tempForm.symptoms">{{s}}</label>
</div>
</div>
<label>备注<textarea v-model="tempForm.note">
</textarea>
</label>
<button class="primary" :disabled="busy">{{editId?'更新':'保存'}}体温</button>
</form>
<div class="section-title">历史记录（{{temps.length}}）</div>
<div v-if="!temps.length" class="empty">暂无记录，请填写上方表单。</div>
<div v-for="t in sortedTemps" :key="t.id" class="item">
<div>
<b>{{t.value.toFixed(1)}}℃ · {{t.method}}</b>
<span>{{t.measuredAt.replace('T',' ')}} · {{t.symptoms.join('、')||'无症状'}}</span>
<span>{{t.note}}</span>
</div>
<div>
<button @click="edit('temperatures',t)">编辑</button>
<button class="danger" @click="del('temperatures',t.id)">删除</button>
</div>
</div>
</section>
<section v-else-if="page==='medication'">
<div class="page-head">
<h2>{{editId?'编辑用药方案':'用药管理'}}</h2>
<button v-if="editId" @click="go('medication')">取消编辑</button>
</div>
<form @submit.prevent="persist('medications',{...medForm,dose:Number(medForm.dose),frequency:Number(medForm.frequency)})" class="form">
<div v-if="editId" class="notice">剂量或用法调整会保留此前方案；修正录入错误会修改原记录。<label>修改类型<select v-model="medForm.changeMode">
<option value="adjustment">调整方案（保留历史）</option>
<option value="correction">修正原录入错误</option>
</select>
</label>
<label v-if="medForm.changeMode==='adjustment'">调整生效日期<input v-model="medForm.effectiveDate" type="date" required>
</label>
</div>
<label>药品名称<input v-model="medForm.name" placeholder="如：甲泼尼龙" required>
</label>
<div class="row">
<label>每片/支规格<input v-model="medForm.spec" placeholder="如 4mg/片">
</label>
<label>剂量单位<input v-model="medForm.unit" required>
</label>
</div>
<div class="row">
<label>每次剂量<input v-model="medForm.dose" type="number" min="0.000001" step="any" required>
</label>
<label>每日次数<input v-model="medForm.frequency" type="number" min="1" max="100" required>
</label>
</div>
<label>途径<select v-model="medForm.route">
<option>口服</option>
<option>静脉输液</option>
<option>肌注</option>
<option>其他</option>
</select>
</label>
<div class="row">
<label>开始日期<input v-model="medForm.startDate" type="date" required>
</label>
<label>结束日期（可空）<input v-model="medForm.endDate" type="date" :min="medForm.startDate">
</label>
</div>
<label>备注及医生用法<textarea v-model="medForm.note">
</textarea>
</label>
<button class="primary" :disabled="busy">{{editId?'更新':'保存'}}用药方案</button>
</form>
<div class="section-title">处方方案</div>
<div v-if="!meds.length" class="empty">暂无用药方案</div>
<div v-for="m in meds" :key="m.id" class="item">
<div>
<b>{{m.name}} · {{medicationDays(m)}}天</b>
<span>{{m.spec}}；{{m.dose}}{{m.unit}} × {{m.frequency}}次/日 · {{m.route}}</span>
<span>{{m.startDate}} 至 {{m.endDate||'持续中'}} {{m.note}}</span>
</div>
<div>
<button @click="edit('medications',m)">编辑/停用</button>
<button class="danger" @click="del('medications',m.id)">删除</button>
</div>
</div>
<div class="section-title">实际服药 / 输液记录</div>
<form class="form" @submit.prevent="addLog">
<label>用药方案<select v-model="logForm.medicationId" required>
<option value="">请选择药品</option>
<option v-for="m in meds" :value="m.id" :key="m.id">{{m.name}}（{{m.unit}}）</option>
</select>
</label>
<label>实际时间<input v-model="logForm.occurredAt" type="datetime-local" required>
</label>
<label>实际剂量<input v-model="logForm.dose" type="number" :min="logForm.missed?0:0.000001" step="any" required>
</label>
<div class="checks">
<label>
<input v-model="logForm.missed" type="checkbox">漏服</label>
</div>
<label>备注<input v-model="logForm.note">
</label>
<button class="primary" :disabled="busy||!meds.length">保存执行记录</button>
</form>
<div v-if="!logs.length" class="empty">暂无实际执行记录</div>
<div v-for="l in [...logs].sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt))" :key="l.id" class="item">
<div>
<b>{{meds.find(m=>m.id===l.medicationId)?.name}} · {{l.missed?'漏服':l.dose+(meds.find(m=>m.id===l.medicationId)?.unit||'')}}</b>
<span>{{l.occurredAt}} {{l.note}}</span>
</div>
<button class="danger" @click="del('medicationLogs',l.id)">删除</button>
</div>
</section>
<section v-else-if="page==='lab'">
<div class="page-head">
<h2>{{editId?'编辑化验':'化验记录'}}</h2>
<button v-if="editId" @click="go('lab')">取消编辑</button>
</div>
<form @submit.prevent="persist('labs',{...labForm,value:Number(labForm.value)})" class="form">
<label>检测日期<input v-model="labForm.testedAt" type="date" required>
</label>
<label>指标名称（支持自定义）<input v-model="labForm.name" list="indicators" required>
<datalist id="indicators">
<option v-for="n in labNames" :value="n" :key="n"/>
</datalist>
</label>
<div class="row">
<label>数值<input v-model="labForm.value" type="number" min="0" step="any" required>
</label>
<label>单位<input v-model="labForm.unit" placeholder="如 ng/mL" required>
</label>
</div>
<label>参考范围<input v-model="labForm.reference">
</label>
<label>医院<input v-model="labForm.hospital">
</label>
<label>备注<textarea v-model="labForm.note">
</textarea>
</label>
<button class="primary" :disabled="busy">{{editId?'更新':'保存'}}化验</button>
</form>
<div class="section-title">记录（{{labs.length}}）</div>
<div v-if="!labs.length" class="empty">暂无化验记录</div>
<div v-for="l in sortedLabs" :key="l.id" class="item">
<div>
<b>{{l.name}}：{{l.value}} {{l.unit}}</b>
<span>{{l.testedAt}} · 参考 {{l.reference||'未填写'}} · {{l.hospital}}</span>
<span>{{l.note}}</span>
</div>
<div>
<button @click="edit('labs',l)">编辑</button>
<button class="danger" @click="del('labs',l.id)">删除</button>
</div>
</div>
</section>
<section v-else>
<div class="page-head">
<h2>趋势与病程报告</h2>
</div>
<div class="form">
<div class="quick">
<button @click="range(7)">最近7天</button>
<button @click="range(30)">最近30天</button>
</div>
<div class="row">
<label>开始日期<input v-model="from" type="date" :max="to">
</label>
<label>结束日期<input v-model="to" type="date" :min="from">
</label>
</div>
</div>
<div class="section-title">体温曲线</div>
<LineChart :points="chartTemps" unit="℃" :markers="timeline.map(e=>({date:e.date,label:e.title}))"/>
<div class="section-title">化验趋势（单指标、单单位）</div>
<div class="form">
<select :value="selectedLab||labKeys[0]" @change="selectedLab=($event.target as HTMLSelectElement).value">
<option v-for="key in labKeys" :key="key" :value="key">{{JSON.parse(key).join(' · ')}}</option>
</select>
</div>
<LineChart :points="chartLabs.map(l=>({date:l.testedAt,value:l.value}))" :unit="chartLabs[0]?.unit||''"/>
<div class="section-title">用药时间线</div>
<div v-if="!meds.length" class="empty">暂无用药时间线</div>
<div v-for="m in meds.filter(m=>m.startDate<=to&&(!m.endDate||m.endDate>=from))" :key="m.id" class="item">
<div>
<b>{{m.name}}</b>
<span>{{m.startDate}} 开始 → {{m.endDate?m.endDate+' 停用':'持续中'}}</span>
</div>
</div>
<div class="section-title">同时间轴症状与用药变更</div>
<div v-if="!timeline.length" class="empty">所选日期范围暂无症状或事件</div>
<div v-for="e in timeline" :key="e.resource+e.id" class="item">
<div>
<b>{{e.date}} {{e.title}}</b>
<span>{{e.detail}}</span>
</div>
<button v-if="e.resource==='events'" class="danger" @click="del('events',e.id)">删除</button>
</div>
<div class="section-title">添加重要事件</div>
<form class="form" @submit.prevent="addEvent">
<label>时间<input v-model="eventForm.occurredAt" type="datetime-local" required>
</label>
<label>标题<input v-model="eventForm.title" required>
</label>
<label>详情<textarea v-model="eventForm.detail">
</textarea>
</label>
<button class="primary" :disabled="busy">保存事件</button>
</form>
<div class="section-title">病程报告</div>
<div class="form">
<textarea readonly :value="summary" rows="14"/>
<button class="primary" @click="copyReport">复制文字报告</button>
</div>
<label class="upload">导入 JSON 备份（覆盖恢复）<input type="file" accept=".json,application/json" @change="importBackup">
</label>
</section>
</main>
<nav>
<button v-for="p in [['home','首页'],['temperature','体温'],['medication','用药'],['lab','化验'],['trend','趋势/报告']]" :key="p[0]" :class="{active:page===p[0]}" @click="go(p[0])">{{p[1]}}</button>
</nav>
<div v-if="toast" class="toast">{{toast}}</div>
</div>
</template>


