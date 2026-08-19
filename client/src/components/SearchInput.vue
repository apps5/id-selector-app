<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Фильтр по ID' }
});

defineEmits(['update:modelValue']);
</script>

<template>
  <div class="relative">
    <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
    <input
      :value="modelValue"
      type="text"
      inputmode="numeric"
      :placeholder="placeholder"
      class="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  </div>
</template>
