<template>
  <div class="toast-container">
    <TransitionGroup name="toast-list" tag="div" class="toast-wrapper">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="toast-item"
        :class="[`toast-${toast.type}`]"
      >
        <span class="toast-icon">
          <template v-if="toast.type === 'success'">✅</template>
          <template v-else-if="toast.type === 'error'">🚨</template>
          <template v-else-if="toast.type === 'warning'">⚠️</template>
          <template v-else>ℹ️</template>
        </span>
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" @click="removeToast(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast';
const { toasts, removeToast } = useToast();
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  pointer-events: none;
}

.toast-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
}

.toast-item {
  pointer-events: auto;
  min-width: 280px;
  max-width: 400px;
  padding: 14px 20px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  font-family: 'Inter', sans-serif;
  color: #1e293b;
}

.toast-success {
  border-left: 4px solid #00cc7e;
}
.toast-error {
  border-left: 4px solid #ef4444;
}
.toast-warning {
  border-left: 4px solid #f59e0b;
}
.toast-info {
  border-left: 4px solid #3b82f6;
}

.toast-icon {
  font-size: 1.2rem;
}

.toast-message {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.2s;
}

.toast-close:hover {
  color: #1e293b;
}

/* 動畫 */
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-list-enter-from {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}
.toast-list-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}
</style>
