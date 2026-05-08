<script setup lang="ts">
import { ref, computed } from 'vue'
import { SOURCES, PAYMENT_METHODS } from '@/lib/data'
import { DEFAULT_RULE } from '@/lib/alerts'
import type { Alert, Currency, PaymentMethod } from '@/lib/types'

const props = defineProps<{
  currency: Currency
  methodOptions: PaymentMethod[]
}>()

const emit = defineEmits<{ save: [alert: Alert] }>()

// Rule form state
const side = ref<'any' | 'buy' | 'sell'>(DEFAULT_RULE.side)
const premOp = ref<'<=' | '>=' | '=='>(DEFAULT_RULE.premium.op)
const premValue = ref<number>(DEFAULT_RULE.premium.value)
const email = ref('')
const name = ref('')
const methods = ref<string[]>([])
const sources = ref<string[]>([])
const amountMin = ref<number | null>(null)
const amountMax = ref<number | null>(null)
const showAdvanced = ref(false)


const canSave = computed(() => email.value.includes('@') && email.value.includes('.'))

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

function reset() {
  side.value = DEFAULT_RULE.side
  premOp.value = DEFAULT_RULE.premium.op
  premValue.value = DEFAULT_RULE.premium.value
  email.value = ''
  name.value = ''
  methods.value = []
  sources.value = []
  amountMin.value = null
  amountMax.value = null
  showAdvanced.value = false
}

function save() {
  if (!canSave.value) return
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
    email: email.value,
    enabled: true,
    createdAt: Date.now(),
  }
  emit('save', alert)
  reset()
}

const opLabel = computed(() => {
  const labels: Record<string, string> = { '<=': 'at most', '>=': 'at least', '==': 'around' }
  return labels[premOp.value] ?? premOp.value
})

const sideLabel = computed(() => {
  if (side.value === 'any') return 'any order'
  if (side.value === 'buy') return 'a buy order'
  return 'a sell order'
})

const premSign = computed(() => (premValue.value > 0 ? '+' : ''))

const advancedCount = computed(() => methods.value.length + sources.value.length)
</script>

<template>
  <div class="pb-builder">
    <!-- Row 1: side + premium + email -->
    <div class="pb-builder-row">
      <label class="pb-field">
        <span class="pb-field-label">Side</span>
        <div class="pb-seg">
          <button
            v-for="o in [
              { v: 'any', l: 'Any' },
              { v: 'buy', l: 'Buy' },
              { v: 'sell', l: 'Sell' },
            ]"
            :key="o.v"
            type="button"
            :class="['pb-seg-btn', side === o.v ? 'pb-seg-btn--on' : '']"
            @click="side = o.v as 'any' | 'buy' | 'sell'"
          >
            {{ o.l }}
          </button>
        </div>
      </label>

      <label class="pb-field">
        <span class="pb-field-label">Premium</span>
        <div class="pb-prem-input">
          <select
            v-model="premOp"
            class="pb-select pb-select--narrow"
          >
            <option value="&lt;=">≤</option>
            <option value="&gt;=">≥</option>
            <option value="==">≈</option>
          </select>
          <input
            v-model.number="premValue"
            type="number"
            step="0.5"
            class="pb-input pb-input--narrow"
          />
          <span class="pb-input-suffix">%</span>
        </div>
      </label>

      <label class="pb-field" style="flex: 1">
        <span class="pb-field-label">Email for delivery</span>
        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="pb-input"
        />
      </label>
    </div>

    <!-- Advanced disclosure -->
    <button type="button" class="pb-disclosure" @click="showAdvanced = !showAdvanced">
      <span :class="['pb-chev', showAdvanced ? 'pb-chev--open' : '']">›</span>
      Advanced filters
      <span v-if="advancedCount > 0" class="pb-disclosure-count">{{ advancedCount }}</span>
    </button>

    <!-- Advanced filters -->
    <div v-if="showAdvanced" class="pb-advanced">
      <div class="pb-field">
        <span class="pb-field-label">Payment methods (any)</span>
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
        <span class="pb-field-label">Sources (any)</span>
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
          <span class="pb-field-label">Min amount ({{ currency }})</span>
          <input
            type="number"
            placeholder="0"
            :value="amountMin ?? ''"
            class="pb-input"
            @input="(e) => { const v = (e.target as HTMLInputElement).value; amountMin = v ? Number(v) : null }"
          />
        </label>
        <label class="pb-field">
          <span class="pb-field-label">Max amount ({{ currency }})</span>
          <input
            type="number"
            placeholder="∞"
            :value="amountMax ?? ''"
            class="pb-input"
            @input="(e) => { const v = (e.target as HTMLInputElement).value; amountMax = v ? Number(v) : null }"
          />
        </label>
        <label class="pb-field" style="flex: 1">
          <span class="pb-field-label">Alert name (optional)</span>
          <input
            v-model="name"
            type="text"
            placeholder="e.g. Cheap PIX buys"
            class="pb-input"
          />
        </label>
      </div>
    </div>

    <!-- Rule summary -->
    <div class="pb-rule-summary">
      <span class="pb-summary-bold">Notify me</span> when
      <span class="pb-summary-bold">{{ sideLabel }}</span> in
      <span class="pb-summary-bold">{{ currency }}</span>
      appears with premium
      <span class="pb-summary-bold">{{ opLabel }} {{ premSign }}{{ premValue }}%</span>
      <template v-if="methods.length > 0">
        via
        <span class="pb-summary-bold">{{
          methods
            .map((id) => PAYMENT_METHODS.find((p) => p.id === id)?.label ?? id)
            .join(', ')
        }}</span>
      </template>
      <template v-if="sources.length > 0">
        from <span class="pb-summary-bold">{{ sources.join(', ') }}</span>
      </template>
      <template v-if="amountMin || amountMax">
        for amounts
        <template v-if="amountMin">
          ≥ <span class="pb-summary-bold">{{ amountMin.toLocaleString() }}</span>
        </template>
        <template v-if="amountMax">
          ≤ <span class="pb-summary-bold">{{ amountMax.toLocaleString() }}</span>
        </template>
      </template>
      .
    </div>

    <!-- Actions -->
    <div class="pb-builder-actions">
      <button type="button" class="pb-btn pb-btn--ghost" @click="reset">Reset</button>
      <button
        type="button"
        class="pb-btn pb-btn--primary"
        :disabled="!canSave"
        @click="save"
      >
        Create alert
      </button>
    </div>
  </div>
</template>
