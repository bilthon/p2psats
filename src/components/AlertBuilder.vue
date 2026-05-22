<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { nip19 } from 'nostr-tools'
import { SOURCES, PAYMENT_METHODS } from '@/lib/data'
import { DEFAULT_RULE } from '@p2psats/shared'
import { useAppStore } from '@/stores/appStore'
import { apiClient, ApiError } from '@/services/apiClient'
import type { NostrEvent } from '@/services/apiClient'
import type { Alert, Currency, PaymentMethod } from '@p2psats/shared'

const props = defineProps<{
  currency: Currency
  methodOptions: PaymentMethod[]
  /** Async handler called with the constructed Alert; should throw on backend errors. */
  onSave: (alert: Alert) => Promise<void>
}>()

const { t } = useI18n()
const store = useAppStore()
const { account, quotaReached, maxAlerts } = storeToRefs(store)

// ---------------------------------------------------------------------------
// Channel selector state
// ---------------------------------------------------------------------------
const emailEnabled = ref(false)
const nostrEnabled = ref(false)

// Derived identity presence — computed so they stay reactive to account changes
const emailIdentity = computed(() => account.value?.emailIdentity ?? null)
const nostrIdentity = computed(() => account.value?.nostrIdentity ?? null)

const emailVerified = computed(
  () => emailIdentity.value !== null && emailIdentity.value.verifiedAt !== null,
)
const nostrVerified = computed(
  () => nostrIdentity.value !== null && nostrIdentity.value.verifiedAt !== null,
)

/**
 * Short-form npub display: encode the backend's 64-char hex pubkey to bech32
 * then show the first 10 chars (preserves the "npub1" prefix + 5 disambiguating
 * chars) and the last 4 chars as a visual fingerprint.
 * Falls back to hex truncation if npubEncode throws (e.g. malformed pubkey).
 */
const nostrNpubShort = computed(() => {
  if (!nostrIdentity.value) return ''
  const pubkey = nostrIdentity.value.pubkey
  try {
    const npub = nip19.npubEncode(pubkey)
    // "npub1" + 5 chars gives enough context to recognise bech32 encoding;
    // last 4 chars provide a fingerprint. Total visual width is similar to
    // the previous 8…4 hex form.
    return `${npub.slice(0, 10)}…${npub.slice(-4)}`
  } catch {
    return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`
  }
})

// ---------------------------------------------------------------------------
// Rule form state
// ---------------------------------------------------------------------------
const side = ref<'buy' | 'sell'>('buy')
const premOp = ref<'<=' | '>='>('<=')
const premValue = ref<number>(DEFAULT_RULE.premium.value)
const name = ref('')
const methods = ref<string[]>([])
const sources = ref<string[]>([])
const amountMin = ref<number | null>(null)
const amountMax = ref<number | null>(null)
const showAdvanced = ref(false)

// ---------------------------------------------------------------------------
// Save state
// ---------------------------------------------------------------------------
const saveError = ref<string | null>(null)
const saving = ref(false)

// ---------------------------------------------------------------------------
// canSave logic
// ---------------------------------------------------------------------------

/**
 * True when at least one enabled channel has a verified identity.
 * Mirrors the backend's validation so the button disables before the request.
 */
const channelValid = computed(
  () =>
    (emailEnabled.value && emailVerified.value) ||
    (nostrEnabled.value && nostrVerified.value),
)

/** Human-readable explanation of why Save is disabled (shown as tooltip). */
const saveBlockReason = computed<string>(() => {
  if (quotaReached.value) {
    return t('alertBuilder.channels.saveHintQuotaReached', { max: maxAlerts.value })
  }
  if (!emailEnabled.value && !nostrEnabled.value) {
    return t('alertBuilder.channels.saveHintNone')
  }
  if (emailEnabled.value && !emailVerified.value) {
    return t('alertBuilder.channels.saveHintEmailUnverified')
  }
  if (nostrEnabled.value && !nostrVerified.value) {
    return t('alertBuilder.channels.saveHintNostrUnverified')
  }
  return ''
})

const canSave = computed(() => channelValid.value && !saving.value && !quotaReached.value)

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function toggleMethod(id: string) {
  if (methods.value.includes(id)) {
    methods.value = methods.value.filter((m) => m !== id)
  } else {
    methods.value = [...methods.value, id]
  }
}

function toggleSource(id: string) {
  if (sources.value.includes(id)) {
    sources.value = sources.value.filter((s) => s !== id)
  } else {
    sources.value = [...sources.value, id]
  }
}

function resetForm() {
  side.value = 'buy'
  premOp.value = '<='
  premValue.value = DEFAULT_RULE.premium.value
  name.value = ''
  methods.value = []
  sources.value = []
  amountMin.value = null
  amountMax.value = null
  showAdvanced.value = false
  emailEnabled.value = false
  nostrEnabled.value = false
  saveError.value = null
}

async function handleSave() {
  if (!canSave.value) return
  saveError.value = null
  saving.value = true

  const alert: Alert = {
    id: 'a_' + Math.random().toString(36).slice(2, 8),
    name: name.value || undefined,
    side: side.value,
    currency: props.currency,
    premium: { op: premOp.value, value: premValue.value },
    methods: [...methods.value],
    sources: [...sources.value],
    amountMin: amountMin.value,
    amountMax: amountMax.value,
    emailEnabled: emailEnabled.value,
    nostrEnabled: nostrEnabled.value,
    enabled: true,
    createdAt: Date.now(),
  }

  try {
    await props.onSave(alert)
    // Success: reset the form so the builder is ready for a new alert
    resetForm()
  } catch (err) {
    saveError.value =
      err instanceof Error ? err.message : t('alertBuilder.error.saveFailed')
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// NIP-07 extension detection (mirrors SignInPanel pattern)
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>
      signEvent(event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>): Promise<NostrEvent>
    }
  }
}

// ---------------------------------------------------------------------------
// Link email: inline mini-form
// ---------------------------------------------------------------------------

const linkEmailAddress = ref('')
const linkEmailLoading = ref(false)
const linkEmailSuccess = ref(false)
const linkEmailError = ref<string | null>(null)
async function submitLinkEmail() {
  if (linkEmailLoading.value || !linkEmailAddress.value.trim()) return
  linkEmailError.value = null
  linkEmailLoading.value = true
  try {
    await store.linkEmail(linkEmailAddress.value.trim())
    linkEmailSuccess.value = true
    setTimeout(() => {
      linkEmailSuccess.value = false
      linkEmailAddress.value = ''
    }, 6000)
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body
      linkEmailError.value =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof (body as Record<string, unknown>).message === 'string'
          ? (body as { message: string }).message
          : t('alertBuilder.channels.linkEmail.errorGeneric')
    } else {
      linkEmailError.value = t('alertBuilder.channels.linkEmail.errorGeneric')
    }
  } finally {
    linkEmailLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Link Nostr: one-click NIP-07 flow
// ---------------------------------------------------------------------------

const linkNostrLoading = ref(false)
const linkNostrError = ref<string | null>(null)

async function linkNostrIdentity() {
  if (linkNostrLoading.value) return
  linkNostrError.value = null

  if (!window.nostr) {
    linkNostrError.value = t('alertBuilder.channels.linkNostr.errorNoExt')
    return
  }

  linkNostrLoading.value = true
  try {
    const { nonce } = await apiClient.auth.challengeNostr()

    const nowSec = Math.floor(Date.now() / 1000)
    const unsignedEvent = {
      kind: 27235,
      created_at: nowSec,
      tags: [['challenge', nonce]],
      content: '',
    }

    const signedEvent = await window.nostr.signEvent(unsignedEvent)
    await store.linkNostr(signedEvent)
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body
      linkNostrError.value =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof (body as Record<string, unknown>).message === 'string'
          ? (body as { message: string }).message
          : t('alertBuilder.channels.linkNostr.errorGeneric')
    } else {
      linkNostrError.value = t('alertBuilder.channels.linkNostr.errorRejected')
    }
  } finally {
    linkNostrLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const PREM_STEP = 0.5

function stepPremValue(delta: number) {
  const current = Number(premValue.value) || 0
  premValue.value = Math.round((current + delta * PREM_STEP) * 2) / 2
}

const premSign = computed(() => (premValue.value > 0 ? '+' : ''))

const advancedCount = computed(() => methods.value.length + sources.value.length)

const summaryText = computed(() => {
  const sideLabel = t(
    side.value === 'buy'
      ? 'alertBuilder.summary.sideBuy'
      : 'alertBuilder.summary.sideSell',
  )
  const opLabel = t(
    premOp.value === '<='
      ? 'alertBuilder.summary.opAtMost'
      : 'alertBuilder.summary.opAtLeast',
  )
  const value = `${premSign.value}${premValue.value}%`

  const base = t('alertBuilder.summary.notify', {
    side: sideLabel,
    currency: props.currency,
    op: opLabel,
    value,
  })

  const extras: string[] = []
  if (methods.value.length > 0) {
    const labels = methods.value
      .map((id) => PAYMENT_METHODS.find((p) => p.id === id)?.label ?? id)
      .join(', ')
    extras.push(t('alertBuilder.summary.viaMethods', { methods: labels }))
  }
  if (sources.value.length > 0) {
    extras.push(
      t('alertBuilder.summary.fromSources', { sources: sources.value.join(', ') }),
    )
  }
  if (amountMin.value != null && amountMax.value != null) {
    extras.push(
      t('alertBuilder.summary.amountBoth', {
        min: amountMin.value.toLocaleString(),
        max: amountMax.value.toLocaleString(),
      }),
    )
  } else if (amountMin.value != null) {
    extras.push(
      t('alertBuilder.summary.amountMinOnly', {
        min: amountMin.value.toLocaleString(),
      }),
    )
  } else if (amountMax.value != null) {
    extras.push(
      t('alertBuilder.summary.amountMaxOnly', {
        max: amountMax.value.toLocaleString(),
      }),
    )
  }

  return extras.length > 0 ? `${base} ${extras.join(' ')}.` : `${base}.`
})
</script>

<template>
  <div class="pb-builder">
    <!-- Row 1: side + premium -->
    <div class="pb-builder-row">
      <label class="pb-field">
        <span class="pb-field-label">{{ t('alertBuilder.fields.side') }}</span>
        <div class="pb-seg">
          <button
            v-for="o in [
              { v: 'buy', l: t('alertBuilder.fields.buy') },
              { v: 'sell', l: t('alertBuilder.fields.sell') },
            ]"
            :key="o.v"
            type="button"
            :class="['pb-seg-btn', side === o.v ? 'pb-seg-btn--on' : '']"
            @click="side = o.v as 'buy' | 'sell'"
          >
            {{ o.l }}
          </button>
        </div>
      </label>

      <label class="pb-field">
        <span class="pb-field-label">{{ t('alertBuilder.fields.premium') }}</span>
        <div class="pb-prem-input">
          <select
            v-model="premOp"
            class="pb-select"
          >
            <option value="&lt;=">{{ t('alertBuilder.fields.opAtMost') }}</option>
            <option value="&gt;=">{{ t('alertBuilder.fields.opAtLeast') }}</option>
          </select>
          <div class="pb-prem-value">
            <input
              v-model.number="premValue"
              type="number"
              step="0.5"
              class="pb-input pb-input--narrow"
            />
            <div class="pb-prem-steppers" role="group" :aria-label="t('alertBuilder.fields.premium')">
              <button
                type="button"
                class="pb-prem-step"
                tabindex="-1"
                :aria-label="t('alertBuilder.fields.premiumIncrease')"
                @click="stepPremValue(1)"
              >
                <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 5 L5 1 L9 5" fill="currentColor" /></svg>
              </button>
              <button
                type="button"
                class="pb-prem-step"
                tabindex="-1"
                :aria-label="t('alertBuilder.fields.premiumDecrease')"
                @click="stepPremValue(-1)"
              >
                <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1 L5 5 L9 1" fill="currentColor" /></svg>
              </button>
            </div>
          </div>
          <span class="pb-input-suffix">%</span>
        </div>
      </label>
    </div>

    <!-- Channel selector -->
    <div class="pb-field pb-channels">
      <span class="pb-field-label">{{ t('alertBuilder.channels.heading') }}</span>
      <div class="pb-channel-row">
        <!-- Email channel -->
        <div class="pb-channel-item">
          <label class="pb-channel-label">
            <input
              v-model="emailEnabled"
              type="checkbox"
              class="pb-channel-checkbox"
            />
            <span class="pb-channel-name">{{ t('alertBuilder.channels.email') }}</span>
          </label>
          <div v-if="emailEnabled" class="pb-channel-detail">
            <template v-if="emailVerified">
              <span class="pb-channel-identity">
                {{ t('alertBuilder.channels.deliveredTo') }}
                <strong>{{ emailIdentity!.email }}</strong>
              </span>
            </template>
            <template v-else>
              <span class="pb-channel-unverified">
                {{ t('alertBuilder.channels.emailUnverified') }}
              </span>
              <div v-if="linkEmailSuccess" class="pb-link-success" role="status">
                {{ t('alertBuilder.channels.linkEmail.success') }}
              </div>
              <div v-else class="pb-link-email-form">
                <input
                  v-model="linkEmailAddress"
                  type="email"
                  class="pb-input pb-link-email-input"
                  :placeholder="t('alertBuilder.channels.linkEmail.placeholder')"
                  autocomplete="email"
                  :disabled="linkEmailLoading"
                  @keyup.enter="submitLinkEmail"
                />
                <button
                  type="button"
                  class="pb-btn pb-btn--ghost pb-channel-link-btn"
                  :disabled="linkEmailLoading || !linkEmailAddress.trim()"
                  @click="submitLinkEmail"
                >
                  {{ linkEmailLoading
                    ? t('alertBuilder.channels.linkEmail.sending')
                    : t('alertBuilder.channels.linkEmail.submit') }}
                </button>
              </div>
              <p v-if="linkEmailError" class="pb-channel-error" role="alert">
                {{ linkEmailError }}
              </p>
            </template>
          </div>
        </div>

        <!-- Nostr DM channel -->
        <div class="pb-channel-item">
          <label class="pb-channel-label">
            <input
              v-model="nostrEnabled"
              type="checkbox"
              class="pb-channel-checkbox"
            />
            <span class="pb-channel-name">{{ t('alertBuilder.channels.nostrDm') }}</span>
          </label>
          <div v-if="nostrEnabled" class="pb-channel-detail">
            <template v-if="nostrVerified">
              <span class="pb-channel-identity">
                {{ t('alertBuilder.channels.deliveredToNpub') }}
                <strong class="pb-channel-npub">{{ nostrNpubShort }}</strong>
              </span>
            </template>
            <template v-else>
              <span class="pb-channel-unverified">
                {{ t('alertBuilder.channels.nostrUnverified') }}
              </span>
              <button
                type="button"
                class="pb-btn pb-btn--ghost pb-channel-link-btn"
                :disabled="linkNostrLoading"
                @click="linkNostrIdentity"
              >
                {{ linkNostrLoading
                  ? t('alertBuilder.channels.linkNostr.signing')
                  : t('alertBuilder.channels.linkNostr.label') }}
              </button>
              <p v-if="linkNostrError" class="pb-channel-error" role="alert">
                {{ linkNostrError }}
              </p>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Advanced disclosure -->
    <button type="button" class="pb-disclosure" @click="showAdvanced = !showAdvanced">
      <span :class="['pb-chev', showAdvanced ? 'pb-chev--open' : '']">›</span>
      {{ t('alertBuilder.fields.advanced') }}
      <span v-if="advancedCount > 0" class="pb-disclosure-count">{{ advancedCount }}</span>
    </button>

    <!-- Advanced filters -->
    <div v-if="showAdvanced" class="pb-advanced">
      <div class="pb-field">
        <span class="pb-field-label">{{ t('alertBuilder.fields.paymentMethods') }}</span>
        <div class="pb-chip-row">
          <button
            v-for="m in methodOptions"
            :key="m.id"
            type="button"
            :class="['pb-chip', methods.includes(m.id) ? 'pb-chip--on' : '']"
            @click="toggleMethod(m.id)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>
      <div class="pb-field">
        <span class="pb-field-label">{{ t('alertBuilder.fields.sources') }}</span>
        <div class="pb-chip-row">
          <button
            v-for="s in SOURCES"
            :key="s.id"
            type="button"
            :class="['pb-chip', sources.includes(s.id) ? 'pb-chip--on' : '']"
            @click="toggleSource(s.id)"
          >
            <span class="pb-chip-dot" :style="{ background: s.color }" />
            {{ s.label }}
          </button>
        </div>
      </div>
      <div class="pb-builder-row">
        <label class="pb-field">
          <span class="pb-field-label">{{ t('alertBuilder.fields.amountMin', { currency }) }}</span>
          <input
            type="number"
            placeholder="0"
            :value="amountMin ?? ''"
            class="pb-input"
            @input="(e) => { const v = (e.target as HTMLInputElement).value; amountMin = v ? Number(v) : null }"
          />
        </label>
        <label class="pb-field">
          <span class="pb-field-label">{{ t('alertBuilder.fields.amountMax', { currency }) }}</span>
          <input
            type="number"
            placeholder="∞"
            :value="amountMax ?? ''"
            class="pb-input"
            @input="(e) => { const v = (e.target as HTMLInputElement).value; amountMax = v ? Number(v) : null }"
          />
        </label>
        <label class="pb-field" style="flex: 1">
          <span class="pb-field-label">{{ t('alertBuilder.fields.alertName') }}</span>
          <input
            v-model="name"
            type="text"
            :placeholder="t('alertBuilder.fields.alertNamePlaceholder')"
            class="pb-input"
          />
        </label>
      </div>
    </div>

    <!-- Rule summary -->
    <div class="pb-rule-summary">
      {{ summaryText }}
    </div>

    <!-- Save error -->
    <p v-if="saveError" class="pb-save-error" role="alert">{{ saveError }}</p>

    <!-- Actions -->
    <div class="pb-builder-actions">
      <button type="button" class="pb-btn pb-btn--ghost" @click="resetForm">{{ t('alertBuilder.actions.reset') }}</button>
      <button
        type="button"
        class="pb-btn pb-btn--primary"
        :disabled="!canSave"
        :title="!canSave && !saving ? saveBlockReason : undefined"
        @click="handleSave"
      >
        <span v-if="saving" class="pb-save-spinner" aria-hidden="true" />
        {{ t('alertBuilder.actions.create') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── Channel selector ── */
.pb-channels {
  margin-top: 4px;
}

.pb-channel-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
}

.pb-channel-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pb-channel-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.pb-channel-checkbox {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
}

.pb-channel-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
}

.pb-channel-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 23px;
  flex-wrap: wrap;
}

.pb-channel-identity {
  font-size: 12px;
  color: var(--ink-mute);
}

.pb-channel-identity strong {
  color: var(--ink-soft);
  font-weight: 500;
}

.pb-channel-npub {
  font-family: monospace;
  font-size: 11px;
  letter-spacing: 0.02em;
}

.pb-channel-unverified {
  font-size: 12px;
  color: var(--ink-mute);
  font-style: italic;
}

.pb-channel-link-btn {
  font-size: 11.5px;
  height: 26px;
  padding: 0 10px;
}

/* ── Link email inline form ── */
.pb-link-email-form {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  max-width: 280px;
}

.pb-link-email-input {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  height: 26px;
  padding: 0 8px;
}

/* ── Link success / error inline ── */
.pb-link-success {
  font-size: 12px;
  color: oklch(0.55 0.14 155);
  font-style: italic;
}

.pb-channel-error {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--ask);
  line-height: 1.4;
}

/* ── Save error ── */
.pb-save-error {
  margin: 0;
  font-size: 13px;
  color: var(--ask);
  padding: 10px 12px;
  background: oklch(0.55 0.18 25 / 0.07);
  border: 1px solid oklch(0.55 0.18 25 / 0.22);
  border-radius: 6px;
}

/* ── Save spinner ── */
.pb-save-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: pb-spin 0.6s linear infinite;
  flex-shrink: 0;
  margin-right: 4px;
}

@keyframes pb-spin {
  to { transform: rotate(360deg); }
}
</style>
