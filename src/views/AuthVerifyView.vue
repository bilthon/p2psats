<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiClient, ApiError } from '@/services/apiClient'
import { useAppStore } from '@/stores/appStore'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const store = useAppStore()

type VerifyState = 'verifying' | 'missing-token' | 'error'

const state = ref<VerifyState>('verifying')
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  const token = route.query['token']

  // Guard: token must be a non-empty string
  if (typeof token !== 'string' || !token.trim()) {
    state.value = 'missing-token'
    return
  }

  try {
    const { account } = await apiClient.auth.verifyEmail(token.trim())
    // On success the backend has set the __session cookie. Push the account
    // into the store so signedIn flips synchronously before the redirect —
    // otherwise /alerts still shows the SignInPanel until a reload triggers
    // the store's bootstrap auth.me() call.
    store.setAccount(account)
    // Redirect to the alerts page — that's the post-auth destination.
    await router.replace('/alerts')
  } catch (err) {
    state.value = 'error'
    if (err instanceof ApiError) {
      const body = err.body
      errorMessage.value =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof (body as Record<string, unknown>).message === 'string'
          ? (body as { message: string }).message
          : t('signIn.error.generic')
    } else {
      errorMessage.value = t('signIn.error.generic')
    }
  }
})
</script>

<template>
  <div class="av-wrap">
    <!-- Verifying in flight -->
    <div v-if="state === 'verifying'" class="av-card">
      <span class="av-spinner" aria-hidden="true" />
      <p class="av-message">{{ t('signIn.status.verifying') }}</p>
    </div>

    <!-- Token missing from URL -->
    <div v-else-if="state === 'missing-token'" class="av-card av-card--error">
      <svg class="av-icon av-icon--warn" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p class="av-message">{{ t('signIn.verify.missingToken') }}</p>
      <router-link to="/" class="pb-btn pb-btn--ghost av-home-link">{{ t('signIn.verify.backHome') }}</router-link>
    </div>

    <!-- Verification error -->
    <div v-else-if="state === 'error'" class="av-card av-card--error">
      <svg class="av-icon av-icon--error" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <p class="av-message av-message--error">{{ errorMessage ?? t('signIn.error.generic') }}</p>
      <router-link to="/" class="pb-btn pb-btn--ghost av-home-link">{{ t('signIn.verify.backHome') }}</router-link>
    </div>
  </div>
</template>

<style scoped>
.av-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 260px;
  padding: 24px 16px;
}

.av-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 36px 40px;
  box-shadow: var(--shadow-sm);
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.av-card--error {
  border-color: oklch(0.55 0.18 25 / 0.3);
  background: oklch(0.55 0.18 25 / 0.04);
}

.av-message {
  margin: 0;
  font-size: 14px;
  color: var(--ink-soft);
  line-height: 1.5;
}

.av-message--error {
  color: var(--ask);
}

.av-icon--warn {
  color: oklch(0.6 0.12 65);
}

.av-icon--error {
  color: var(--ask);
}

.av-home-link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

/* Loading spinner */
.av-spinner {
  display: block;
  width: 28px;
  height: 28px;
  border: 3px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: av-spin 0.7s linear infinite;
}

@keyframes av-spin {
  to { transform: rotate(360deg); }
}
</style>
