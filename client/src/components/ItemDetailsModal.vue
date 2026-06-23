<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <button class="btn-close" @click="closeModal">×</button>
      
      <div class="modal-body">
        <!-- 物品基本資訊 (左半) -->
        <div class="item-showcase">
          <!-- 3D 模型檢視 (若有對應的模型網址則顯示 3D 預覽) -->
          <div v-if="item.model_url" class="model-container">
            <model-viewer 
              :src="item.model_url" 
              :alt="`3D ${item.name} 預覽`" 
              auto-rotate 
              camera-controls
              ar
              class="showcase-3d"
            ></model-viewer>
            <div class="ar-hint">✨ 支援 360 度拖曳旋轉與 AR 投影預覽</div>
          </div>
          <img v-else :src="item.image || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500'" :alt="item.name" class="showcase-img" />
          
          <h2 class="showcase-title">{{ item.name }}</h2>
          <p class="showcase-desc">{{ item.description }}</p>
          <div class="showcase-specs">
            <span>庫存: {{ item.total_quantity - item.borrowed_quantity }} / {{ item.total_quantity }}</span>
            <span>押金: ${{ item.deposit }}</span>
          </div>
        </div>
        
        <!-- 評價區域 (右半) -->
        <div class="reviews-section">
          <h3 class="reviews-title">💬 學生評價</h3>
          
          <div class="reviews-list">
            <div v-if="reviews.length === 0" class="no-reviews">
              目前還沒有評價，成為第一個評價的人吧！
            </div>
            <div v-else v-for="review in reviews" :key="review.id" class="review-item">
              <div class="review-header">
                <span class="reviewer-name">{{ review.username }}</span>
                <span class="review-rating">
                  <span v-for="n in 5" :key="n" class="star" :class="{ 'filled': n <= review.rating }">★</span>
                </span>
              </div>
              <p class="review-comment">{{ review.comment }}</p>
              <span class="review-date">{{ new Date(review.created_at).toLocaleString() }}</span>
            </div>
          </div>
          
          <!-- 撰寫評價表單 (需登入) -->
          <div class="review-form" v-if="token">
            <h4 class="form-title">寫下您的評價</h4>
            <div class="rating-select">
              <span 
                v-for="n in 5" 
                :key="n" 
                class="star-btn" 
                :class="{ 'active': n <= newReview.rating }"
                @click="newReview.rating = n"
              >★</span>
            </div>
            <textarea 
              v-model="newReview.comment" 
              class="comment-input" 
              placeholder="分享您使用此物品的心得..."
              rows="3"
            ></textarea>
            <button class="btn-submit-review" @click="submitReview" :disabled="isSubmitting">
              {{ isSubmitting ? '送出中...' : '送出評價' }}
            </button>
          </div>
          <div v-else class="login-hint">
            請先登入系統並借用過此物品才能發表評價。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from 'vue';
import axios from 'axios';
import '@google/model-viewer';

const props = defineProps({
  isOpen: Boolean,
  item: Object,
  token: String
});

const emit = defineEmits(['close']);

const reviews = ref([]);
const newReview = ref({ rating: 5, comment: '' });
const isSubmitting = ref(false);

const fetchReviews = async () => {
  if (!props.item?.id) return;
  try {
    const response = await axios.get(`https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/items/${props.item.id}/reviews`);
    if (response.data && response.data.success) {
      reviews.value = response.data.data;
    }
  } catch (error) {
    console.error('獲取評價失敗:', error);
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    newReview.value = { rating: 5, comment: '' };
    fetchReviews();
  }
});

const submitReview = async () => {
  if (newReview.value.rating < 1 || newReview.value.rating > 5) {
    alert('請給予星級評分！');
    return;
  }
  
  isSubmitting.value = true;
  try {
    const response = await axios.post(`https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/items/${props.item.id}/reviews`, newReview.value, {
      headers: { Authorization: `Bearer ${props.token}` }
    });
    
    if (response.data && response.data.success) {
      alert(response.data.message);
      newReview.value = { rating: 5, comment: '' };
      fetchReviews(); // 重新載入評價
    }
  } catch (error) {
    alert(error.response?.data?.message || '評價發送失敗');
  } finally {
    isSubmitting.value = false;
  }
};

const closeModal = () => {
  emit('close');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #ffffff;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.btn-close {
  position: absolute;
  top: 16px;
  right: 20px;
  background: #f1f5f9;
  border: none;
  font-size: 1.5rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: #64748b;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.modal-body {
  display: flex;
  flex-direction: row;
  height: 100%;
  max-height: 85vh;
}

.item-showcase {
  flex: 1;
  padding: 32px;
  background: #f8fafc;
  overflow-y: auto;
  border-right: 1px solid #e2e8f0;
}

.model-container {
  width: 100%;
  border-radius: 16px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  position: relative;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
}

.showcase-3d {
  width: 100%;
  height: 300px;
  --poster-color: transparent;
}

.ar-hint {
  text-align: center;
  font-size: 0.75rem;
  color: #94a3b8;
  padding: 8px;
  background: rgba(0,0,0,0.2);
}

.showcase-img {
  width: 100%;
  height: auto;
  border-radius: 16px;
  margin-bottom: 24px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
}

.showcase-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1e293b;
  margin: 0 0 12px 0;
}

.showcase-desc {
  font-size: 0.95rem;
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 20px;
}

.showcase-specs {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #00cc7e;
  background: rgba(0, 204, 126, 0.1);
  padding: 12px 16px;
  border-radius: 12px;
}

.reviews-section {
  flex: 1;
  padding: 32px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow-y: hidden;
}

.reviews-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 20px 0;
}

.reviews-list {
  flex-grow: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
  padding-right: 8px;
}

.no-reviews {
  color: #94a3b8;
  font-size: 0.9rem;
  text-align: center;
  padding: 40px 0;
}

.review-item {
  background: #f8fafc;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #f1f5f9;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.reviewer-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #334155;
}

.star {
  color: #cbd5e1;
  font-size: 0.9rem;
}
.star.filled {
  color: #f59e0b;
}

.review-comment {
  font-size: 0.85rem;
  color: #475569;
  line-height: 1.5;
  margin: 0 0 8px 0;
}

.review-date {
  font-size: 0.7rem;
  color: #94a3b8;
}

.review-form {
  background: #f8fafc;
  padding: 20px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
}

.form-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: #1e293b;
}

.rating-select {
  margin-bottom: 12px;
}

.star-btn {
  font-size: 1.5rem;
  color: #cbd5e1;
  cursor: pointer;
  transition: color 0.2s;
}

.star-btn.active {
  color: #f59e0b;
}

.comment-input {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  font-family: inherit;
  font-size: 0.85rem;
  resize: none;
  box-sizing: border-box;
  margin-bottom: 12px;
}

.comment-input:focus {
  outline: none;
  border-color: #00d2ff;
  box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.15);
}

.btn-submit-review {
  width: 100%;
  background: #0f172a;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-submit-review:hover:not(:disabled) {
  background: #1e293b;
}

.btn-submit-review:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.login-hint {
  text-align: center;
  font-size: 0.85rem;
  color: #64748b;
  padding: 16px;
  background: #f1f5f9;
  border-radius: 12px;
}

@media (max-width: 768px) {
  .modal-body {
    flex-direction: column;
    overflow-y: auto;
  }
  .item-showcase {
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
  }
  .reviews-list {
    max-height: 300px;
  }
}
</style>
