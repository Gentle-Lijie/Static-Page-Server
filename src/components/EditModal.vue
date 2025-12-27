<template>
    <section v-if="visible" class="modal-backdrop" @click.self="handleClose">
        <div class="modal">
            <div class="modal-header">
                <h2>编辑页面信息</h2>
                <button class="ghost" type="button" @click="handleClose" aria-label="关闭">✕</button>
            </div>
            <!-- <p class="meta" style="margin: 0 0 12px;">更新标题、摘要与首图，保存后会写入 pages.json。</p> -->
            <p v-if="message" class="meta" style="margin: 0 0 12px; color:#dc2626;">{{ message }}</p>
            <form @submit.prevent="submit">
                <div class="form-row single">
                    <label class="meta" style="font-weight:600;">标题</label>
                    <input v-model="form.title" type="text" required placeholder="请输入标题" />
                </div>
                <div class="form-row single">
                    <div class="meta"
                        style="display:flex; align-items:center; gap:10px; justify-content:space-between; flex-wrap: wrap;">
                        <span style="font-weight:600;">摘要/描述</span>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <select v-model="localSummaryLang" style="min-width:120px;">
                                <option value="auto">自动</option>
                                <option value="zh">中文</option>
                                <option value="en">English</option>
                            </select>
                            <button type="button" class="ghost" @click="emitSummary" :disabled="aiLoading">
                                {{ aiLoading ? '生成中...' : 'AI 生成摘要' }}
                            </button>
                        </div>
                    </div>
                    <textarea v-model="form.description" rows="3" placeholder="请输入摘要"></textarea>
                </div>
                <div class="form-row single">
                    <label class="meta" style="font-weight:600;">首图 URL</label>
                    <input v-model="form.image" type="text" placeholder="请输入首图链接（可选）" />
                </div>
                <div class="form-row single">
                    <label class="meta" style="font-weight:600;">页面链接</label>
                    <div class="image-row" style="gap: 10px;">
                        <input v-model="form.url" type="url" disabled />
                        <button type="button" class="ghost" @click="openPage" :disabled="!form.url">打开</button>
                    </div>
                </div>
                <div class="form-row" style="justify-content: flex-end; gap: 10px; margin-top: 6px;">
                    <button class="ghost" type="button" @click="handleClose">取消</button>
                    <button class="primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
                </div>
            </form>
        </div>
    </section>
</template>

<script setup>
    import { reactive, ref, watch } from 'vue';

    const props = defineProps({
        visible: { type: Boolean, default: false },
        page: { type: Object, default: () => ({}) },
        saving: { type: Boolean, default: false },
        aiLoading: { type: Boolean, default: false },
        message: { type: String, default: '' },
        summaryLang: { type: String, default: 'auto' }
    });

    const emit = defineEmits(['save', 'close', 'request-summary', 'change-summary-lang']);

    const form = reactive({ title: '', description: '', image: '', url: '' });
    const localSummaryLang = ref(props.summaryLang);

    watch(
        () => props.page,
        (page) => {
            form.title = page?.title || '';
            form.description = page?.description || '';
            form.image = page?.image || '';
            form.url = page?.url || '';
        },
        { immediate: true, deep: true }
    );

    watch(
        () => props.summaryLang,
        (lang) => {
            localSummaryLang.value = lang;
        }
    );

    watch(
        () => props.visible,
        (visible) => {
            if (!visible) return;
            const page = props.page || {};
            form.title = page.title || '';
            form.description = page.description || '';
            form.image = page.image || '';
            form.url = page.url || '';
        }
    );

    function submit() {
        emit('save', { ...form });
    }

    function handleClose() {
        emit('close');
    }

    function emitSummary() {
        emit('request-summary', { ...form, summaryLang: localSummaryLang.value });
    }

    function openPage() {
        if (form.url) window.open(form.url, '_blank');
    }

    watch(
        () => localSummaryLang.value,
        (val) => emit('change-summary-lang', val)
    );
</script>
