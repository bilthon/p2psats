<script setup lang="ts">
// Contact details come from build-time env vars (Vite VITE_* prefix).
// See .env.example for the variables, and fill in your own .env / .env.local.
const npub = (import.meta.env.VITE_CONTACT_NPUB as string | undefined)?.trim() || ''
const email = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || ''
</script>

<template>
  <article class="pb-page">
    <h1 class="pb-page-title">Contact</h1>

    <p class="pb-page-lead">
      Have feedback, found a bug, want to contribute, or just want to talk
      about peer-to-peer bitcoin? Reach out.
    </p>

    <ul class="pb-contact-list">
      <li>
        <span class="pb-contact-label">Nostr</span>
        <span class="pb-contact-value">
          <a
            v-if="npub"
            :href="`https://njump.me/${npub}`"
            target="_blank"
            rel="noopener"
            class="pb-page-link"
            >{{ npub }}</a
          >
          <em v-else>not configured</em>
        </span>
      </li>
      <li>
        <span class="pb-contact-label">Email</span>
        <span class="pb-contact-value">
          <a v-if="email" :href="`mailto:${email}`" class="pb-page-link">{{ email }}</a>
          <em v-else>not configured</em>
        </span>
      </li>
    </ul>
  </article>
</template>
