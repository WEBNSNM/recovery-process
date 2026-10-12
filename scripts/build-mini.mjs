import fs from 'node:fs';import ts from 'typescript';
for(const [source,target] of [['src/domain.ts','miniprogram/utils/domain.js'],['server/schema.ts','miniprogram/utils/schema.js']])fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
