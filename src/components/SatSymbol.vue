<script setup lang="ts">
// Renders the satoshi symbol from satsymbol.com.
// The custom @font-face in styles.css maps the "!" character to the
// sat-symbol glyph; we keep the literal "!" as the rendered text and rely
// on aria-label so screen readers announce "sats" instead of "exclamation".
</script>

<template>
  <span class="sat-symbol" role="img" aria-label="sats">!</span>
</template>
