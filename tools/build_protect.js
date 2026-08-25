#!/usr/bin/env node
/**
 * llm-tracker 保护性构建脚本
 *
 * 从「可读源码目录」生成「发布产物」：
 *   1. 六个页面的内联 JS 经 javascript-obfuscator 混淆压缩
 *   2. 四个原创数据 JSON 经 XOR+base64 编码（页面运行时由 fetchJ 解码）
 *
 * 用法:
 *   NODE_PATH=/Users/zhangquanhu/.workbuddy/binaries/node/workspace/node_modules \
 *     node tools/build_protect.js [SRC_DIR]
 *
 * SRC_DIR 默认为 ../_llm-tracker-src（仓库外的本地可读源码镜像）。
 * 注意：发布产物（仓库根下的六个 HTML 与四个 JSON）禁止手工编辑，
 *       一切修改在 SRC_DIR 中进行后重新运行本脚本。
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(process.argv[2] || path.join(ROOT, '..', '_llm-tracker-src'));
const KEY = 'XploreLAB#2026$Chronicle';

const PAGES = [
  'index.html',
  'models/index.html',
  'timeline/index.html',
  'chronicle/index.html',
  'hardware/index.html',
  'dgx-spark/index.html',
];
const DATA = ['chronicle.json', 'model-tech.json', 'hardware.json', 'changelog.json'];

const OPT = {
  compact: true,
  simplify: true,
  numbersToExpressions: true,
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  renameGlobals: false,          // 保留全局函数名（HTML onclick 依赖）
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  transformObjectKeys: false,
};

function encodeData(text) {
  const b = Buffer.from(text, 'utf8');
  for (let i = 0; i < b.length; i++) b[i] ^= KEY.charCodeAt(i % KEY.length);
  return b.toString('base64');
}

if (!fs.existsSync(SRC)) {
  console.error('可读源码目录不存在: ' + SRC);
  process.exit(1);
}

for (const p of PAGES) {
  const srcPath = path.join(SRC, p);
  if (!fs.existsSync(srcPath)) { console.error('缺少源文件: ' + srcPath); process.exit(1); }
  let html = fs.readFileSync(srcPath, 'utf8');
  let n = 0;
  html = html.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => {
    if (!code.trim()) return m;
    n++;
    return '<script>' + JavaScriptObfuscator.obfuscate(code, OPT).getObfuscatedCode() + '</script>';
  });
  const out = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log('obfuscated ' + p + ' (' + n + ' script blocks)');
}

for (const d of DATA) {
  const raw = fs.readFileSync(path.join(SRC, 'data', d), 'utf8');
  JSON.parse(raw); // 校验源 JSON 合法
  fs.writeFileSync(path.join(ROOT, d), encodeData(raw));
  console.log('encoded ' + d);
}

console.log('done. src = ' + SRC);
