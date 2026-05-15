<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/appStore'

const { t } = useI18n()
const store = useAppStore()

const isDark = computed(() => store.theme === 'dark')

const label = computed(() =>
  isDark.value ? t('themeToggle.switchToLight') : t('themeToggle.switchToDark'),
)
</script>

<template>
  <button
    type="button"
    class="pb-icon-btn pb-theme-toggle"
    :aria-label="label"
    :title="label"
    :aria-pressed="isDark"
    @click="store.toggleTheme()"
  >
    <!-- Sun icon — visible in dark mode (clicking switches to light) -->
    <svg
      class="pb-theme-icon pb-theme-icon--sun"
      :class="{ 'pb-theme-icon--visible': isDark }"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
    <!-- Moon icon — visible in light mode (clicking switches to dark) -->
    <svg
      class="pb-theme-icon pb-theme-icon--moon"
      :class="{ 'pb-theme-icon--visible': !isDark }"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M 21 12.79 A 9 9 0 1 1 11.21 3 a 7 7 0 0 0 9.79 9.79 z" />
    </svg>
  </button>
</template>

<style scoped>
.pb-theme-toggle {
  /* Stack both icons on top of each other in the button */
  position: relative;
  overflow: hidden;
}

.pb-theme-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  /* Base (hidden) state: rotated and scaled out */
  transform: translate(-50%, -50%) rotate(90deg) scale(0.5);
  opacity: 0;
  transition:
    transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.pb-theme-icon--visible {
  /* Active (visible) state: centered, full size */
  transform: translate(-50%, -50%) rotate(0deg) scale(1);
  opacity: 1;
}

/* Sun rotates differently on exit to give a natural feel */
.pb-theme-icon--sun:not(.pb-theme-icon--visible) {
  transform: translate(-50%, -50%) rotate(-90deg) scale(0.5);
}
</style>
