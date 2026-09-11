#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const file = process.env.TX_AI_NATIVE_AI_CONFIG_PATH || path.join(os.homedir(), '.config', 'tx-ai-native-ai', 'connection.env');
const tokenPattern = /^txai_[\w-]{36}\.[a-f0-9]{64}$/;
const name = value => { const n = (value || 'DEFAULT').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'); if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(n)) throw Error('连接名无效'); return n; };
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const key = (n, kind) => n === 'DEFAULT' ? `PLATFORM_${kind}` : `PLATFORM_${kind}_${n}`;
const read = () => { try { return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean); } catch (e) { if (e.code === 'ENOENT') return []; throw e; } };
const set = (lines, variable, value) => { const re = new RegExp(`^(?:export\\s+)?${variable}=`); const index = lines.findIndex(line => re.test(line)); const line = `${variable}=${quote(value)}`; if (index >= 0) lines[index] = line; else lines.push(line); };
const remove = (lines, variable) => lines.filter(line => !new RegExp(`^(?:export\\s+)?${variable}=`).test(line));
function write(lines) { const dir = path.dirname(file); fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700); const tmp = `${file}.${process.pid}.${Date.now()}.tmp`; const fd = fs.openSync(tmp, 'wx', 0o600); try { fs.writeFileSync(fd, `${lines.join('\n')}\n`); fs.fchmodSync(fd, 0o600); fs.closeSync(fd); fs.renameSync(tmp, file); fs.chmodSync(file, 0o600); } catch (e) { try { fs.closeSync(fd); } catch {} try { fs.unlinkSync(tmp); } catch {} throw e; } }
function save(args) { const n = name(args.name); const url = new URL(String(args.url || '').replace(/\/+$/, '')); const secret = String(args.token || '').trim(); if (!['http:', 'https:'].includes(url.protocol) || url.pathname.endsWith('/api/ai')) throw Error('平台根地址无效'); if (!tokenPattern.test(secret)) throw Error('Agent token 格式无效'); const lines = read(); set(lines, key(n, 'BASE_URL'), url.toString().replace(/\/$/, '')); set(lines, key(n, 'AGENT_TOKEN'), secret); set(lines, 'PLATFORM_BASE_URL', url.toString().replace(/\/$/, '')); set(lines, 'PLATFORM_AGENT_TOKEN', secret); set(lines, 'TX_AI_NATIVE_AI_DEFAULT_CONNECTION', n); write(lines); process.stdout.write('connection-saved\n'); }
function invalidate(args) { const n = name(args.name); let lines = remove(read(), key(n, 'AGENT_TOKEN')); if (n === 'DEFAULT') lines = remove(lines, 'PLATFORM_AGENT_TOKEN'); write(lines); process.stdout.write('connection-invalidated\n'); }
const args = {}; for (let i = 3; i < process.argv.length; i++) { if (process.argv[i] === '--name') args.name = process.argv[++i]; else if (process.argv[i] === '--url') args.url = process.argv[++i]; else if (process.argv[i] === '--token') args.token = process.argv[++i]; else if (process.argv[i] === '--token-stdin') args.token = fs.readFileSync(0, 'utf8').trim(); }
try { if (process.argv[2] === 'save') save(args); else if (process.argv[2] === 'invalidate') invalidate(args); else throw Error('用法：save --url URL --token-stdin [--name NAME] 或 invalidate [--name NAME]'); } catch (e) { process.stderr.write(`${e.message}\n`); process.exitCode = 1; }
