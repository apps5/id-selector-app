<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const emit = defineEmits(['visible']);
const element = ref(null);
let observer;

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) emit('visible');
    },
    { rootMargin: '160px' }
  );
  observer.observe(element.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="element" class="h-1" aria-hidden="true" />
</template>
