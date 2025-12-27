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

// Prefer configured HOST_STATIC_ROOT, else fallback to common server path.
let HOST_STATIC_ROOT = process.env.HOST_STATIC_ROOT || '/WWW_ROOT/static';
// If the path doesn't exist (local dev), fallback to a local directory for testing
if (!fs.existsSync(HOST_STATIC_ROOT)) {
    const localFallback = path.join(PROJECT_ROOT, 'local_static');
    HOST_STATIC_ROOT = process.env.HOST_STATIC_ROOT || localFallback;
}

const PAGES_DIR = process.env.PAGES_DIR || path.join(HOST_STATIC_ROOT, 'pages');

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
        const dataFile = path.join(PROJECT_ROOT, 'data/pages.json');
        const publicDataFile = path.join(PROJECT_ROOT, 'public/data/pages.json');

        // read existing pages
        let pages = [];
        try {
            const raw = fs.readFileSync(dataFile, 'utf8');
            pages = JSON.parse(raw);
            if (!Array.isArray(pages)) pages = [];
        } catch (e) {
            pages = [];
        }

        const stat = fs.statSync(htmlPathVar);
        const pageUrl = new URL(finalName, baseUrl).toString();
        const record = {
            url: pageUrl,
            title: providedTitle || title || path.basename(finalName),
            description: providedDescription || '',
            image: providedImage || '',
            created_at: stat.mtime.toISOString()
        };

        // upsert
        const idx = pages.findIndex((p) => p.url === record.url);
        if (idx >= 0) {
            pages[idx] = { ...pages[idx], ...record };
        } else {
            pages.push(record);
        }

        // sort and write
        pages.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        fs.mkdirSync(path.dirname(dataFile), { recursive: true });
        fs.writeFileSync(dataFile, JSON.stringify(pages, null, 2));
        fs.mkdirSync(path.dirname(publicDataFile), { recursive: true });
        fs.writeFileSync(publicDataFile, JSON.stringify(pages, null, 2));
        console.log('[upload] wrote data/pages.json and public/data/pages.json');
    } catch (err) {
        console.warn(`[upload] write-pages failed: ${err.message}`);
        return res.status(500).send('更新 pages.json 失败');
    }

    // trigger build (can be skipped for local testing by setting SKIP_BUILD=1)
    if (!['1', 'true', 'yes'].includes(String(process.env.SKIP_BUILD || '').toLowerCase())) {
        const build = spawnSync('docker', ['compose', 'run', '--rm', 'builder'], {
            cwd: PROJECT_ROOT,
            stdio: 'inherit'
        });

        if (build.status !== 0) {
            return res.status(500).send('构建失败');
        }
    } else {
        console.log('[upload] SKIP_BUILD set, skipping docker build');
    }

    const publicUrl = new URL(finalName, baseUrl).toString();
    return res.json({ ok: true, file: finalName, url: publicUrl });
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
        const dataFile = path.join(PROJECT_ROOT, 'data/pages.json');
        const publicDataFile = path.join(PROJECT_ROOT, 'public/data/pages.json');

        let pages = [];
        try {
            const raw = fs.readFileSync(dataFile, 'utf8');
            pages = JSON.parse(raw);
            if (!Array.isArray(pages)) pages = [];
        } catch (e) {
            pages = [];
        }

        const filtered = pages.filter((p) => p.url !== targetUrl);
        fs.mkdirSync(path.dirname(dataFile), { recursive: true });
        fs.writeFileSync(dataFile, JSON.stringify(filtered, null, 2));
        fs.mkdirSync(path.dirname(publicDataFile), { recursive: true });
        fs.writeFileSync(publicDataFile, JSON.stringify(filtered, null, 2));
        console.log(`[delete] updated pages.json, removed ${pages.length - filtered.length} entries`);
    } catch (err) {
        console.warn(`[delete] update pages failed: ${err.message}`);
        return res.status(500).send('更新 pages.json 失败');
    }

    if (!['1', 'true', 'yes'].includes(String(process.env.SKIP_BUILD || '').toLowerCase())) {
        const build = spawnSync('docker', ['compose', 'run', '--rm', 'builder'], {
            cwd: PROJECT_ROOT,
            stdio: 'inherit'
        });

        if (build.status !== 0) {
            return res.status(500).send('构建失败');
        }
    } else {
        console.log('[delete] SKIP_BUILD set, skipping docker build');
    }

    return res.json({ ok: true, url: targetUrl });
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
    console.log(`Upload server on http://0.0.0.0:${PORT}`);
});
// trigger build
