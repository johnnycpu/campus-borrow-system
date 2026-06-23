# 🎓 校園物品借用系統 (Campus Borrow System)

> 一款為大專院校打造的現代化、智慧化、遊戲化校園物品借用管理平台。結合完整的信用積分機制與極致的 UI/UX 互動體驗，讓校園資源分配更加高效、透明且優雅。

`[在此插入系統首頁截圖：展示物品大廳與 Liquid Glass 質感設計]`

---

## 📑 目錄
1. [專案簡介與技術棧 (Tech Stack)](#1-專案簡介與技術棧-tech-stack)
2. [目錄結構說明 (Project Structure)](#2-目錄結構說明-project-structure)
3. [快速啟動指南 (Getting Started)](#3-快速啟動指南-getting-started)
4. [核心業務邏輯與資料流 (Core Architecture & Data Flow)](#4-核心業務邏輯與資料流-core-architecture--data-flow)
5. [版面設計與 UI/UX 質感升級](#5-版面設計與-uiux-質感升級)
6. [使用者完整流程與體驗考量](#6-使用者完整流程與體驗考量)
7. [開發歷程與實務解決方案](#7-開發歷程與實務解決方案)

---

## 1. 專案簡介與技術棧 (Tech Stack)

經檢查，本系統**完全符合前後端分離 (Frontend-Backend Separation)** 之作業規範，將 `/server` 與 `/client` 完全獨立。後端僅為資料提供者 (API Only)，不進行任何 HTML 渲染。

### ⚙️ 後端 (Backend - `/server`)
- **Node.js + Express.js (`^5.2.1`)**：作為純 API 伺服器，處理路由與請求。
- **SQLite3 (`^6.0.1`)**：輕量級本地端關聯式資料庫，方便部署與移交。
- **JWT (jsonwebtoken) & bcryptjs**：負責無狀態的身分驗證與密碼加密。

### 🎨 前端 (Frontend - `/client`)
- **Vue 3 (`^3.5.34`) + Vite (`^8.0.12`)**：使用最新的 Composition API 進行開發，Vite 提供極速冷啟動與熱更新 (HMR)。
- **Axios (`^1.18.0`)**：處理 RESTful API 請求。
- **canvas-confetti (`^1.9.4`)**：為借用/歸還成功時提供遊戲化的五彩紙屑特效。
- **Vanilla CSS**：捨棄臃腫的 CSS 框架，全手工打造現代化「毛玻璃 (Glassmorphism)」微電商質感。

---

## 2. 目錄結構說明 (Project Structure)

執行 `tree -I "node_modules|dist|.git"` 後的核心專案結構圖如下：

```text
/project
├── /server                 ← Express (API only) 後端目錄
│   ├── server.js           ← 後端主程式 (包含路由定義與 SQLite 資料庫邏輯)
│   ├── package.json        ← 後端相依套件設定
│   └── campus.db           ← SQLite 實體資料庫檔案
│
├── /client                 ← Vue + Vite 前端目錄
│   ├── index.html          ← 網頁載入點
│   ├── package.json        ← 前端相依套件設定
│   ├── vite.config.js      ← Vite 構建設定
│   └── /src
│       ├── App.vue         ← 前端主入口，負責全域版面配置與核心狀態管理
│       ├── main.js         ← Vue 實體初始化
│       ├── style.css       ← 全域變數與重置樣式
│       ├── /components     ← Vue 元件庫
│       │   ├── ItemCard.vue         ← 物品展示卡片元件
│       │   ├── ItemDetailsModal.vue ← 物品評價與詳情彈窗
│       │   └── Toast.vue            ← 自訂輕量級通知元件
│       └── /composables    ← Vue Composition API 共用邏輯
│           └── useToast.js          ← Toast 通知狀態管理邏輯
└── README.md               ← 您正在閱讀的這份文件
```

---

## 3. 快速啟動指南 (Getting Started)

### 步驟 1：啟動後端伺服器 (Server)
```bash
cd server
npm install
npm run dev
# 伺服器將會運行於 http://localhost:3000
```

### 步驟 2：啟動前端客戶端 (Client)
開啟另一個終端機：
```bash
cd client
npm install
npm run dev
# 前端畫面將運行於 http://localhost:5174
```

---

## 4. 核心業務邏輯與資料流 (Core Architecture & Data Flow)

### 🧩 前端元件構成解析 (Component Composition)
本網站採「單頁應用程式 (SPA)」概念，以 `App.vue` 作為大腦（管理 `items`, `cart`, `myRecords` 等狀態），並將可重複使用的 UI 拆分為獨立組件。

#### 1. `ItemCard.vue` (物品卡片)
**用途**：負責渲染單一物品的圖片、庫存狀態、描述與操作按鈕。
**為何這麼做**：將複雜的樣式與 Hover 動畫封裝，使 `App.vue` 的迴圈變得極其乾淨。

```vue
<!-- App.vue (程式碼解析：利用元件構成網頁) -->
<!-- 透過 v-for 迴圈動態生成 ItemCard，並將 @add-to-cart 等事件(Emits) 傳回父元件統一處理狀態 -->
<div class="items-grid">
  <div v-for="item in filteredItems" :key="item.id" class="grid-item">
    <ItemCard 
      :item="item" 
      @add-to-cart="handleAddToCart"
      @view-details="openItemModal"
      @join-waitlist="handleJoinWaitlist"
    />
  </div>
</div>
```

#### 2. `useToast.js` & `Toast.vue` (自訂通知系統)
**用途**：取代生硬且會阻擋瀏覽器執行緒的 `alert()`。
**為何這麼做**：利用 Composition API 的 `ref` 將 Toast 陣列抽離成全域狀態，讓任何元件都能輕鬆呼叫 `toast.success()`。

```javascript
// client/src/composables/useToast.js (程式碼解析)
// 封裝全域的共用邏輯，提供非侵入式的通知體驗
import { ref } from 'vue';
const toasts = ref([]);
let toastId = 0;

export function useToast() {
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = toastId++;
    toasts.value.push({ id, message, type });
    // 自動定時銷毀，不留垃圾狀態
    setTimeout(() => removeToast(id), duration);
  };
  return { toasts, success: (m) => showToast(m, 'success'), error: (m) => showToast(m, 'error') };
}
```

`[在此插入 Toast 通知動畫的截圖]`

---

## 5. 版面設計與 UI/UX 質感升級

我們引入了專案智能技能 `/ui-ux-pro-max` 進行深度介面打磨，選擇了 **「Liquid Glass (流動玻璃)」** 與 **「Minimal Elegant (簡約質感)」** 主題。

### ✨ 毛玻璃質感 (Glassmorphism) 實作
為了讓系統看起來像現代化 SaaS 服務，我們在彈窗、通知與自建日曆上大量使用了 `backdrop-filter`。

```css
/* client/src/components/Toast.vue (程式碼解析) */
.toast-item {
  /* 使用 90% 不透明度白底，加上 12px 的背景模糊，創造高奢通透感 */
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5); /* 增加反光細節邊框 */
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); /* 柔和的彌散陰影 */
}
```

### ✨ 頁面轉場動畫 (Page Transitions)
利用 Vue 內建的 `<Transition>` 元件包裹主視圖，在使用者切換「物品大廳」與「租借箱」時，提供淡入與微縮放的過渡感。

```vue
<!-- App.vue (程式碼解析) -->
<Transition name="page" mode="out-in">
  <section v-if="currentView === 'auth'" key="auth">...</section>
  <div v-else-if="currentView === 'gallery'" key="gallery">...</div>
</Transition>
```

---

## 6. 使用者完整流程與體驗考量

### 🔑 登入註冊 -> 防止「連點」的非同步按鈕
**流程**：學生透過學號密碼登入。
**UX 考量**：API 呼叫有時間差，我們加入了 Spinner 與 `disabled` 狀態。
```vue
<!-- App.vue (程式碼解析) -->
<!-- 為什麼這麼做？若使用者焦慮連點，可能造成伺服器負擔或重複送出。綁定 isAuthLoading 可確保按鈕鎖死並提供視覺回饋。 -->
<button type="submit" class="btn-auth-submit" :disabled="isAuthLoading">
  <span v-if="isAuthLoading" class="spinner-inline"></span>
  <span v-else>立即登入</span>
</button>
```

### 🏪 瀏覽物品 -> 骨架載入屏 (Skeleton Screens)
**流程**：進入物品大廳，瀏覽並將物品加入右側「借用清單」。單一物品最高限制借用 3 件。
**UX 考量**：在等待後端資料時，全白畫面體驗極差。我們加入了 CSS 動畫骨架屏。
```vue
<!-- App.vue (程式碼解析) -->
<div v-if="isItemsLoading" class="items-grid">
  <!-- 預先渲染 6 個佔位符，使用 linear-gradient 製作掃光動畫 -->
  <div v-for="i in 6" :key="i" class="grid-item skeleton-card">
    <div class="skeleton-img"></div>
    <div class="skeleton-text title"></div>
  </div>
</div>
```
`[在此插入物品大廳骨架屏的截圖]`

### 📦 歸還物品 -> 日曆對齊整合與密碼驗證
**流程**：在「我的租借箱」查看行事曆，點擊歸還需輸入「負責人歸還密碼」。
**UX 考量**：最初的密碼輸入是個巨大的全螢幕彈窗，會遮擋行事曆資訊。我們將其**無縫嵌入在行事曆正下方**。
```vue
<!-- 為什麼這麼做？保留了使用者的視覺上下文 (Context)。他們可以一邊看著日曆，一邊完成歸還動作，而不必經歷破壞性的畫面跳轉。 -->
<transition name="fade-slide">
  <div v-if="showReturnModal" class="return-confirm-card">
    <h3 class="return-card-title">🛡️ 物品負責人歸還確認</h3>
    <!-- 密碼輸入框與歸還邏輯 -->
  </div>
</transition>
```
`[在此插入行事曆與下方歸還確認卡片的截圖]`

---

## 7. 開發歷程與實務解決方案

本專案經過多次迭代，不斷吸收真實世界的實務需求並予以解決：

### 🛑 問題 1：原生 `alert()` 阻斷執行緒，體驗生硬
- **遭遇狀況**：早期的成功或錯誤提示皆使用 JavaScript 原生 `alert()`，這會強制鎖住使用者的畫面操作。
- **實務解法**：自行開發輕量級的 `useToast.js`。利用 Vue 3 的響應式狀態，在畫面角落平滑滑入非侵入式通知。

### 🛑 問題 2：多物品於同一天歸還時，日曆版面破裂
- **遭遇狀況**：一開始日曆格子會塞入所有當天要還的物品名稱，導致格子被無限拉長，破壞版面。
- **實務解法**：我們設計了資料聚合（Aggregation）邏輯。若當天有事件，僅顯示一顆簡潔的黃色「還」字標籤。並加上 CSS Hover Tooltip，讓使用者移入鼠標時才展開詳細清單。

### 🛑 問題 3：前端權限與敏感資訊的暴露風險
- **遭遇狀況**：在開發初期，畫面上直接寫著「測試請輸入預設密碼 admin123」。
- **實務解法**：在正式環境中這是嚴重的資安反模式。我們徹底清除了前端程式碼中所有的硬編碼密碼提示，確保驗證邏輯與密碼比對僅留存在後端 Node.js 中，維護系統安全。

### 🛑 問題 4：響應式排版 (RWD) 小螢幕擁擠
- **遭遇狀況**：原本物品大廳與購物車是左右 `split-container`，在手機上完全無法閱讀。
- **實務解法**：透過 CSS Media Queries (`@media (max-width: 1024px)`)，在小螢幕自動將側邊欄轉換為底部堆疊（Column Layout），確保行動裝置的順暢體驗。

---

> **開發者結語**：本專案不僅滿足了期末專題的前後端分離技術門檻，更在佈局美學、防呆機制與互動細節上進行了深度的打磨。從單純的資料庫操作作業，蛻變為一款具有真實商業潛力的高質感網頁應用程式。
