<script setup lang="ts">
interface Props {
  title: string;
  value: number;
  highlight?: boolean;
}

defineProps<Props>();
</script>

<template>
  <article class="summary-card glass-card" :class="{ 'is-highlight': highlight }">
    <p class="summary-title">{{ title }}</p>
    <p class="summary-value">{{ value }}</p>
  </article>
</template>

<style scoped>
.summary-card {
  padding: 1rem;
  transition: transform 180ms ease;
}

.summary-card:hover {
  transform: translateY(-2px);
}

.summary-card.is-highlight {
  border-color: var(--brand-primary);
}

.summary-title {
  margin: 0;
  font-size: 0.86rem;
  color: var(--text-secondary);
}

.summary-value {
  margin: 0.4rem 0 0;
  font-size: 1.85rem;
  font-weight: 600;
}
</style>
