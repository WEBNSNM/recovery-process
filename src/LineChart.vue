<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{
    points: {
        date: string;
        value: number;
    }[];
    unit: string;
    markers?: {
        date: string;
        label: string;
    }[];
}>();
const sorted = computed(() => [...props.points].sort((a, b) => a.date.localeCompare(b.date)));
const min = computed(() => Math.min(...sorted.value.map(x => x.value)) - 0.5);
const max = computed(() => Math.max(...sorted.value.map(x => x.value)) + 0.5);
const dates = computed(() => [...sorted.value.map(p => Date.parse(p.date)), ...(props.markers || []).map(m => Date.parse(m.date))]);
function x(date: string) { const first = Math.min(...dates.value), last = Math.max(...dates.value); return 45 + (last === first ? 0.5 : (Date.parse(date) - first) / (last - first)) * 510; }
const xy = computed(() => sorted.value.map(p => ({ x: x(p.date), y: 160 - (p.value - min.value) / (max.value - min.value) * 125, ...p })));
</script>
<template>
<div class="line-chart">
<p v-if="!points.length" class="empty">所选日期范围暂无数据</p>
<template v-else>
<svg viewBox="0 0 600 210" role="img" :aria-label="'趋势图，单位 '+unit">
<g v-for="i in 4" :key="i">
<line x1="45" x2="565" :y1="35+(i-1)*42" :y2="35+(i-1)*42" stroke="#e0e8f0"/>
<text x="3" :y="40+(i-1)*42" font-size="11">{{(max-(i-1)*(max-min)/3).toFixed(1)}}</text>
</g>
<g v-for="(marker,i) in markers||[]" :key="'event'+i">
<line :x1="x(marker.date)" :x2="x(marker.date)" y1="30" y2="163" stroke="#e19b33" stroke-dasharray="4 4"/>
<circle :cx="x(marker.date)" cy="24" r="3" fill="#e19b33">
<title>{{marker.date}} {{marker.label}}</title>
</circle>
</g>
<polyline :points="xy.map(p=>`${p.x},${p.y}`).join(' ')" fill="none" stroke="#2878e8" stroke-width="3"/>
<g v-for="(p,i) in xy" :key="i">
<circle :cx="p.x" :cy="p.y" r="4" fill="#2878e8">
<title>{{p.date}}：{{p.value}} {{unit}}</title>
</circle>
<text v-if="i===0||i===xy.length-1" :x="p.x" y="192" text-anchor="middle" font-size="11">{{p.date.slice(5,10)}}</text>
</g>
<text x="48" y="18" font-size="12">{{unit}}</text>
</svg>
<p v-if="markers?.length" class="muted">橙色虚线：症状/用药变更，详情见下方时间线。</p>
</template>
</div>
</template>
