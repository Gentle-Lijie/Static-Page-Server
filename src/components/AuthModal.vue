<template>
    <section v-if="visible" class="modal-backdrop" @click.self="emitCancel">
        <div class="modal small">
            <div class="modal-header">
                <h2>{{ title }}</h2>
                <button class="ghost" type="button" @click="emitCancel" aria-label="关闭">✕</button>
            </div>
            <p v-if="message" class="meta" style="margin: 0 0 12px;">{{ message }}</p>
            <form @submit.prevent="submit">
                <label class="sr-only" for="auth-username">用户名</label>
                <input
                    id="auth-username"
                    name="username"
                    type="text"
                    autocomplete="username"
                    class="sr-only"
                    aria-label="用户名"
                />
                <div class="form-row single">
                    <input
                        ref="inputEl"
                        v-model="password"
                        type="password"
                        placeholder="请输入操作密码"
                        required
                        autocomplete="current-password"
                    />
                </div>
                <div class="form-row" style="justify-content: flex-end; gap: 10px; margin-top: 4px;">
                    <button type="button" class="ghost" @click="emitCancel">取消</button>
                    <button type="submit" class="primary" :disabled="loading">
                        {{ loading ? '验证中...' : confirmText }}
                    </button>
                </div>
            </form>
        </div>
    </section>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
    visible: { type: Boolean, default: false },
    title: { type: String, default: '需要鉴权' },
    message: { type: String, default: '' },
    confirmText: { type: String, default: '确认' },
    loading: { type: Boolean, default: false }
});

const emit = defineEmits(['confirm', 'cancel']);
const password = ref('');
const inputEl = ref(null);

function submit() {
    if (!password.value.trim() || props.loading) return;
    emit('confirm', password.value.trim());
    password.value = '';
}

function emitCancel() {
    password.value = '';
    emit('cancel');
}

watch(
    () => props.visible,
    (visible) => {
        if (visible) {
            password.value = '';
            nextTick(() => {
                inputEl.value?.focus();
            });
        }
    }
);
</script>
