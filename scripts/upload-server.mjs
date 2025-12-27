#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import multer from 'multer';
import basicAuth from 'basic-auth';
import path from 'path';
import { spawnSync } from 'child_process';
import cors from 'cors';
import fs from 'fs';

const PORT = process.env.UPLOAD_PORT || 8787;
const PASSWORD = process.env.UPLOAD_PASSWORD || 'change-me';
const PROJECT_ROOT = process.cwd();
// In container we bind /workspace; for host docker socket we need the host path to run compose.
const HOST_PROJECT_ROOT = process.env.HOST_PROJECT_ROOT || PROJECT_ROOT;

// Prefer configured HOST_STATIC_ROOT, else fallback to common server path.
let HOST_STATIC_ROOT = process.env.HOST_STATIC_ROOT || '/WWW_ROOT/static';
// If the path doesn't exist (local dev), fallback to a local directory for testing
if (!fs.existsSync(HOST_STATIC_ROOT)) {
    const localFallback = path.join(PROJECT_ROOT, 'local_static');
    HOST_STATIC_ROOT = process.env.HOST_STATIC_ROOT || localFallback;
}

// Store uploads directly under HOST_STATIC_ROOT by default (no /pages subdir)
const PAGES_DIR = process.env.PAGES_DIR || HOST_STATIC_ROOT;
const HOST_DATA_FILE = path.join(HOST_STATIC_ROOT, 'data', 'pages.json');

// Ensure pages directory exists; if creation fails (permissions or invalid path),
// fallback to a local development directory so server can run on dev machine.
function ensurePagesDirSync(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    } catch (err) {
        console.warn(`[upload-server] cannot create configured pages dir ${dir}: ${err.message}`);
        const fallback = path.join(PROJECT_ROOT, 'local_static', 'pages');
        fs.mkdirSync(fallback, { recursive: true });
        console.warn(`[upload-server] falling back to local pages dir ${fallback}`);
        return fallback;
    }
}

const PAGES_DIR_FINAL = ensurePagesDirSync(PAGES_DIR);

// Determine base URL for generated page URLs. If pages are saved directly under the
// static root, use root base; otherwise use /pages/ base. Allow override via env BASE_URL.
const HOST_STATIC_ROOT_FINAL = fs.existsSync(process.env.HOST_STATIC_ROOT || '')
    ? process.env.HOST_STATIC_ROOT
    : (fs.existsSync(path.join(PROJECT_ROOT, 'local_static')) ? path.join(PROJECT_ROOT, 'local_static') : HOST_STATIC_ROOT);

const baseUrl = process.env.BASE_URL || (PAGES_DIR_FINAL === HOST_STATIC_ROOT_FINAL ? 'https://pages.lijie.space/' : 'https://pages.lijie.space/pages/');

function runBuild() {
    if (['1', 'true', 'yes'].includes(String(process.env.SKIP_BUILD || '').toLowerCase())) {
        console.log('[build] SKIP_BUILD set, skipping docker build');
        return { ok: true, skipped: true, message: 'SKIP_BUILD enabled' };
    }

    const cwd = HOST_PROJECT_ROOT;
    const build = spawnSync('docker', ['compose', 'run', '--rm', 'builder'], {
        cwd,
        stdio: 'inherit'
    });

    if (build.status !== 0) {
        return { ok: false, error: '构建失败', code: build.status, signal: build.signal };
    }
    return { ok: true, skipped: false };
}

function writePagesJson(targetUrl, providedTitle, providedDescription, providedImage, htmlPathVar, finalName) {
    const dataFile = path.join(PROJECT_ROOT, 'data', 'pages.json');
    const publicDataFile = path.join(PROJECT_ROOT, 'public', 'data', 'pages.json');

    let pages = [];
    try {
        const raw = fs.readFileSync(dataFile, 'utf8');
        pages = JSON.parse(raw);
        if (!Array.isArray(pages)) pages = [];
    } catch (e) {
        pages = [];
    }

    if (htmlPathVar && finalName) {
        const stat = fs.statSync(htmlPathVar);
        const recordUrl = targetUrl;
        const record = {
            url: recordUrl,
            title: providedTitle || path.basename(finalName),
            description: providedDescription || '',
            image: providedImage || '',
            created_at: stat.mtime.toISOString()
        };

        const idx = pages.findIndex((p) => p.url === record.url);
        if (idx >= 0) {
            pages[idx] = { ...pages[idx], ...record };
        } else {
            pages.push(record);
        }
    } else if (targetUrl) {
        pages = pages.filter((p) => p.url !== targetUrl);
    }

    pages.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // write project data files
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(pages, null, 2));
    fs.mkdirSync(path.dirname(publicDataFile), { recursive: true });
    fs.writeFileSync(publicDataFile, JSON.stringify(pages, null, 2));

    // also write host static data to reflect immediately without rebuild
    try {
        fs.mkdirSync(path.dirname(HOST_DATA_FILE), { recursive: true });
        fs.writeFileSync(HOST_DATA_FILE, JSON.stringify(pages, null, 2));
    } catch (err) {
        console.warn(`[pages] write host data failed: ${err.message}`);
    }

    return pages.length;
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PAGES_DIR_FINAL),
    filename: (_req, file, cb) => cb(null, file.originalname)
});

const upload = multer({ storage });
const app = express();
app.use(cors());
app.use(express.json());

function checkAuth(req, res, next) {
    const token = req.headers['x-upload-token'];
    const cred = basicAuth(req);
    const pass = cred?.pass || token;
    if (pass && pass === PASSWORD) return next();
    return res.status(401).send('Unauthorized');
}

app.post('/api/upload', checkAuth, upload.single('file'), (req, res) => {
    // allow client to provide slug/title/description
    const providedSlug = (req.body && req.body.slug) ? String(req.body.slug).trim() : '';
    const providedTitle = (req.body && req.body.title) ? String(req.body.title).trim() : '';
    const providedDescription = (req.body && req.body.description) ? String(req.body.description).trim() : '';
    const providedImage = (req.body && req.body.image) ? String(req.body.image).trim() : '';

    // optional file upload: allow pre-uploaded file via scp, using slug to locate file
    const origPath = req.file ? req.file.path : null;
    if (origPath) console.log(`[upload] received ${origPath}`);

    // sanitize and rename file according to slug if provided
    let finalName = origPath ? path.basename(origPath) : '';
    let htmlPathVar = origPath;

    function makeSafeFilename(inputSlug, originalName) {
        // ensure extension
        const ensureHtml = (s) => s.toLowerCase().endsWith('.html') ? s : s + '.html';

        if (inputSlug) {
            let s = String(inputSlug).normalize('NFKD');
            // remove control chars and replace invalid chars with '-'
            s = s.replace(/[^A-Za-z0-9._-]/g, '-');
            s = s.replace(/-+/g, '-').replace(/^[-_.]+|[-_.]+$/g, '');
            if (!s) s = `page-${Date.now()}`;
            return ensureHtml(s);
        }

        // derive from original filename
        const base = String(originalName || '').replace(/\.html$/i, '');
        // try ascii-friendly slug
        let ascii = base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
        ascii = ascii.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^[\-]+|[\-]+$/g, '');
        if (ascii) return ensureHtml(ascii.toLowerCase());

        // fallback to timestamp-based name
        return ensureHtml(`page-${new Date().toISOString().replace(/[:.TZ-]/g, '')}`);
    }

    const desiredName = makeSafeFilename(providedSlug, finalName);
    const destBase = path.join(PAGES_DIR_FINAL, desiredName);
    let dest = destBase;

    // If we have an uploaded file, avoid collisions by appending counter
    if (origPath) {
        let counter = 1;
        while (fs.existsSync(dest)) {
            const nameNoExt = desiredName.replace(/\.html$/i, '');
            dest = path.join(PAGES_DIR_FINAL, `${nameNoExt}-${counter}.html`);
            counter += 1;
        }

        try {
            if (dest !== origPath) {
                fs.renameSync(origPath, dest);
                console.log(`[upload] renamed ${origPath} -> ${dest}`);
            }
            finalName = path.basename(dest);
            htmlPathVar = dest;
        } catch (err) {
            console.warn(`[upload] rename failed: ${err.message}`);
        }
    } else {
        // no uploaded file: expect file already exists via scp at destBase
        if (!fs.existsSync(dest)) {
            return res.status(400).send('缺少文件；请先通过 scp 上传并提供 slug 对应的文件名');
        }
        finalName = path.basename(dest);
        htmlPathVar = dest;
    }

    // create or update entry in data/pages.json using provided fields (no HTML parsing)
    try {
        const pageUrl = new URL(finalName, baseUrl).toString();
        writePagesJson(pageUrl, providedTitle, providedDescription, providedImage, htmlPathVar, finalName);
        console.log('[upload] wrote pages.json (project/public/host)');
    } catch (err) {
        console.warn(`[upload] write-pages failed: ${err.message}`);
        return res.status(500).send('更新 pages.json 失败');
    }

    // trigger build (can be skipped for local testing by setting SKIP_BUILD=1)
    // upload 不再自动触发构建，交给前端按钮 /api/rebuild
    const publicUrl = new URL(finalName, baseUrl).toString();
    return res.json({ ok: true, file: finalName, url: publicUrl, buildOk: true });
});

// Upload when the HTML file is already placed on the server via scp.
// Accepts JSON body: { slug, title, description, image }
app.post('/api/upload-local', checkAuth, (req, res) => {
    const providedSlug = (req.body && req.body.slug) ? String(req.body.slug).trim() : '';
    const providedTitle = (req.body && req.body.title) ? String(req.body.title).trim() : '';
    const providedDescription = (req.body && req.body.description) ? String(req.body.description).trim() : '';
    const providedImage = (req.body && req.body.image) ? String(req.body.image).trim() : '';

    if (!providedSlug) return res.status(400).send('缺少 slug');

    const ensureHtml = (s) => s.toLowerCase().endsWith('.html') ? s : s + '.html';
    const safeSlug = ensureHtml(providedSlug.replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-'));
    const dest = path.join(PAGES_DIR_FINAL, safeSlug);

    if (!fs.existsSync(dest)) {
        return res.status(400).send('文件不存在，请先通过 scp 上传到目标目录');
    }

    try {
        const pageUrl = new URL(path.basename(dest), baseUrl).toString();
        writePagesJson(pageUrl, providedTitle, providedDescription, providedImage, dest, path.basename(dest));
        console.log('[upload-local] wrote pages.json (project/public/host)');
    } catch (err) {
        console.warn(`[upload-local] write-pages failed: ${err.message}`);
        return res.status(500).send('更新 pages.json 失败');
    }

    const publicUrl = new URL(path.basename(dest), baseUrl).toString();
    return res.json({ ok: true, file: path.basename(dest), url: publicUrl, buildOk: true });
});

app.post('/api/delete', checkAuth, (req, res) => {
    const targetUrl = (req.body && req.body.url) ? String(req.body.url).trim() : '';
    if (!targetUrl) return res.status(400).send('缺少 url');

    let filename = '';
    try {
        const parsed = new URL(targetUrl);
        filename = decodeURIComponent(path.basename(parsed.pathname || ''));
    } catch (e) {
        filename = decodeURIComponent(path.basename(targetUrl));
    }

    if (!filename) return res.status(400).send('无法解析文件名');

    const filePath = path.join(PAGES_DIR_FINAL, filename);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log(`[delete] removed file ${filePath}`);
        } catch (err) {
            console.warn(`[delete] remove failed: ${err.message}`);
            return res.status(500).send('删除文件失败');
        }
    } else {
        console.warn(`[delete] file not found ${filePath}`);
    }

    try {
        const count = writePagesJson(targetUrl, '', '', '', null, null);
        console.log(`[delete] updated pages.json, total ${count} entries`);
    } catch (err) {
        console.warn(`[delete] update pages failed: ${err.message}`);
        return res.status(500).send('更新 pages.json 失败');
    }

    // 删除不再自动触发构建，交给前端按钮 /api/rebuild
    return res.json({ ok: true, url: targetUrl, buildOk: true });
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/api/rebuild', checkAuth, (_req, res) => {
    const buildResult = runBuild();
    return res.json({ ok: buildResult.ok, skipped: buildResult.skipped || false, error: buildResult.error || null, code: buildResult.code, signal: buildResult.signal });
});

app.listen(PORT, () => {
    console.log(`Upload server on http://0.0.0.0:${PORT}`);
});
// trigger build
