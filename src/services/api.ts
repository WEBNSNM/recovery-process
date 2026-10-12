import type { Backup } from '../types';
async function req(path: string, init?: RequestInit) { const r = await fetch('/api' + path, { ...init, headers: { 'content-type': 'application/json', 'x-data-key': sessionStorage.getItem('kangcheng-access-key') || '' } }); const body = await r.json().catch(() => ({ error: '接口不可用，请启动 Worker 并初始化数据库' })); if (!r.ok)
    throw Error(body.error || '请求失败'); return body; }
export async function list<T>(resource: string): Promise<T[]> { return (await req('/' + resource)).data; }
export async function write<T>(resource: string, method: string, payload: T, id?: string) { return (await req('/' + resource + (id ? '/' + encodeURIComponent(id) : ''), { method, body: method === 'DELETE' ? undefined : JSON.stringify(payload) })).data; }
export async function backup(): Promise<Backup> { return req('/export'); }
export async function restore(raw: string) { return req('/import', { method: 'POST', body: raw }); }
