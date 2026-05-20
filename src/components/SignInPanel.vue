<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiClient, ApiError } from '@/services/apiClient'
import type { NostrEvent } from '@/services/apiClient'
import { useAppStore } from '@/stores/appStore'

const { t } = useI18n()
const router = useRouter()
const store = useAppStore()

// ---------------------------------------------------------------------------
// Tab state
// ---------------------------------------------------------------------------
type Tab = 'email' | 'nostr'
const activeTab = ref<Tab>('email')

// ---------------------------------------------------------------------------
// Email tab state
// ---------------------------------------------------------------------------
const email = ref('')
const emailLoading = ref(false)
const emailSuccess = ref(false)
const emailError = ref<string | null>(null)
// Cooldown: disable the button for 30s after a successful send
const emailCooldownUntil = ref<number | null>(null)

function isEmailButtonDisabled() {
  if (emailLoading.value) return true
  if (emailSuccess.value && emailCooldownUntil.value !== null && Date.now() < emailCooldownUntil.value) return true
  return false
}

async function handleEmailSubmit() {
  if (isEmailButtonDisabled()) return
  emailError.value = null
  emailLoading.value = true
  try {
    await apiClient.auth.startEmail(email.value.trim())
    emailSuccess.value = true
    emailCooldownUntil.value = Date.now() + 30_000
    // Release the cooldown after 30s
    setTimeout(() => {
      emailCooldownUntil.value = null
    }, 30_000)
  } catch (err) {
    emailSuccess.value = false
    if (err instanceof ApiError) {
      const body = err.body
      emailError.value =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof (body as Record<string, unknown>).message === 'string'
          ? (body as { message: string }).message
          : t('signIn.error.generic')
    } else {
      emailError.value = t('signIn.error.generic')
    }
  } finally {
    emailLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Nostr tab state
// ---------------------------------------------------------------------------
const nostrAvailable = ref(false)
const nostrLoading = ref(false)
const nostrError = ref<string | null>(null)

// NIP-07 browser extension interface
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>
      signEvent(event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>): Promise<NostrEvent>
    }
  }
}

onMounted(() => {
  // window.nostr may be injected asynchronously by some extensions.
  // Give them a short grace period (~300ms) before declaring absent.
  const checkNostr = () => {
    nostrAvailable.value = typeof window.nostr !== 'undefined'
  }
  checkNostr()
  if (!nostrAvailable.value) {
    setTimeout(checkNostr, 300)
  }
})

async function handleNostrSignIn() {
  if (nostrLoading.value || !window.nostr) return
  nostrError.value = null
  nostrLoading.value = true
  try {
    // 1. Fetch one-time nonce
    const { nonce } = await apiClient.auth.challengeNostr()

    // 2. Build unsigned kind:27235 event (NIP-98 HTTP Auth convention)
    const nowSec = Math.floor(Date.now() / 1000)
    const unsignedEvent = {
      kind: 27235,
      created_at: nowSec,
      tags: [
        ['challenge', nonce],
        ['domain', location.hostname],
        ['method', 'GET'],
      ],
      content: '',
    }

    // 3. Ask the extension to sign
    const signedEvent = await window.nostr.signEvent(unsignedEvent)

    // 4. Submit to backend
    const { account } = await apiClient.auth.verifyNostr(signedEvent)

    // 5. Push the account into the store so signedIn flips to true
    // synchronously — otherwise the redirect to /alerts still shows the
    // SignInPanel until the next reload (when the store's bootstrap IIFE
    // re-runs auth.me()).
    store.setAccount(account)

    // 6. Redirect on success
    await router.push('/alerts')
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body
      nostrError.value =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof (body as Record<string, unknown>).message === 'string'
          ? (body as { message: string }).message
          : t('signIn.error.generic')
    } else {
      // Extension rejections (user cancelled, etc.) land here
      console.error('[SignInPanel] Nostr sign-in error:', err)
      nostrError.value = t('signIn.error.generic')
    }
  } finally {
    nostrLoading.value = false
  }
}
</script>

<template>
  <div class="sp-panel">
    <!-- Tab bar -->
    <div class="sp-tabs" role="tablist" :aria-label="t('signIn.tabs.ariaLabel')">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'email'"
        :class="['sp-tab', activeTab === 'email' ? 'sp-tab--on' : '']"
        @click="activeTab = 'email'"
      >
        {{ t('signIn.tabs.email') }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'nostr'"
        :class="['sp-tab', activeTab === 'nostr' ? 'sp-tab--on' : '']"
        @click="activeTab = 'nostr'"
      >
        {{ t('signIn.tabs.nostr') }}
      </button>
    </div>

    <!-- Email tab content -->
    <div
      v-if="activeTab === 'email'"
      class="sp-content"
      role="tabpanel"
    >
      <p class="sp-lead">{{ t('signIn.email.lead') }}</p>

      <!-- Success state -->
      <div v-if="emailSuccess" class="sp-success">
        <svg class="sp-success-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <p class="sp-success-text">
          {{ t('signIn.email.checkInbox', { email: email }) }}
        </p>
      </div>

      <!-- Input + button -->
      <div v-if="!emailSuccess" class="sp-email-row">
        <label class="sp-field">
          <span class="sp-field-label">{{ t('signIn.email.label') }}</span>
          <input
            v-model="email"
            type="email"
            class="pb-input sp-email-input"
            :placeholder="t('signIn.email.placeholder')"
            autocomplete="email"
            @keyup.enter="handleEmailSubmit"
          />
        </label>
        <button
          type="button"
          class="pb-btn pb-btn--primary sp-submit-btn"
          :disabled="isEmailButtonDisabled() || !email.trim()"
          @click="handleEmailSubmit"
        >
          <span v-if="emailLoading" class="sp-spinner" aria-hidden="true" />
          <span>{{ emailLoading ? t('signIn.status.sending') : t('signIn.email.cta') }}</span>
        </button>
      </div>

      <!-- Re-send option after success -->
      <div v-if="emailSuccess" class="sp-resend">
        <button
          type="button"
          class="pb-btn pb-btn--ghost sp-resend-btn"
          :disabled="isEmailButtonDisabled()"
          @click="emailSuccess = false"
        >
          {{ t('signIn.email.tryAgain') }}
        </button>
      </div>

      <!-- Error -->
      <p v-if="emailError" class="sp-error" role="alert">{{ emailError }}</p>
    </div>

    <!-- Nostr tab content -->
    <div
      v-if="activeTab === 'nostr'"
      class="sp-content"
      role="tabpanel"
    >
      <!-- Extension not detected -->
      <div v-if="!nostrAvailable" class="sp-nostr-absent">
        <p class="sp-lead">{{ t('signIn.nostr.noExtension') }}</p>
        <ul class="sp-ext-list">
          <li>
            <a
              href="https://getalby.com"
              target="_blank"
              rel="noopener noreferrer"
              class="sp-ext-link"
            >Alby</a>
            — browser extension (Chrome / Firefox)
          </li>
          <li>
            <a
              href="https://chrome.google.com/webstore/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp"
              target="_blank"
              rel="noopener noreferrer"
              class="sp-ext-link"
            >nos2x</a>
            — lightweight Chrome extension
          </li>
          <li>
            On mobile: <strong>Amethyst</strong> (Android) or <strong>Damus</strong> (iOS) include a built-in NIP-07 browser
          </li>
        </ul>
        <p class="sp-nostr-hint">
          <a
            href="https://github.com/nostr-protocol/nips/blob/master/07.md"
            target="_blank"
            rel="noopener noreferrer"
            class="sp-ext-link"
          >NIP-07 spec</a>
        </p>
      </div>

      <!-- Extension detected -->
      <div v-else class="sp-nostr-present">
        <p class="sp-lead">{{ t('signIn.nostr.lead') }}</p>
        <button
          type="button"
          class="pb-btn pb-btn--primary sp-nostr-btn"
          :disabled="nostrLoading"
          @click="handleNostrSignIn"
        >
          <span v-if="nostrLoading" class="sp-spinner" aria-hidden="true" />
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z" />
            <path d="M21 21a9 9 0 0 0-18 0" />
          </svg>
          <span>{{ nostrLoading ? t('signIn.status.signingIn') : t('signIn.nostr.cta') }}</span>
        </button>
      </div>

      <!-- Error -->
      <p v-if="nostrError" class="sp-error" role="alert">{{ nostrError }}</p>
    </div>
  </div>
</template>

<style scoped>
.sp-panel {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  max-width: 480px;
  width: 100%;
}

/* ── Tabs ── */
.sp-tabs {
  display: flex;
  gap: 4px;
  padding: 6px;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--line);
}

.sp-tab {
  flex: 1;
  padding: 8px 14px;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-mute);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  transition: background 120ms, color 120ms;
}

.sp-tab:hover {
  color: var(--ink-soft);
  background: var(--bg-card);
}

.sp-tab--on {
  background: var(--bg-card);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  border-color: var(--line);
}

/* ── Content area ── */
.sp-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sp-lead {
  margin: 0;
  font-size: 13.5px;
  color: var(--ink-soft);
  line-height: 1.5;
}

/* ── Email tab ── */
.sp-email-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sp-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sp-field-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-mute);
  font-weight: 600;
}

.sp-email-input {
  width: 100%;
}

.sp-submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  align-self: flex-start;
}

/* ── Success state ── */
.sp-success {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: oklch(0.62 0.14 155 / 0.08);
  border: 1px solid oklch(0.62 0.14 155 / 0.25);
  border-radius: 8px;
}

.sp-success-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: oklch(0.55 0.14 155);
}

.sp-success-text {
  margin: 0;
  font-size: 13.5px;
  color: var(--ink-soft);
  line-height: 1.5;
}

.sp-resend-btn {
  font-size: 12.5px;
  height: 30px;
  padding: 0 12px;
}

/* ── Nostr tab ── */
.sp-nostr-absent {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sp-ext-list {
  margin: 0;
  padding: 0 0 0 18px;
  font-size: 13px;
  color: var(--ink-soft);
  line-height: 1.65;
}

.sp-ext-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.sp-ext-link:hover {
  text-decoration: underline;
}

.sp-nostr-hint {
  margin: 0;
  font-size: 12px;
  color: var(--ink-mute);
}

.sp-nostr-present {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sp-nostr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  align-self: flex-start;
}

/* ── Error ── */
.sp-error {
  margin: 0;
  font-size: 13px;
  color: var(--ask);
  padding: 10px 12px;
  background: oklch(0.55 0.18 25 / 0.07);
  border: 1px solid oklch(0.55 0.18 25 / 0.22);
  border-radius: 6px;
}

/* ── Loading spinner ── */
.sp-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: sp-spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes sp-spin {
  to { transform: rotate(360deg); }
}

/* ── Mobile ── */
@media (max-width: 600px) {
  .sp-content {
    padding: 16px;
  }

  .sp-submit-btn,
  .sp-nostr-btn {
    align-self: stretch;
  }
}
</style>
