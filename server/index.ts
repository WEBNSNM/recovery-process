import { definitions, column, validateRecord, validateBackup, type Resource } from './schema';
interface Statement {
    bind(...args: any[]): Statement;
    all(): Promise<{
        results: any[];
    }>;
    first(): Promise<any>;
    run(): Promise<any>;
}
interface Env {
    DB: {
        prepare(sql: string): Statement;
        batch(statements: Statement[]): Promise<any>;
    };
    ASSETS: {
        fetch(req: Request): Promise<Response>;
    };
    DATA_ACCESS_KEY?: string;
}
const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const resources = Object.keys(definitions) as Resource[];
function decode(k: Resource, x: any) { const out: any = { id: x.id, schemaVersion: x.schema_version }; for (const f of definitions[k].fields)
    out[f] = f === 'symptoms' ? JSON.parse(x[column(f)] || '[]') : f === 'missed' ? !!x[column(f)] : x[column(f)] ?? ''; return out; }
function insert(env: Env, k: Resource, x: any) { const fields = ['id', ...definitions[k].fields, 'schemaVersion']; return env.DB.prepare(`INSERT INTO ${definitions[k].table} (${fields.map(column).join(',')}) VALUES (${fields.map(() => '?').join(',')})`).bind(...fields.map(f => f === 'symptoms' ? JSON.stringify(x[f]) : f === 'missed' ? Number(x[f]) : x[f])); }
async function all(env: Env, k: Resource) { return (await env.DB.prepare(`SELECT * FROM ${definitions[k].table} ORDER BY rowid DESC`).all()).results.map(x => decode(k, x)); }
export default { async fetch(req: Request, env: Env): Promise<Response> {
        const url = new URL(req.url);
        if (!url.pathname.startsWith('/api/'))
            return env.ASSETS.fetch(req);
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (!local && !env.DATA_ACCESS_KEY)
            return json({ error: '部署尚未配置家庭数据访问密钥' }, 503);
        if (env.DATA_ACCESS_KEY && req.headers.get('x-data-key') !== env.DATA_ACCESS_KEY)
            return json({ error: '请配置正确的家庭数据访问密钥' }, 401);
        try {
            const [, , name, encodedId] = url.pathname.split('/');
            const rid = encodedId ? decodeURIComponent(encodedId) : undefined;
            if (name === 'health')
                return json({ ok: true, schemaVersion: 1 });
            if (name === 'dashboard' && req.method === 'GET') {
                const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10), temperatures = await all(env, 'temperatures'), medications = await all(env, 'medications'), labs = await all(env, 'labs');
                const latest = temperatures.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0] || null;
                return json({ data: { todayMax: Math.max(0, ...temperatures.filter(t => t.measuredAt.startsWith(today)).map(t => t.value)) || null, latestTemperature: latest, currentMedications: medications.filter(m => m.startDate <= today && (!m.endDate || m.endDate >= today)), latestLabs: labs.sort((a, b) => b.testedAt.localeCompare(a.testedAt)).filter(l => l.testedAt === labs[0]?.testedAt) } });
            }
            if (name === 'export' && req.method === 'GET') {
                const b: any = { backupVersion: 1, exportedAt: new Date().toISOString() };
                for (const k of resources)
                    b[k] = await all(env, k);
                return json(b);
            }
            if (name === 'import' && req.method === 'POST') {
                const b = validateBackup(await req.json());
                const statements: Statement[] = [];
                for (const k of [...resources].reverse())
                    statements.push(env.DB.prepare(`DELETE FROM ${definitions[k].table}`));
                for (const k of resources)
                    for (const x of b[k])
                        statements.push(insert(env, k, x));
                await env.DB.batch(statements);
                return json({ ok: true });
            }
            const k = (name === 'medication-logs' ? 'medicationLogs' : name) as Resource;
            if (!resources.includes(k))
                return json({ error: '接口不存在' }, 404);
            const table = definitions[k].table;
            if (req.method === 'GET') {
                if (rid) {
                    const x = await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(rid).first();
                    return x ? json({ data: decode(k, x) }) : json({ error: '记录不存在' }, 404);
                }
                return json({ data: await all(env, k) });
            }
            if (!['POST', 'PUT', 'DELETE'].includes(req.method))
                return json({ error: '方法不支持' }, 405);
            if (req.method !== 'POST' && (!rid || !await env.DB.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(rid).first()))
                return json({ error: '记录不存在' }, 404);
            if (req.method === 'DELETE') {
                const statements = [];
                if (k === 'medications')
                    statements.push(env.DB.prepare('DELETE FROM medication_logs WHERE medication_id=?').bind(rid));
                statements.push(env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(rid));
                await env.DB.batch(statements);
                return json({ ok: true });
            }
            const body: any = await req.json();
            const x = { id: rid || crypto.randomUUID(), ...validateRecord(k, body) };
            if (k === 'medicationLogs' && !await env.DB.prepare('SELECT id FROM medications WHERE id=?').bind(x.medicationId).first())
                return json({ error: '用药方案不存在' }, 400);
            const statements: Statement[] = [];
            let medicationEventDate = x.startDate;
            let medicationEventTitle = '开始用药：';
            if (req.method === 'PUT' && k === 'medications') {
                const old = decode(k, await env.DB.prepare('SELECT * FROM medications WHERE id=?').bind(rid).first());
                const changed = ['name', 'spec', 'unit', 'dose', 'frequency', 'route'].some(f => old[f] !== x[f]);
                medicationEventDate = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
                medicationEventTitle = '修正用药方案：';
                if (changed && body.changeMode !== 'correction') {
                    const effective = body.effectiveDate || new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
                    medicationEventDate = effective;
                    medicationEventTitle = '调整用药：';
                    validateRecord('medications', { ...x, startDate: effective });
                    if (effective < old.startDate)
                        throw Error('调整生效日期不能早于原方案开始日期');
                    if (effective > old.startDate) {
                        const previous = new Date(Date.parse(effective) - 86400000).toISOString().slice(0, 10);
                        const archive = { ...old, id: crypto.randomUUID(), endDate: old.endDate && old.endDate < previous ? old.endDate : previous };
                        statements.push(insert(env, k, archive));
                        statements.push(env.DB.prepare('UPDATE medication_logs SET medication_id=? WHERE medication_id=? AND substr(occurred_at,1,10)<?').bind(archive.id, rid, effective));
                        x.startDate = effective;
                    }
                }
                if (!changed && x.endDate && x.endDate !== old.endDate) {
                    medicationEventDate = x.endDate;
                    medicationEventTitle = '停用药物：';
                }
            }
            if (req.method === 'PUT')
                statements.push(env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(rid));
            statements.push(insert(env, k, x));
            if (k === 'medications')
                statements.push(insert(env, 'events', { id: crypto.randomUUID(), schemaVersion: 1, occurredAt: medicationEventDate + 'T00:00', title: medicationEventTitle + x.name, detail: `${x.dose}${x.unit}，每日${x.frequency}次；${x.startDate} 至 ${x.endDate || '持续中'}；${x.note}` }));
            await env.DB.batch(statements);
            return json({ data: x }, req.method === 'POST' ? 201 : 200);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : '请求失败';
            return json({ error: message.includes('D1') || message.includes('SQL') ? '数据库操作失败，请检查迁移与配置' : message }, 400);
        }
    } };
