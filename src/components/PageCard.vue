<template>
    <article class="card">
        <img v-if="page.image" :src="page.image" :alt="page.title" loading="lazy" />
        <div class="card-title-row">
            <div class="badge">{{ formattedDate }}</div>
            <a :href="page.url" target="_blank" rel="noopener" class="card-title">
                {{ page.title || '未命名页面' }}
            </a>
        </div>
        <p class="description">{{ page.description || '暂无描述' }}</p>
        <div class="meta meta-row">
            <span class="url">{{ page.url }}</span>
            <div style="display:flex; gap:6px;">
                <button type="button" class="primary icon" @click="$emit('edit', page)" aria-label="编辑">
                    <svg class="icon-edit" viewBox="0 0 1024 1024" aria-hidden="true">
                        <path
                            d="M469.333333 128a42.666667 42.666667 0 0 1 0 85.333333H213.333333v597.333334h597.333334v-256l0.298666-4.992A42.666667 42.666667 0 0 1 896 554.666667v256a85.333333 85.333333 0 0 1-85.333333 85.333333H213.333333a85.333333 85.333333 0 0 1-85.333333-85.333333V213.333333a85.333333 85.333333 0 0 1 85.333333-85.333333z m414.72 12.501333a42.666667 42.666667 0 0 1 0 60.330667L491.861333 593.066667a42.666667 42.666667 0 0 1-60.330666-60.330667l392.192-392.192a42.666667 42.666667 0 0 1 60.330666 0z"
                            fill="currentColor"></path>
                    </svg>
                </button>
                <button type="button" class="ghost danger icon" @click="$emit('delete', page)" aria-label="删除">
                    <svg class="icon-trash" viewBox="0 0 1024 1024" aria-hidden="true">
                        <path
                            d="M630.784 831.488c12.288 0 20.48-8.192 20.48-16.384l28.672-450.56c0-12.288-8.192-20.48-16.384-20.48-12.288 0-20.48 8.192-20.48 16.384l-28.672 450.56C614.4 823.296 622.592 831.488 630.784 831.488z">
                        </path>
                        <path
                            d="M409.6 831.488c12.288 0 20.48-8.192 16.384-20.48l-28.672-450.56c0-12.288-8.192-20.48-20.48-16.384C368.64 344.064 360.448 352.256 360.448 360.448l28.672 450.56C389.12 823.296 397.312 831.488 409.6 831.488z">
                        </path>
                        <path
                            d="M520.192 831.488c12.288 0 20.48-8.192 20.48-20.48l0-450.56c0-12.288-8.192-20.48-20.48-20.48-12.288 0-20.48 8.192-20.48 20.48l0 450.56C499.712 823.296 507.904 831.488 520.192 831.488z">
                        </path>
                        <path
                            d="M839.68 229.376l-188.416 0L651.264 151.552c0-20.48-16.384-36.864-36.864-36.864l-188.416 0c-20.48 0-36.864 16.384-36.864 36.864l0 73.728L200.704 225.28C188.416 229.376 180.224 237.568 180.224 245.76c0 12.288 8.192 20.48 20.48 20.48l36.864 0 36.864 602.112c4.096 40.96 32.768 73.728 73.728 73.728l339.968 0c40.96 0 69.632-32.768 73.728-73.728l36.864-602.112 36.864 0C851.968 266.24 860.16 258.048 860.16 245.76 860.16 237.568 851.968 229.376 839.68 229.376zM425.984 151.552 614.4 151.552l0 73.728-188.416 0L425.984 151.552zM729.088 868.352c-4.096 20.48-16.384 36.864-36.864 36.864L352.256 905.216c-20.48 0-32.768-16.384-36.864-36.864L274.432 266.24l491.52 0L729.088 868.352z">
                        </path>
                    </svg>
                </button>
            </div>
        </div>
    </article>
</template>

<script setup>
    import { computed } from 'vue';

    const props = defineProps({
        page: {
            type: Object,
            required: true
        }
    });

    defineEmits(['delete', 'edit']);

    const formattedDate = computed(() => {
        if (!props.page.created_at) return '未知时间';
        return new Date(props.page.created_at).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    });
</script>
