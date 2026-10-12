# 康程记录 MVP

前后端同仓，所有健康记录通过接口保存至本项目独立的 Cloudflare D1。提供 Vue 3 + Vite 移动端 H5 和原生微信小程序，两者复用同一后端。普通 Vue/Vite 不能直接编译成微信小程序，因此原生入口单独位于 `miniprogram/`。

## 项目目录

```text
recovery-process/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── wrangler.jsonc
├── project.config.json               微信开发者工具入口
├── src/
│   ├── main.ts
│   ├── App.vue                       首页、体温、用药、化验、趋势/报告
│   ├── LineChart.vue                 单指标/单单位 SVG 折线图
│   ├── domain.ts                     日期、用药天数、每日最高体温、病程报告
│   ├── types.ts                      统一数据字段
│   ├── styles.css
│   └── services/api.ts               接口客户端，失败显式报错
├── server/
│   ├── index.ts                      Worker CRUD、首页聚合、备份恢复
│   └── schema.ts                     字段白名单、数值/日期/版本校验
├── migrations/0001_init.sql          独立 D1 建表脚本
├── miniprogram/
│   ├── app.js                        API 地址配置
│   ├── app.json
│   ├── app.wxss
│   ├── pages/index/
│   │   ├── index.js
│   │   ├── index.json
│   │   └── index.wxml
│   └── utils/
│       ├── api.js
│       ├── domain.js                 从 src/domain.ts 生成
│       └── schema.js                 从 server/schema.ts 生成
├── scripts/
│   ├── build-mini.mjs                生成小程序共享逻辑
│   └── test-api.mjs                  真实本地 D1 集成测试，完成后恢复原数据
├── tests/
│   ├── validation.test.ts
│   ├── report.test.ts
│   ├── edit.test.ts
│   ├── miniprogram.test.ts
│   └── access.test.ts
└── docs/superpowers/
    ├── specs/2026-10-12-kangcheng-record-mvp-design.md
    └── plans/2026-10-12-kangcheng-record-mvp.md
```

## 本地运行（不需要 Cloudflare 登录）

Node.js 22.12+ 或 24.x。

```powershell
npm install
npm run db:migrate:local
npm run worker:dev
```

打开 http://127.0.0.1:8787 。Worker 同时提供生产前端与 API。本地 D1 位于本项目 `.wrangler/state/`，与 `D:\project\TheChosenOne` 完全独立。

若需要 Vite 热更新，在第二个终端运行：

```powershell
npm run dev
```

Vite 默认地址 http://localhost:5173 ，`/api` 代理至 8787。Worker 不运行时会明确报错，**不会偷偷回退到浏览器另一份健康数据**。

## 微信开发者工具

1. 在开发者工具导入本项目根目录，工具自动读取 `project.config.json`，原生源码在 `miniprogram/`。
2. 默认 `touristappid` 用于本地体验；预览/发布需替换成自己的微信小程序 AppID。
3. 启动本地 Worker；`miniprogram/app.js` 的 `apiBase` 默认 `http://127.0.0.1:8787`。模拟器本地调试不校验合法域名。
4. 真机/正式发布时，把 `apiBase` 改为自己的 HTTPS Worker 域名，并在微信后台配置 request 合法域名。真机的 127.0.0.1 是手机本身，不是电脑。
5. 公网接口需在首页填写家庭访问密钥；本地 127.0.0.1 开发可留空。密钥只由当前设备保存，不写进前端构建产物。
6. 调整公共报告/验证逻辑后运行 `npm run build:mini` 更新原生共享模块。

原生版提供日期时间选择器、体温/处方/实际执行/化验编辑删除、Canvas 趋势、共用时间线、文字报告复制、JSON 导出与导入确认。导出文件仅在用户主动操作时打开微信文件分享界面；不会自动发送。

## Cloudflare 部署（需要你自己的账号）

**需要登录并创建一个新的 D1 数据库；不用手动创建表。不要复用 TheChosenOne 的数据库 ID。** 当前配置里的全零 ID 是本地开发占位，不能用于远端部署。

```powershell
npx wrangler login
npx wrangler d1 create kangcheng-record
```

将命令返回的新 `database_id` 填入本项目 `wrangler.jsonc`，保持 `database_name: kangcheng-record` 和 binding `DB`。

```powershell
npm run db:migrate:remote
npx wrangler secret put DATA_ACCESS_KEY
npm run deploy
```

`DATA_ACCESS_KEY` 使用随机长密钥，交给家庭成员输入页面的连接设置。未配置密钥时公网数据接口返回 503；密钥不符返回 401。本地密钥可选。没有个人账号、微信登录、推送或复杂权限系统，所有持有该家庭密钥的人访问同一家庭数据集。

部署前请确认数据库 ID 是**新项目的 ID**。本次开发只运行本项目的本地迁移，未登录、创建远端数据库或部署，也未修改参考项目。

## 已实现

- 首页：今日最高/最近体温、有效用药及使用天数、最近一次化验、快捷录入。
- 体温：日期时间、一位小数、测量方式、症状、备注；倒序列表、编辑、确认删除。
- 用药：处方与实际服药/输液分离，漏服记录；结束日期、医生用法；调整生效日期与历史方案保留。
- 化验：所有要求的常用指标及任意自定义指标、单位、范围、医院；新增编辑删除。
- 趋势：7 天/30 天/自定义日期、单指标单单位折线、用药与重要症状/事件时间线。
- 报告：日期范围内每日最高体温、异常记录、用药剂量/区间、症状、执行、化验和事件；可复制。
- 备份：顶层 `backupVersion: 1`，每条记录 `schemaVersion: 1`；完整结构、ID、关联校验，确认覆盖后 D1 batch 原子恢复。

调整用药默认归档旧方案至生效日前一天，并将此前执行记录保留关联旧方案，防止历史报告出现新剂量。若只是录入错误，选择“修正原录入错误”。同日起始日期的调整直接修正当日方案。删除药品方案会确认并同时删除对应执行记录。

数据已经按你的后续要求改为接口存储，不再满足原文“只在本机存储”的旧描述；公网部署后保存动作会上传至你配置的 Cloudflare 数据库。系统不会另行上传、自动分享或诊断/调整治疗。

## API

- `GET /api/health`、`GET /api/dashboard`
- `GET/POST /api/temperatures|medications|medicationLogs|labs|events`
- `GET/PUT/DELETE /api/<resource>/<id>`
- `GET /api/export` 返回完整备份对象
- `POST /api/import` 接收完整备份对象并原子替换

CRUD 成功返回 `{data: ...}`；错误返回 `{error: ...}`。公网请求添加 `x-data-key` 头。`medication-logs` 是兼容别名，正式字段名统一为 `medicationLogs`。导入缺失列表、错误版本、重复/非法 ID、不存在的服药方案均拒绝，不清空现有数据。

## 验证

```powershell
npm test
npm run check:server
npm run build
npm run build:mini
# Worker 正在运行时：
npm run test:api
```

已通过 TypeScript/Vite 构建、Worker 类型检查、自动化验证与本地真实 D1 CRUD/历史调整/备份往返测试。H5 已实测保存、回填与更新。原生入口做了 JS 语法、事件绑定、表单逻辑检查；当前机器未找到微信开发者工具，尚未在其模拟器/真机中编译验证。
