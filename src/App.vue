<template>
    <div class="container">
        <header class="header">
            <div>
                <h1>丽姐的静态页面部署平台</h1>
                <div class="meta" style="margin-bottom:10px;">共 {{ filteredPages.length }} 个页面</div>

                <!-- <p class="meta">轻量的静态页面索引与上传中心（纯前端）</p> -->
            </div>
            <div class="controls">
                <div class="controls-search">
                    <input v-model="search" type="search" placeholder="搜索标题或描述..." aria-label="搜索" />
                </div>
                <div class="controls-actions">
                    <select v-model="sortKey" aria-label="排序">
                        <option value="created_at">按时间（新→旧）</option>
                        <option value="title">按标题（A→Z）</option>
                    </select>
                    <button class="ghost icon-only" @click="openPagesModal" aria-label="查看当前存储">
                        <svg class="icon" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
                            <path
                                d="M133.99454446 235.06643741v698.80856259h755.60379675V235.06643741z m729.25080799 671.54685012H651.96708127v-636.10662359h211.27827118z m-244.44668848 0H407.5203928v-636.10662359h211.27827117z m-245.35541135 0H162.16498062v-636.10662359h211.278272z"
                                fill="currentColor"></path>
                            <path d="M538.8309748 350.01999209v132.21930488H484.76191171V350.01999209zM294.83864817 350.01999209v132.21930488H240.76958508V350.01999209zM784.18638613 350.47435394v132.21930487h-54.06906308V350.47435394z"
                                fill="currentColor"></path>
                            <path
                                d="M881.87418899 268.68921656l7.72415222-33.62277915L715.57774314 90.125H300.74535217L133.99454446 235.06643741l7.72415222 33.62277915zM318.46546585 118.749798h381.66397367l141.76090447 116.31663941H185.33743647z"
                                fill="currentColor"></path>
                        </svg>
                        <span class="sr-only">查看当前存储</span>
                    </button>
                    <button class="ghost icon-only" @click="triggerRebuild" :disabled="rebuilding" aria-label="手动构建">
                        <template v-if="rebuilding">
                            构建中...
                        </template>
                        <template v-else>
                            <svg class="icon" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
                                <path d="M992.544 595.296a31.968 31.968 0 0 0-45.248 0l-201.376 201.376-95.04-95.04a31.968 31.968 0 1 0-45.248 45.248l117.664 117.664a31.968 31.968 0 0 0 45.248 0l224-224a31.968 31.968 0 0 0 0-45.248zM800 352a32 32 0 0 0-32-32H256a32 32 0 0 0 0 64h512a32 32 0 0 0 32-32zM256 544a32 32 0 0 0 0 64h288a32 32 0 0 0 0-64H256z"
                                    fill="currentColor"></path>
                                <path d="M771.104 928H195.04C175.904 928 160 911.68 160 891.072V132.928C160 112.32 175.904 96 195.04 96h633.92C848.096 96 864 112.32 864 132.928v350.528a32 32 0 0 0 64 0V132.928C928 77.376 883.84 32 828.96 32H195.04C140.16 32 96 77.376 96 132.928v758.144C96 946.624 140.16 992 195.04 992h576.064a32 32 0 0 0 0-64z"
                                    fill="currentColor"></path>
                            </svg>
                            <span class="sr-only">手动构建</span>
                        </template>
                    </button>
                    <button class="ghost" @click="toggleTheme">{{ themeLabel }}</button>
                    <button class="primary" @click="openModal">上传</button>
                </div>
            </div>
        </header>

        <section v-if="showModal" class="modal-backdrop" @click.self="closeModal">
            <div class="modal">
                <div class="modal-header">
                    <h2>上传新页面</h2>
                    <button class="ghost" @click="closeModal" aria-label="关闭">✕</button>
                </div>
                <form @submit.prevent="handleUpload">
                    <div class="form-row single">
                        <input v-model="slug" type="text" placeholder="URL Slug（例如: my-page）" required />
                    </div>
                    <div class="form-row single">
                        <input v-model="title" type="text" placeholder="标题" required />
                    </div>
                    <div class="form-row single">
                        <input v-model="description" type="text" placeholder="摘要/描述" required />
                    </div>
                    <div class="form-row single">
                        <div class="image-row">
                            <input v-model="imageUrl" type="text" placeholder="首图 URL（可选，留空则不显示图片）" />
                            <button type="button" class="ghost" @click="previewImage"
                                :disabled="!imageUrl.trim()">预览</button>
                        </div>
                    </div>
                    <div class="form-row single">
                        <input type="file" accept="text/html" @change="onFileChange" required />
                    </div>
                    <div class="form-row single">
                        <button type="submit" class="primary" :disabled="uploading || !file">{{ uploading ? '上传中...' :
                            '上传' }}</button>
                    </div>
                    <p class="meta" style="margin-top:8px;">上传后会写入 JSON 并触发一次构建（可通过 SKIP_BUILD 环境变量跳过）。</p>
                    <p v-if="uploadMessage" :class="{ 'meta': true }" style="margin-top:8px;">{{ uploadMessage }}</p>
                </form>
            </div>
        </section>

        <section>
            <div class="grid">
                <PageCard v-for="page in filteredPages" :key="page.url" :page="page" @delete="openDeleteModal"
                    @edit="openEditModal" />
            </div>
        </section>

        <section v-if="showPagesModal" class="modal-backdrop" @click.self="closePagesModal">
            <div class="modal">
                <div class="modal-header">
                    <h2>当前 pages.json</h2>
                    <button class="ghost" @click="closePagesModal" aria-label="关闭">✕</button>
                </div>
                <pre class="json-view" style="max-height:60vh; overflow:auto;">{{ pagesJson }}</pre>
            </div>
        </section>

        <section v-if="showDeleteModal" class="modal-backdrop" @click.self="closeDeleteModal">
            <div class="modal">
                <div class="modal-header">
                    <h2>确认删除</h2>
                    <button class="ghost" @click="closeDeleteModal" aria-label="关闭">✕</button>
                </div>
                <div class="meta" style="margin-bottom:10px;">
                    将删除页面：<span class="url">{{ deleteTarget?.title || deleteTarget?.url }}</span>
                </div>
                <form @submit.prevent="handleDelete">
                    <div class="form-row single">
                        <button type="submit" class="danger" :disabled="deleteLoading">{{ deleteLoading ? '删除中...' : '确认删除' }}</button>
                    </div>
                    <p v-if="deleteMessage" :class="{ 'meta': true }" style="margin-top:8px;">{{ deleteMessage }}</p>
                    <p class="meta" style="margin-top:8px; color:#dc2626;">此操作不可恢复，请确认。</p>
                </form>
            </div>
        </section>

        <EditModal :visible="showEditModal" :page="editTarget" :saving="editLoading" :ai-loading="aiSummaryLoading"
            :message="editMessage" :summary-lang="summaryLang" @change-summary-lang="updateSummaryLang"
            @close="closeEditModal" @save="handleEditSave" @request-summary="handleRequestSummary" />

        <AuthModal :visible="authModalVisible" :title="authTitle" :message="authMessage" @confirm="handleAuthConfirm"
            @cancel="handleAuthCancel" />
    </div>
</template>

<script setup>
    import { computed, onMounted, ref } from 'vue';
    import AuthModal from './components/AuthModal.vue';
    import EditModal from './components/EditModal.vue';
    import PageCard from './components/PageCard.vue';

    const API_BASE = import.meta.env.VITE_API_BASE || '';
    const OPENAI_BASE = (import.meta.env.VITE_OPENAI_BASE_URL || import.meta.env.VITE_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
    const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
    const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini';

    const pages = ref([]);
    const loading = ref(false);
    const search = ref('');
    const sortKey = ref('created_at');
    const file = ref(null);
    const uploading = ref(false);
    const uploadMessage = ref('');
    const slug = ref('');
    const title = ref('');
    const description = ref('');
    const imageUrl = ref('');
    const showModal = ref(false);
    const showDeleteModal = ref(false);
    const deleteTarget = ref(null);
    const deleteMessage = ref('');
    const deleteLoading = ref(false);
    const rebuilding = ref(false);
    const pagesJson = ref('');
    const showPagesModal = ref(false);

    const showEditModal = ref(false);
    const editTarget = ref(null);
    const editLoading = ref(false);
    const aiSummaryLoading = ref(false);
    const editMessage = ref('');
    const summaryLang = ref('auto');

    const themeMode = ref(localStorage.getItem('theme-mode') || 'auto');
    const themeLabel = computed(() => {
        if (themeMode.value === 'light') return '浅色';
        if (themeMode.value === 'dark') return '深色';
        return '自动';
    });

    const authModalVisible = ref(false);
    const authTitle = ref('需要鉴权');
    const authMessage = ref('请输入操作密码');
    let authResolver = null;
    let authRejecter = null;

    const filteredPages = computed(() => {
        const keyword = search.value.trim().toLowerCase();
        let list = [...pages.value];

        if (keyword) {
            list = list.filter((p) =>
                [p.title, p.description]
                    .filter(Boolean)
                    .some((text) => text.toLowerCase().includes(keyword))
            );
        }

        list.sort((a, b) => {
            if (sortKey.value === 'title') {
                return a.title.localeCompare(b.title, 'zh-Hans');
            }
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

        return list;
    });

    function buildUrl(path) {
        return API_BASE ? `${API_BASE.replace(/\/$/, '')}${path}` : path;
    }

    function applyTheme(mode) {
        const root = document.documentElement;
        if (mode === 'light') {
            root.dataset.theme = 'light';
        } else if (mode === 'dark') {
            root.dataset.theme = 'dark';
        } else {
            delete root.dataset.theme;
        }
    }

    function toggleTheme() {
        const next = themeMode.value === 'auto' ? 'light' : themeMode.value === 'light' ? 'dark' : 'auto';
        themeMode.value = next;
        localStorage.setItem('theme-mode', next);
        applyTheme(next);
    }

    function updateSummaryLang(lang) {
        summaryLang.value = lang || 'auto';
    }

    function requestAuth(purpose = '') {
        if (authResolver) {
            authRejecter?.(new Error('新的鉴权请求已覆盖之前的请求'));
        }
        authTitle.value = '需要鉴权';
        authMessage.value = purpose ? `请为「${purpose}」输入操作密码` : '请输入操作密码';
        authModalVisible.value = true;

        return new Promise((resolve, reject) => {
            authResolver = resolve;
            authRejecter = reject;
        });
    }

    function handleAuthConfirm(password) {
        authModalVisible.value = false;
        const resolver = authResolver;
        authResolver = null;
        authRejecter = null;
        resolver?.(password);
    }

    function handleAuthCancel() {
        authModalVisible.value = false;
        authRejecter?.(new Error('用户取消鉴权'));
        authResolver = null;
        authRejecter = null;
    }

    async function fetchPages() {
        loading.value = true;
        try {
            const res = await fetch('/data/pages.json?_=' + Date.now());
            if (!res.ok) throw new Error('加载失败');
            const data = await res.json();
            pages.value = Array.isArray(data) ? data : [];
        } catch (err) {
            console.error(err);
        } finally {
            loading.value = false;
        }
    }

    function openModal() {
        showModal.value = true;
    }

    function closeModal() {
        showModal.value = false;
    }

    function onFileChange(event) {
        const [selected] = event.target.files || [];
        file.value = selected || null;
    }

    function openDeleteModal(page) {
        deleteTarget.value = page;
        deleteMessage.value = '';
        showDeleteModal.value = true;
    }

    function closeDeleteModal() {
        showDeleteModal.value = false;
    }

    function openPagesModal() {
        fetchPagesJson();
        showPagesModal.value = true;
    }

    function closePagesModal() {
        showPagesModal.value = false;
    }

    function openEditModal(page) {
        editTarget.value = { ...page };
        editMessage.value = '';
        showEditModal.value = true;
    }

    function closeEditModal() {
        showEditModal.value = false;
    }

    async function fetchPagesJson() {
        try {
            const res = await fetch('/data/pages.json?_=' + Date.now());
            if (!res.ok) throw new Error('加载失败');
            const text = await res.text();
            pagesJson.value = text;
        } catch (e) {
            pagesJson.value = '加载失败: ' + (e?.message || '');
        }
    }

    function previewImage() {
        if (!imageUrl.value.trim()) return;
        const url = imageUrl.value.trim();
        window.open(url, '_blank');
    }

    async function handleUpload() {
        if (!file.value) return;
        uploading.value = true;
        uploadMessage.value = '';
        try {
            if (!slug.value.trim() || !title.value.trim() || !description.value.trim()) {
                throw new Error('请填写 slug、标题与摘要');
            }

            const token = await requestAuth('上传页面');
            if (!token) throw new Error('未输入密码');

            const form = new FormData();
            form.append('file', file.value);
            form.append('slug', slug.value.trim());
            form.append('title', title.value.trim());
            form.append('description', description.value.trim());
            if (imageUrl.value.trim()) form.append('image', imageUrl.value.trim());

            const uploadUrl = buildUrl('/api/upload');
            const res = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'x-upload-token': token
                },
                body: form
            });

            if (!res.ok) {
                throw new Error(await res.text());
            }

            const body = await res.json();
            uploadMessage.value = body.url ? `上传成功： ${body.url}` : '上传成功，正在刷新列表...';
            await fetchPages();
            closeModal();
        } catch (err) {
            if (err?.message === '用户取消鉴权') return;
            uploadMessage.value = err.message || '上传失败';
        } finally {
            uploading.value = false;
        }
    }

    async function handleDelete() {
        if (!deleteTarget.value) return;
        deleteLoading.value = true;
        deleteMessage.value = '';
        try {
            const token = await requestAuth('删除页面');
            if (!token) throw new Error('未输入密码');

            const deleteUrl = buildUrl('/api/delete');
            const res = await fetch(deleteUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-upload-token': token
                },
                body: JSON.stringify({ url: deleteTarget.value.url })
            });

            if (!res.ok) {
                throw new Error(await res.text());
            }

            deleteMessage.value = '删除成功，正在刷新列表...';
            await fetchPages();
            closeDeleteModal();
        } catch (err) {
            if (err?.message === '用户取消鉴权') return;
            deleteMessage.value = err.message || '删除失败';
        } finally {
            deleteLoading.value = false;
        }
    }

    async function triggerRebuild() {
        rebuilding.value = true;
        try {
            const token = await requestAuth('触发构建');
            if (!token) throw new Error('未输入密码');
            const rebuildUrl = buildUrl('/api/rebuild');
            const res = await fetch(rebuildUrl, {
                method: 'POST',
                headers: {
                    'x-upload-token': token.trim()
                }
            });
            const body = await res.json();
            if (body.ok) {
                await fetchPages();
                await fetchPagesJson();
                alert(body.skipped ? '已跳过构建（SKIP_BUILD）' : '构建完成');
            } else {
                throw new Error(body.error || '构建失败');
            }
        } catch (err) {
            if (err?.message === '用户取消鉴权') return;
            alert('构建失败: ' + (err?.message || ''));
        } finally {
            rebuilding.value = false;
        }
    }

    async function handleEditSave(form) {
        if (!editTarget.value?.url) return;
        editLoading.value = true;
        editMessage.value = '';
        try {
            const token = await requestAuth('编辑页面');
            if (!token) throw new Error('未输入密码');

            const editUrl = buildUrl('/api/edit');
            const res = await fetch(editUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-upload-token': token
                },
                body: JSON.stringify({
                    url: form.url || editTarget.value.url,
                    title: form.title || '',
                    description: form.description || '',
                    image: form.image || ''
                })
            });

            if (!res.ok) {
                throw new Error(await res.text());
            }

            await fetchPages();
            editMessage.value = '保存成功';
            showEditModal.value = false;
        } catch (err) {
            if (err?.message === '用户取消鉴权') return;
            editMessage.value = err?.message || '保存失败';
        } finally {
            editLoading.value = false;
        }
    }

    async function handleRequestSummary(form) {
        aiSummaryLoading.value = true;
        editMessage.value = '';
        try {
            if (!form.url) throw new Error('缺少页面链接');
            if (!OPENAI_KEY) throw new Error('缺少 OpenAI API Key，请在 .env 设置 VITE_OPENAI_API_KEY');

            const htmlRes = await fetch(form.url);
            if (!htmlRes.ok) throw new Error('获取页面失败');
            const html = await htmlRes.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const rawText = (doc.body?.innerText || '').replace(/\s+/g, ' ').trim();
            if (!rawText) throw new Error('页面内容为空');
            const limitedText = rawText.slice(0, 6000);

            const summary = await generateSummary(limitedText, form.title || '', form.summaryLang || summaryLang.value);
            editTarget.value = { ...(editTarget.value || {}), description: summary };
            editMessage.value = 'AI 摘要生成完成，可直接保存。';
        } catch (err) {
            editMessage.value = err?.message || '生成摘要失败';
        } finally {
            aiSummaryLoading.value = false;
        }
    }

    async function generateSummary(text, pageTitle = '', lang = 'auto') {
        const endpoint = `${OPENAI_BASE}/chat/completions`;
        const langInstruction = lang === 'en'
            ? 'Please reply in English within 60 words, start with "This post", use one plain sentence only, no markdown, no bullets.'
            : lang === 'zh'
                ? '请用中文输出，长度不超过120字，并以“本文”开头，仅限一段连续纯文本，不要使用Markdown或分条。'
                : '如果正文主要是中文，请用中文不超过120字并以“本文”开头；如果正文主要是英文，请用英文不超过60词并以“This page”开头；仅用一段连续纯文本，禁止Markdown和分条。';
        const body = {
            model: OPENAI_MODEL,
            messages: [
                { role: 'system', content: `你是一位擅长精简摘要的助手。${langInstruction} 不要编造，突出关键事实。` },
                {
                    role: 'user',
                    content: `请为网页${pageTitle ? `《${pageTitle}》` : ''}生成一段符合要求的摘要，严格控制字数，基于以下正文：${text}`
                }
            ],
            temperature: 0.2,
            max_tokens: 300
        };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_KEY}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || 'AI 服务调用失败');
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error('AI 未返回摘要');
        return content;
    }

    onMounted(fetchPages);
    onMounted(() => applyTheme(themeMode.value));
</script>
