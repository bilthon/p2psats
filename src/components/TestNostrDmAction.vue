<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/appStore'
import { apiClient, ApiError } from '@/services/apiClient'

const { t } = useI18n()
const store = useAppStore()

// ── Visibility gate ────────────────────────────────────────────────────────────
// Only render when the signed-in account has a verified Nostr identity.
const canTest = computed(
  () => store.signedIn && store.account?.nostrIdentity?.verifiedAt != null,
)

// ── Local state ────────────────────────────────────────────────────────────────
const confirmOpen = ref(false)
const sending = ref(false)
const result = ref<{ kind: 'success' | 'error'; message: string } | null>(null)

// Refs for focus management
const cancelBtn = ref<HTMLButtonElement | null>(null)

// ── Scroll lock ────────────────────────────────────────────────────────────────
const prevOverflow = ref('')

function openDialog() {
  prevOverflow.value = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  confirmOpen.value = true
}

function closeDialog() {
  document.body.style.overflow = prevOverflow.value
  confirmOpen.value = false
}

// ── Keyboard handler ───────────────────────────────────────────────────────────
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && confirmOpen.value) closeDialog()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  // Restore scroll if the component is unmounted while the dialog is open
  if (confirmOpen.value) {
    document.body.style.overflow = prevOverflow.value
  }
})

// ── Focus management ──────────────────────────────────────────────────────────
async function focusCancelOnOpen() {
  await nextTick()
  cancelBtn.value?.focus()
}

// ── Confirm handler ───────────────────────────────────────────────────────────
async function confirm() {
  sending.value = true
  try {
    await apiClient.test.sendNostrDm()
    result.value = { kind: 'success', message: t('alerts.testDm.success') }
  } catch (e) {
    const msg =
      e instanceof ApiError &&
      typeof e.body === 'object' &&
      e.body !== null &&
      'message' in e.body
        ? String((e.body as { message: unknown }).message)
        : t('alerts.testDm.error.generic')
    result.value = { kind: 'error', message: msg }
  } finally {
    sending.value = false
    closeDialog()
    setTimeout(() => {
      if (result.value !== null) result.value = null
    }, 6000)
  }
}
</script>

<template>
  <div v-if="canTest" class="tnd-root">
    <!-- Inline result feedback (above button, appears after request settles) -->
    <div
      v-if="result !== null"
      class="tnd-feedback"
      :class="result.kind === 'success' ? 'tnd-feedback--success' : 'tnd-feedback--error'"
      :role="result.kind === 'success' ? 'status' : 'alert'"
    >
      {{ result.message }}
    </div>

    <!-- Trigger button -->
    <button class="tnd-btn" @click="openDialog">
      {{ t('alerts.testDm.button') }}
    </button>

    <!-- Confirmation dialog via Teleport -->
    <Teleport to="body">
      <div
        v-if="confirmOpen"
        class="tnd-backdrop"
        @click.self="closeDialog"
      >
        <div
          class="tnd-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tnd-title"
          @vue:mounted="focusCancelOnOpen"
        >
          <h2 id="tnd-title" class="tnd-title">
            {{ t('alerts.testDm.confirmTitle') }}
          </h2>
          <p class="tnd-body">
            {{ t('alerts.testDm.confirmBody') }}
          </p>
          <div class="tnd-actions">
            <button
              ref="cancelBtn"
              class="tnd-btn tnd-btn--ghost"
              :disabled="sending"
              @click="closeDialog"
            >
              {{ t('alerts.testDm.cancel') }}
            </button>
            <button
              class="tnd-btn tnd-btn--primary"
              :disabled="sending"
              @click="confirm"
            >
              {{ sending ? t('alerts.testDm.sending') : t('alerts.testDm.confirmCta') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Root wrapper ────────────────────────────────────────────────────────────── */
.tnd-root {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding-top: 12px;
}

/* ── Inline feedback ─────────────────────────────────────────────────────────── */
.tnd-feedback {
  font-size: 12.5px;
  line-height: 1.45;
  padding: 6px 10px;
  border-radius: 5px;
  border: 1px solid transparent;
}

.tnd-feedback--success {
  color: var(--bid, oklch(0.72 0.16 155));
  background: oklch(0.62 0.14 155 / 0.1);
  border-color: oklch(0.62 0.14 155 / 0.3);
}

.tnd-feedback--error {
  color: var(--ask, oklch(0.72 0.18 25));
  background: oklch(0.6 0.18 25 / 0.1);
  border-color: oklch(0.6 0.18 25 / 0.3);
}

/* ── Trigger + ghost button shared base ─────────────────────────────────────── */
.tnd-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--line, oklch(0.28 0.006 250));
  background: transparent;
  color: var(--ink, oklch(0.88 0.005 250));
  font-size: 12.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.1s, color 0.1s, opacity 0.1s;
  white-space: nowrap;
}

.tnd-btn:hover:not(:disabled) {
  background: var(--bg-card, oklch(0.17 0.004 250));
}

.tnd-btn:focus-visible {
  outline: 2px solid oklch(0.62 0.14 245);
  outline-offset: 2px;
}

.tnd-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── Ghost variant (Cancel inside dialog) ────────────────────────────────────── */
.tnd-btn--ghost {
  color: oklch(0.6 0.006 250);
}

/* ── Primary variant (Send test inside dialog) ───────────────────────────────── */
.tnd-btn--primary {
  background: var(--accent, oklch(0.62 0.14 245));
  border-color: var(--accent, oklch(0.62 0.14 245));
  color: oklch(0.98 0.002 250);
}

.tnd-btn--primary:hover:not(:disabled) {
  background: oklch(0.55 0.14 245);
  border-color: oklch(0.55 0.14 245);
}

/* ── Backdrop ────────────────────────────────────────────────────────────────── */
.tnd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: oklch(0 0 0 / 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

/* ── Panel ───────────────────────────────────────────────────────────────────── */
.tnd-panel {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: var(--bg-card, oklch(0.14 0.005 250));
  border: 1px solid var(--line, oklch(0.28 0.006 250));
  border-radius: 10px;
  padding: 20px 22px 18px;
  font-family: 'Inter Tight', 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--ink, oklch(0.88 0.005 250));
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Title ───────────────────────────────────────────────────────────────────── */
.tnd-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink, oklch(0.88 0.005 250));
  line-height: 1.3;
}

/* ── Body text ───────────────────────────────────────────────────────────────── */
.tnd-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: oklch(0.68 0.006 250);
}

/* ── Action row ──────────────────────────────────────────────────────────────── */
.tnd-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* Mobile: stack buttons full-width below 360px */
@media (max-width: 360px) {
  .tnd-actions {
    flex-direction: column-reverse;
  }

  .tnd-actions .tnd-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
