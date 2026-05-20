<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/appStore'
import { fetchNostrProfile, type NostrProfile } from '@/lib/nostrProfile'

const { t } = useI18n()
const store = useAppStore()
const router = useRouter()
const { account, signedIn } = storeToRefs(store)

// ---------------------------------------------------------------------------
// Local state
// ---------------------------------------------------------------------------

const open = ref(false)
const profile = ref<NostrProfile | null>(null)
const signingOut = ref(false)
const wrapRef = ref<HTMLElement | null>(null)
const imageBroken = ref(false)

// ---------------------------------------------------------------------------
// Profile fetch — triggered on mount and whenever the pubkey changes
// ---------------------------------------------------------------------------

const pubkey = computed(() => account.value?.nostrIdentity?.pubkey ?? null)

watch(
  pubkey,
  async (pk) => {
    profile.value = null
    imageBroken.value = false
    if (pk) {
      profile.value = await fetchNostrProfile(pk)
    }
  },
  { immediate: true },
)

// ---------------------------------------------------------------------------
// Click-outside to close (mirrors LanguageSwitcher.vue exactly)
// ---------------------------------------------------------------------------

function onDocClick(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Returns the first 8 + ellipsis + last 4 characters of the hex pubkey,
 * e.g. "a1b2c3d4…ef12".  Full bech32 npub encoding is task #31.
 */
function truncatedPubkey(pk: string): string {
  return `${pk.slice(0, 8)}…${pk.slice(-4)}`
}

const displayName = computed<string>(() => {
  if (!account.value) return ''
  if (account.value.nostrIdentity) {
    const pk = account.value.nostrIdentity.pubkey
    return (
      profile.value?.displayName ??
      profile.value?.name ??
      truncatedPubkey(pk)
    )
  }
  return account.value.emailIdentity?.email ?? ''
})

// ---------------------------------------------------------------------------
// Avatar helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic background hue derived from pubkey or email local-part.
 * Simple sum of char codes → hue in degrees.  Gives a consistent colour
 * per identity without any external dependency.
 */
function identityHue(seed: string): number {
  let sum = 0
  for (let i = 0; i < seed.length; i++) {
    sum += seed.charCodeAt(i)
  }
  return sum % 360
}

const avatarInitials = computed<string>(() => {
  if (!account.value) return '?'
  if (account.value.nostrIdentity) {
    const pk = account.value.nostrIdentity.pubkey
    const first =
      profile.value?.displayName?.[0] ??
      profile.value?.name?.[0] ??
      pk.slice(0, 2).toUpperCase()
    return first.toUpperCase()
  }
  const localPart = (account.value.emailIdentity?.email ?? '').split('@')[0]
  return localPart.slice(0, 2).toUpperCase() || '?'
})

const avatarHue = computed<number>(() => {
  if (!account.value) return 200
  const seed =
    account.value.nostrIdentity?.pubkey ??
    account.value.emailIdentity?.email ??
    ''
  return identityHue(seed)
})

const avatarBg = computed<string>(
  () => `oklch(0.55 0.12 ${avatarHue.value})`,
)

// ---------------------------------------------------------------------------
// Sign-out action
// ---------------------------------------------------------------------------

async function handleSignOut() {
  signingOut.value = true
  try {
    await store.signOut()
    await router.push('/')
  } finally {
    signingOut.value = false
    open.value = false
  }
}
</script>

<template>
  <div v-if="signedIn" ref="wrapRef" class="um-wrap">
    <!-- Avatar trigger -->
    <button
      class="um-avatar"
      :style="{ '--avatar-bg': avatarBg }"
      :aria-label="t('userMenu.avatarAlt')"
      :aria-expanded="open"
      @click="open = !open"
    >
      <img
        v-if="profile?.picture && !imageBroken"
        :src="profile.picture"
        :alt="t('userMenu.avatarAlt')"
        class="um-avatar__img"
        @error="imageBroken = true"
      />
      <span v-else class="um-avatar__initials">{{ avatarInitials }}</span>
    </button>

    <!-- Dropdown -->
    <div v-if="open" class="um-menu">
      <!-- Identity header -->
      <div class="um-menu__header">
        <span class="um-menu__name">{{ displayName }}</span>
        <span class="um-menu__via">
          {{
            account?.nostrIdentity
              ? t('userMenu.signedInVia.nostr')
              : t('userMenu.signedInVia.email')
          }}
        </span>
      </div>

      <div class="um-menu__divider" />

      <!-- Sign out -->
      <button
        class="um-menu__signout"
        :disabled="signingOut"
        @click="handleSignOut"
      >
        {{ signingOut ? t('userMenu.signingOut') : t('userMenu.signOut') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.um-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

/* ── Avatar button ─────────────────────────────────────── */
.um-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--avatar-bg, var(--accent));
  padding: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: box-shadow 120ms, border-color 120ms;
  flex-shrink: 0;
}

.um-avatar:hover {
  border-color: var(--ink-mute);
  box-shadow: 0 0 0 2px var(--accent-tint);
}

.um-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.um-avatar__initials {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  line-height: 1;
  pointer-events: none;
  user-select: none;
}

/* ── Dropdown card ─────────────────────────────────────── */
.um-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 196px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-md);
  z-index: 200;
  overflow: hidden;
}

.um-menu__header {
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.um-menu__name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 168px;
}

.um-menu__via {
  font-size: 11px;
  color: var(--ink-mute);
}

.um-menu__divider {
  height: 1px;
  background: var(--line);
  margin: 0;
}

.um-menu__signout {
  display: block;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: none;
  text-align: left;
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
  transition: background 100ms, color 100ms;
}

.um-menu__signout:hover:not(:disabled) {
  background: var(--bg-soft);
  color: var(--ink);
}

.um-menu__signout:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
