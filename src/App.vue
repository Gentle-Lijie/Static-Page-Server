<template>
    <div class="container">
        <header class="header">
            <div>
                <h1>丽姐的静态页面部署平台</h1>
                <div class="meta" style="margin-bottom:10px;">共 {{ filteredPages.length }} 个页面</div>

                <!-- <p class="meta">轻量的静态页面索引与上传中心（纯前端）</p> -->
            </div>
            <div class="controls">
                <input v-model="search" type="search" placeholder="搜索标题或描述..." aria-label="搜索" />
                <select v-model="sortKey" aria-label="排序">
                    <option value="created_at">按时间（新→旧）</option>
                    <option value="title">按标题（A→Z）</option>
                </select>
                <button class="primary" @click="openModal">上传</button>
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
                        <input type="password" v-model="uploadPassword" placeholder="上传密码" required />
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
                <PageCard v-for="page in filteredPages" :key="page.url" :page="page" @delete="openDeleteModal" />
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
                        <input type="password" v-model="deletePassword" placeholder="输入删除密码" required />
                    </div>
                    <div class="form-row single">
                        <button type="submit" class="danger" :disabled="deleteLoading">{{ deleteLoading ? '删除中...' : '确认删除' }}</button>
                    </div>
                    <p v-if="deleteMessage" :class="{ 'meta': true }" style="margin-top:8px;">{{ deleteMessage }}</p>
                    <p class="meta" style="margin-top:8px; color:#dc2626;">此操作不可恢复，请确认。</p>
                </form>
            </div>
        </section>
    </div>
</template>

<script setup>
    import { computed, onMounted, ref } from 'vue';
    import PageCard from './components/PageCard.vue';

    const API_BASE = import.meta.env.VITE_API_BASE || '';

    const pages = ref([]);
    const loading = ref(false);
    const search = ref('');
    const sortKey = ref('created_at');
    const file = ref(null);
    const uploading = ref(false);
    const uploadPassword = ref('');
    const uploadMessage = ref('');
    const slug = ref('');
    const title = ref('');
    const description = ref('');
    const imageUrl = ref('');
    const showModal = ref(false);
    const showDeleteModal = ref(false);
    const deleteTarget = ref(null);
    const deletePassword = ref('');
    const deleteMessage = ref('');
    const deleteLoading = ref(false);

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
        deletePassword.value = '';
        deleteMessage.value = '';
        showDeleteModal.value = true;
    }

    function closeDeleteModal() {
        showDeleteModal.value = false;
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
            // basic validation
            if (!slug.value.trim() || !title.value.trim() || !description.value.trim()) {
                throw new Error('请填写 slug、标题与摘要');
            }

            const form = new FormData();
            form.append('file', file.value);
            form.append('slug', slug.value.trim());
            form.append('title', title.value.trim());
            form.append('description', description.value.trim());
            if (imageUrl.value.trim()) form.append('image', imageUrl.value.trim());

            const uploadUrl = API_BASE ? `${API_BASE.replace(/\/$/, '')}/api/upload` : '/api/upload';
            const res = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'x-upload-token': uploadPassword.value
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
            const deleteUrl = API_BASE ? `${API_BASE.replace(/\/$/, '')}/api/delete` : '/api/delete';
            const res = await fetch(deleteUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-upload-token': deletePassword.value
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
            deleteMessage.value = err.message || '删除失败';
        } finally {
            deleteLoading.value = false;
        }
    }

    onMounted(fetchPages);
</script>
