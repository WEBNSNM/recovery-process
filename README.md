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
# 安装依赖（首次使用或依赖变更时执行）
npm install
# 初始化电脑上的本地数据库（首次运行需要）
npm run db:migrate:local
# 构建 H5 并启动本地接口，终端保持运行
npm run worker:dev
```

打开 http://127.0.0.1:8787 。Worker 同时提供生产前端与 API。本地 D1 位于本项目 `.wrangler/state/`，与 `D:\project\TheChosenOne` 完全独立。

若需要 Vite 热更新，在第二个终端运行：

```powershell
# 启动 H5 热更新服务，只用于浏览器开发
npm run dev
```

Vite 默认地址 http://localhost:5173 ，`/api` 代理至 8787。Worker 不运行时会明确报错，**不会偷偷回退到浏览器另一份健康数据**。

## 微信开发者工具

**如果 Cloudflare 已部署，你只需要在项目根目录终端执行以下命令，然后在微信开发者工具点击「编译」。**

```powershell
# 安装项目依赖；首次使用或依赖变更时执行
npm install
# 生成微信小程序共用的报告、校验逻辑；完成后终端可以关闭
npm run build:mini
```

接着把 `miniprogram/app.js` 中的 `apiBase` 改为已部署的 HTTPS Worker 地址，在微信开发者工具导入项目根目录 `D:\project\recovery-process`，点击「编译」运行。小程序中「家庭数据连接设置 → 访问密钥」填你已保存到 Cloudflare 的密钥值。

`npm run build:mini` 负责生成共享模块；小程序界面由微信开发者工具编译运行。使用已部署接口时，无需启动本地服务。`npm run dev` 用于 H5，`npm run deploy` 用于更新 Cloudflare 后端和 H5，小程序上传通过开发者工具右上角「上传」完成。

如果要在模拟器中使用本地接口，先执行本节上方「本地运行」的三个命令，并保持 `npm run worker:dev` 运行，将 `apiBase` 设为 `http://127.0.0.1:8787`。真机预览和体验版请使用已部署的 HTTPS 接口。

1. 在开发者工具导入本项目根目录，工具自动读取 `project.config.json`，原生源码在 `miniprogram/`。
2. 默认 `touristappid` 用于本地体验；预览/发布需替换成自己的微信小程序 AppID。
3. 根据上面的运行方式配置 `apiBase`；使用本地接口时需启动本地 Worker。模拟器本地调试不校验合法域名。
4. 真机/正式发布时，把 `apiBase` 改为自己的 HTTPS Worker 域名，并在微信后台配置 request 合法域名。真机的 127.0.0.1 是手机本身，不是电脑。
5. 公网接口需在首页填写家庭访问密钥；本地 127.0.0.1 开发可留空。密钥只由当前设备保存，不写进前端构建产物。
6. 调整公共报告/验证逻辑后运行 `npm run build:mini` 更新原生共享模块。

原生版提供日期时间选择器、体温/处方/实际执行/化验编辑删除、Canvas 趋势、共用时间线、文字报告复制、JSON 导出与导入确认。导出文件仅在用户主动操作时打开微信文件分享界面；不会自动发送。

## Cloudflare 部署（需要你自己的账号）

下面是一套从零部署的顺序。需要 Cloudflare 账号、Node.js 22.12+，并在项目根目录执行。**不要复用其他项目的 D1 ID**；`wrangler.jsonc` 中的全零 ID 只是本地开发占位。

1. 安装依赖，登录并确认当前账号：

   ```powershell
   # 安装依赖（首次使用或依赖变更时执行）
   npm install
   # 打开浏览器登录 Cloudflare；登录失效时重新执行
   npx wrangler login
   # 查看当前登录账号，确认部署到正确账号
   npx wrangler whoami
   ```

2. 创建本项目专用的 D1 数据库：

   ```powershell
   # 创建远端数据库（首次部署执行，已有数据库无需重复创建）
   npx wrangler d1 create kangcheng-record
   ```

   将命令输出的 `database_id` 填入 `wrangler.jsonc` 的 `d1_databases[0].database_id`。保留 `database_name` 为 `kangcheng-record`、binding 为 `DB`。部署前可以用下面的命令检查配置：

   ```powershell
   # 查看账号下的数据库名称和真实 UUID，用于填写 database_id
   npx wrangler d1 list
   ```

3. 先把迁移应用到远端 D1（迁移脚本会自动建表，不要手工建表）：

   ```powershell
   # 将尚未执行的迁移应用到 Cloudflare D1；首次部署或新增迁移时执行
   npm run db:migrate:remote
   ```

4. 设置公网接口的家庭访问密钥。输入时不会回显，建议使用密码管理器生成至少 32 位随机字符串：

   ```powershell
   # 创建或替换家庭访问密钥；DATA_ACCESS_KEY 是固定名称，不要改成密钥值
   # 运行后在 Enter a secret value 提示处输入你生成的密钥
   npx wrangler secret put DATA_ACCESS_KEY
   ```

   密钥设置成功后立即生效，无需重新部署；日常部署也无需重复设置。替换密钥会使旧值失效，所有设备都要更新「访问密钥」。忘记密钥可生成新值后用同一命令替换，数据库记录不受影响。建议使用随机英文、数字密钥，避免中文在 HTTP 请求头中导致请求失败。

5. 构建前端并部署 Worker：

   ```powershell
   # 构建 H5 并部署 Worker/API 到 Cloudflare；首次部署或代码更新时执行
   npm run deploy
   ```

   命令完成后，打开 Wrangler 输出的 `https://<worker>.<account>.workers.dev` 地址，在连接设置中输入家庭访问密钥并确认数据能加载。直接访问 `/api/health` 也需要携带 `x-data-key` 请求头，否则返回 401。将这个 **HTTPS** 地址记下来，下一节要写入小程序的 `apiBase`。

后续修改 Worker 或前端时，重复 `npm run deploy` 即可；修改数据库结构时先新增迁移文件，再运行 `npm run db:migrate:remote`。`DATA_ACCESS_KEY` 不写入代码、不提交 Git，也不要放到小程序包里。未配置密钥时公网数据接口返回 503；密钥不符返回 401。Cloudflare 自定义域名可在 Dashboard 的 Workers & Pages 中绑定，绑定后把小程序 `apiBase` 和微信合法域名一起改成该 HTTPS 域名。

## 微信小程序发布体验版

体验版发布需要你拥有小程序 AppID 的管理员或开发者权限，并能登录微信开发者工具。Cloudflare Worker 已部署后，按以下顺序操作：

1. 在 `miniprogram/app.js` 把 `apiBase` 改成上一步的 HTTPS Worker 地址（末尾不要加 `/`），并运行 `npm run build:mini` 确保共享逻辑是最新的。
2. 打开 `project.config.json`，把 `appid` 从 `touristappid` 换成真实小程序 AppID。不要把 `DATA_ACCESS_KEY` 写进 `app.js`；密钥由用户在小程序连接设置中输入。
3. 登录微信开发者工具，导入本项目根目录 `D:\project\recovery-process`，确认项目目录仍为 `miniprogram/`。工具右上角的 AppID 应与 `project.config.json` 一致。
4. 在微信公众平台「开发管理 → 开发设置 → 服务器域名」加入 Worker 的 HTTPS 域名到 **request 合法域名**。域名必须是 HTTPS，不能填 `127.0.0.1`、`localhost` 或带路径的 URL。保存后回到开发者工具重新编译。
5. 在模拟器中输入家庭访问密钥，验证首页、体温/用药/化验保存、趋势和导入导出；再用「预览」扫码在真机验证。真机不能访问电脑的 `127.0.0.1`。
6. 点击开发者工具右上角「上传」，填写版本号（例如 `1.0.0`）和项目备注，确认上传。然后进入微信公众平台「版本管理」，在开发版本中点击「提交审核」前的「设为体验版」/「体验版」入口。
7. 在「成员管理」中把测试微信号加入体验成员，使用体验版二维码打开。体验版只对成员生效；后续代码更新需要重新上传并重新设为体验版。

发布前检查：Worker 数据接口携带家庭密钥可访问、request 合法域名已生效、`apiBase` 是 HTTPS、真实 AppID 已配置、家庭访问密钥可用。微信开发者工具登录、上传和设置体验成员需要使用你的微信账号完成。

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
# 终端一：启动本地接口,修改前端代码可在微信开发者工具编译查看
npm run worker:dev
# 运行自动化单元测试，不启动服务也不部署
npm test
# 检查后端 TypeScript 类型，不启动服务也不部署
npm run check:server
# 检查 H5 类型并生成 dist/，不部署、不启动微信小程序
npm run build
# 生成小程序共享模块，随后在开发者工具点击「编译」
npm run build:mini
# 本地 Worker 正在运行时，验证真实本地 D1 接口及备份恢复
npm run test:api
```

已通过 TypeScript/Vite 构建、Worker 类型检查、自动化验证与本地真实 D1 CRUD/历史调整/备份往返测试。H5 已实测保存、回填与更新。原生入口做了 JS 语法、事件绑定、表单逻辑检查；尚未在微信开发者工具模拟器/真机中完成编译验证。
