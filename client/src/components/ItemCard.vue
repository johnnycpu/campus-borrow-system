<template>
  <div class="item-card" :class="{ 'is-borrowed': isOutOfStock }">
    <!-- 物品圖片與分類標籤 -->
    <div class="item-image-wrapper">
      <img :src="item.image || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500'" :alt="item.name" class="item-image" />
      <span class="item-category">{{ item.category }}</span>
    </div>
    
    <!-- 物品資訊 -->
    <div class="item-info">
      <!-- 借用狀態與庫存標籤 -->
      <div class="item-status-wrapper">
        <span v-if="!isOutOfStock" class="status-tag status-available">
          <span class="dot">●</span> 可借用 (餘 {{ availableQty }} 件)
        </span>
        <span v-else class="status-tag status-borrowed">
          <span class="dot">○</span> 已借完
        </span>
      </div>
      
      <!-- 物品名稱與描述 -->
      <h3 class="item-title" :title="item.name">{{ item.name }}</h3>
      <p class="item-desc" :title="item.description">{{ item.description }}</p>
      
      <!-- 物品押金與地點等詳細規格 -->
      <div class="item-spec">
        <div class="spec-row">
          <span class="spec-label">物品押金</span>
          <span class="spec-value deposit">${{ item.deposit }}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">總庫存量</span>
          <span class="spec-value">{{ item.total_quantity }} 件</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">歸還地點</span>
          <span class="spec-value location" :title="item.return_location">{{ item.return_location }}</span>
        </div>
      </div>
      
      <!-- 卡片底部操作按鈕 -->
      <div class="item-footer">
        <button class="btn-details" @click="$emit('view-details', item)">查看評價</button>
        <button 
          class="btn-add-cart" 
          :class="{ 'btn-waitlist': isOutOfStock }"
          @click="isOutOfStock ? $emit('join-waitlist', item) : $emit('add-to-cart', item)"
        >
          {{ isOutOfStock ? '加入候補排隊' : '加入借用車' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from 'vue';

// 定義 Props，傳入物品詳細資料
const props = defineProps({
  item: {
    type: Object,
    required: true,
    default: () => ({
      id: 0,
      name: '',
      category: '',
      image: '',
      status: 'available',
      description: '',
      deposit: 0,
      total_quantity: 1,
      borrowed_quantity: 0,
      return_location: '系辦辦公室'
    })
  }
});

// 定義 Emits，點擊加入借用車與查看詳情時通知父元件
const emit = defineEmits(['add-to-cart', 'view-details', 'join-waitlist']);

// 計算剩餘可用庫存
const availableQty = computed(() => {
  return props.item.total_quantity - props.item.borrowed_quantity;
});

// 是否已無庫存
const isOutOfStock = computed(() => {
  return availableQty.value <= 0;
});
</script>

<style scoped>
/* 潮流微電商風卡片 */
.item-card {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
}

/* Hover 特效：卡片浮起與霓虹發光 */
.item-card:hover {
  transform: translateY(-8px);
  border-color: rgba(0, 204, 126, 0.3);
  box-shadow: 0 12px 30px rgba(0, 204, 126, 0.08), 
              0 0 20px rgba(0, 204, 126, 0.12); /* 亮綠色霓虹發光 */
}

/* 當借出中時的卡片 Hover 特效調整為灰色系發光 */
.item-card.is-borrowed:hover {
  border-color: rgba(127, 140, 141, 0.3);
  box-shadow: 0 12px 30px rgba(127, 140, 141, 0.08), 
              0 0 20px rgba(127, 140, 141, 0.12);
}

/* 圖片容器 */
.item-image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 66.67%; /* 3:2 比例 */
  overflow: hidden;
  background-color: #f7f7f7;
}

.item-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
}

/* 圖片在卡片 Hover 時輕微放大 */
.item-card:hover .item-image {
  transform: scale(1.06);
}

/* 分類標籤 */
.item-category {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.95);
  color: #2c3e50;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(4px);
}

/* 資訊區塊 */
.item-info {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

/* 狀態標籤區 */
.item-status-wrapper {
  margin-bottom: 12px;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 30px;
  letter-spacing: 0.5px;
}

.status-available {
  color: #00cc7e;
  background-color: rgba(0, 204, 126, 0.08);
}

.status-available .dot {
  margin-right: 5px;
  font-size: 0.7rem;
  animation: pulse 1.5s infinite;
}

.status-borrowed {
  color: #7f8c8d;
  background-color: rgba(127, 140, 141, 0.08);
}

.status-borrowed .dot {
  margin-right: 5px;
  font-size: 0.7rem;
}

/* 標題與內文 */
.item-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-desc {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0 0 16px 0;
  line-height: 1.6;
  flex-grow: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 物品細節規格區 */
.item-spec {
  background-color: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.8rem;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.spec-label {
  color: #64748b;
  font-weight: 500;
}

.spec-value {
  color: #334155;
  font-weight: 600;
}

.spec-value.deposit {
  color: #f59e0b; /* 橘黃色醒目顯示押金 */
}

.spec-value.location {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 卡片底端按鈕 */
.item-footer {
  margin-top: auto;
  display: flex;
  gap: 8px;
}

.btn-details {
  flex: 1;
  border: 1px solid #cbd5e1;
  background: white;
  color: #64748b;
  padding: 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-details:hover {
  background: #f8fafc;
  color: #0f172a;
  border-color: #94a3b8;
}

.btn-add-cart {
  flex: 2;
  border: none;
  background: linear-gradient(135deg, #00d2ff 0%, #00cc7e 100%);
  color: #ffffff;
  padding: 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
  box-shadow: 0 4px 15px rgba(0, 204, 126, 0.15);
}

.btn-add-cart:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 204, 126, 0.25);
  filter: brightness(1.03);
}

.btn-add-cart:active:not(.btn-waitlist) {
  transform: translateY(0);
}

/* 候補按鈕樣式 */
.btn-waitlist {
  background: #f59e0b;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.15);
}

.btn-waitlist:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.25);
  filter: brightness(1.05);
}

/* 亮綠點閃爍動畫 */
@keyframes pulse {
  0% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
  100% {
    opacity: 0.5;
    transform: scale(0.9);
  }
}
</style>
