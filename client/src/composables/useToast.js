import { ref } from 'vue';

const toasts = ref([]);
let toastId = 0;

export function useToast() {
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = toastId++;
    toasts.value.push({ id, message, type });
    
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const success = (message, duration = 3000) => showToast(message, 'success', duration);
  const error = (message, duration = 4000) => showToast(message, 'error', duration);
  const info = (message, duration = 3000) => showToast(message, 'info', duration);
  const warning = (message, duration = 3500) => showToast(message, 'warning', duration);

  const removeToast = (id) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  return {
    toasts,
    showToast,
    success,
    error,
    info,
    warning,
    removeToast
  };
}
