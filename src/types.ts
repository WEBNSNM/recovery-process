export type Temperature = {
    id: string;
    measuredAt: string;
    value: number;
    method: string;
    symptoms: string[];
    note: string;
};
export type Medication = {
    id: string;
    name: string;
    spec: string;
    unit: string;
    dose: number;
    frequency: number;
    route: string;
    startDate: string;
    endDate?: string;
    note: string;
};
export type MedicationLog = {
    id: string;
    medicationId: string;
    occurredAt: string;
    dose: number;
    missed: boolean;
    note: string;
};
export type Lab = {
    id: string;
    testedAt: string;
    name: string;
    value: number;
    unit: string;
    reference: string;
    hospital: string;
    note: string;
};
export type Event = {
    id: string;
    occurredAt: string;
    title: string;
    detail: string;
};
export type Backup = {
    backupVersion: number;
    exportedAt: string;
    temperatures: Temperature[];
    medications: Medication[];
    medicationLogs: MedicationLog[];
    labs: Lab[];
    events: Event[];
};
export const symptoms = ['畏寒', '肌肉酸痛', '关节痛', '皮疹', '咳嗽', '乏力', '其他'];
export const labNames = ['铁蛋白 Ferritin', 'CRP', '血沉 ESR', '白细胞 WBC', '中性粒细胞', '血红蛋白 Hb', '血小板 PLT', 'ALT', 'AST', 'LDH', '甘油三酯 TG', '纤维蛋白原'];
