<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()

const open = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const offsetX = ref(16)
const offsetY = ref(16)
const PAD = 16

function clampToViewport() {
  const panel = panelRef.value
  if (!panel) return
  const w = panel.offsetWidth, h = panel.offsetHeight
  const maxRight = Math.max(PAD, window.innerWidth - w - PAD)
  const maxBottom = Math.max(PAD, window.innerHeight - h - PAD)
  offsetX.value = Math.min(maxRight, Math.max(PAD, offsetX.value))
  offsetY.value = Math.min(maxBottom, Math.max(PAD, offsetY.value))
}

function onResize() { clampToViewport() }

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    clampToViewport()
  }
}

function onDragStart(e: MouseEvent) {
  const panel = panelRef.value
  if (!panel) return
  const r = panel.getBoundingClientRect()
  const sx = e.clientX, sy = e.clientY
  const startRight = window.innerWidth - r.right
  const startBottom = window.innerHeight - r.bottom

  function move(ev: MouseEvent) {
    offsetX.value = startRight - (ev.clientX - sx)
    offsetY.value = startBottom - (ev.clientY - sy)
    clampToViewport()
  }
  function up() {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

type RadioOption = { value: string; label: string }

function toOpts(options: Array<string | RadioOption>): RadioOption[] {
  return options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }))
}
</script>

<template>
  <!-- Trigger button (rendered in header slot area by parent) -->
  <slot name="trigger" :toggle="toggle" :open="open" />

  <!-- Floating panel -->
  <Teleport to="body">
    <div
      v-if="open"
      ref="panelRef"
      class="twk-panel"
      :style="{ right: offsetX + 'px', bottom: offsetY + 'px' }"
    >
      <div class="twk-hd" @mousedown="onDragStart">
        <b>Tweaks</b>
        <button class="twk-x" aria-label="Close tweaks" @mousedown.stop @click="open = false">✕</button>
      </div>
      <div class="twk-body">
        <!-- Depth chart section -->
        <div class="twk-sect">Depth chart</div>
        <div class="twk-row">
          <div class="twk-lbl"><span>Style</span></div>
          <div class="twk-seg">
            <button
              v-for="o in toOpts([{value:'stacked',label:'Stack'},{value:'heatmap',label:'Heat'}])"
              :key="o.value"
              type="button"
              role="radio"
              :aria-checked="store.depthStyle === o.value"
              @click="store.setDepthStyle(o.value as 'stacked' | 'heatmap')"
            >{{ o.label }}</button>
            <div
              class="twk-seg-thumb"
              :style="{
                left: `calc(2px + ${['stacked','heatmap'].indexOf(store.depthStyle)} * (100% - 4px) / 2)`,
                width: 'calc((100% - 4px) / 2)',
              }"
            />
          </div>
        </div>

        <!-- Order book section -->
        <div class="twk-sect">Order book</div>
        <div class="twk-row">
          <div class="twk-lbl"><span>Density</span></div>
          <div class="twk-seg">
            <button
              v-for="o in toOpts(['compact','balanced','comfy'])"
              :key="o.value"
              type="button"
              role="radio"
              :aria-checked="store.density === o.value"
              @click="store.setDensity(o.value as 'compact' | 'balanced' | 'comfy')"
            >{{ o.label }}</button>
            <div
              class="twk-seg-thumb"
              :style="{
                left: `calc(2px + ${['compact','balanced','comfy'].indexOf(store.density)} * (100% - 4px) / 3)`,
                width: 'calc((100% - 4px) / 3)',
              }"
            />
          </div>
        </div>
        <div class="twk-row">
          <div class="twk-lbl"><span>Layout</span></div>
          <div class="twk-seg">
            <button
              v-for="o in toOpts([{value:'tabs',label:'Tabs'},{value:'split',label:'Split'},{value:'stacked',label:'Stack'}])"
              :key="o.value"
              type="button"
              role="radio"
              :aria-checked="store.bookView === o.value"
              @click="store.setBookView(o.value as 'tabs' | 'split' | 'stacked')"
            >{{ o.label }}</button>
            <div
              class="twk-seg-thumb"
              :style="{
                left: `calc(2px + ${['tabs','split','stacked'].indexOf(store.bookView)} * (100% - 4px) / 3)`,
                width: 'calc((100% - 4px) / 3)',
              }"
            />
          </div>
        </div>
        <div class="twk-row twk-row-h">
          <div class="twk-lbl"><span>Show premium column</span></div>
          <button
            type="button"
            class="twk-toggle"
            :data-on="store.showPremium ? '1' : '0'"
            role="switch"
            :aria-checked="store.showPremium"
            @click="store.setShowPremium(!store.showPremium)"
          ><i /></button>
        </div>

        <!-- Theme section -->
        <div class="twk-sect">Theme</div>
        <div class="twk-row twk-row-h">
          <div class="twk-lbl"><span>Accent</span></div>
          <input
            type="color"
            class="twk-swatch"
            :value="store.highlightAccent"
            @input="(e) => store.setHighlightAccent((e.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
