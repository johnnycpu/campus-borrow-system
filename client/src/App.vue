<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import confetti from 'canvas-confetti';
import ItemCard from './components/ItemCard.vue';
import ItemDetailsModal from './components/ItemDetailsModal.vue';
import Toast from './components/Toast.vue';
import { useToast } from './composables/useToast';

const toast = useToast();

// ==================== 認證與視圖狀態 ====================
const token = ref(localStorage.getItem('token') || '');
const username = ref(localStorage.getItem('username') || '');
const userScore = ref(100);
const userRole = ref(localStorage.getItem('role') || 'student');
const currentView = ref(token.value ? (localStorage.getItem('role') === 'admin' ? 'admin' : 'gallery') : 'auth'); // 已登入則進首頁，未登入則進登入頁
const authMode = ref('login'); // 'login' 或 'register'
const isAuthLoading = ref(false);
const isItemsLoading = ref(true);
const isSubmittingBorrow = ref(false);
const isSubmittingReturn = ref(false);

// 登入/註冊表單
const authForm = ref({
  username: '',
  password: ''
});

// ==================== 租借首頁狀態 ====================
const items = ref([]); // 所有物品真實數據
const cart = ref([]); // 前端借用車
const borrowerName = ref(username.value); // 借用人預設填入使用者姓名

// Modal 狀態
const isModalOpen = ref(false);
const selectedModalItem = ref({});
const openItemModal = (item) => {
  selectedModalItem.value = item;
  isModalOpen.value = true;
};

// 搜尋與篩選
const searchQuery = ref('');
const selectedCategory = ref('全部');
const categories = ['全部', '攝影器材', '活動器材', '樂器'];

// ==================== 學生租借箱狀態 ====================
const myRecords = ref([]); // 個人借用歷史與狀態
const currentDate = ref(new Date(2026, 5)); // 預設為 2026 年 6 月 (月份為 0-11，5 代表 6 月)

// ==================== API 串接與邏輯 ====================

// 1. 取得所有物品資料
const fetchItems = async () => {
  isItemsLoading.value = true;
  try {
    const response = await axios.get('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/items');
    if (response.data && response.data.success) {
      items.value = response.data.data;
    }
  } catch (error) {
    console.error('獲取物品失敗:', error);
    toast.error('獲取物品失敗，請檢查連線');
  } finally {
    isItemsLoading.value = false;
  }
};

// 2. 取得當前使用者的個人借用箱紀錄
const fetchMyRecords = async () => {
  if (!token.value) return;
  try {
    const response = await axios.get('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/my-records', {
      headers: { Authorization: `Bearer ${token.value}` }
    });
    if (response.data && response.data.success) {
      myRecords.value = response.data.data;
    }
  } catch (error) {
    console.error('獲取個人租借歷史失敗:', error);
  }
};

// 3. 取得當前使用者最新資訊 (積分等)
const fetchMe = async () => {
  if (!token.value) return;
  try {
    const response = await axios.get('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/auth/me');
    if (response.data && response.data.success) {
      userScore.value = response.data.user.score;
    }
  } catch (error) {
    console.error('獲取使用者資訊失敗:', error);
  }
};

// 註冊與登入處理
const handleAuth = async () => {
  const url = authForm.value.username.trim();
  const pwd = authForm.value.password.trim();

  if (!url || !pwd) {
    toast.warning('請填寫帳號與密碼！');
    return;
  }

  isAuthLoading.value = true;
  try {
    if (authMode.value === 'register') {
      const response = await axios.post('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/auth/register', {
        username: url,
        password: pwd,
        role: authForm.value.isAdmin ? 'admin' : 'student'
      });
      if (response.data && response.data.success) {
        toast.success('註冊成功！請直接登入。');
        authMode.value = 'login';
        authForm.value.password = '';
      }
    } else {
      // 登入
      const response = await axios.post('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/auth/login', {
        username: url,
        password: pwd
      });
      if (response.data && response.data.success) {
        if (authMode.value === 'admin' && response.data.user.role !== 'admin') {
          toast.error('此帳號無管理員權限！');
          return;
        }
        token.value = response.data.token;
        username.value = response.data.user.username;
        userScore.value = response.data.user.score || 100;
        borrowerName.value = response.data.user.username;
        
        // 寫入 localStorage
        userRole.value = response.data.user.role || 'student';
        localStorage.setItem('role', userRole.value);
        localStorage.setItem('token', token.value);
        localStorage.setItem('username', username.value);
        
        toast.success(`登入成功！歡迎，${username.value}`);
        if (userRole.value === 'admin') {
          currentView.value = 'admin';
          fetchAdminItems();
        } else {
          currentView.value = 'gallery';
        }
        authForm.value = { username: '', password: '' };
        
        // 載入資料
        fetchItems();
        fetchMyRecords();
      }
    }
  } catch (error) {
    const msg = error.response?.data?.message || '操作失敗，請重新確認帳密！';
    toast.error(msg);
  } finally {
    isAuthLoading.value = false;
  }
};

// 登出
const handleLogout = () => {
  token.value = '';
  username.value = '';
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
  userRole.value = 'student';
  cart.value = [];
  currentView.value = 'auth';
  toast.info('已成功登出。');
};

// 加入借用車
const handleAddToCart = (item) => {
  if (!token.value) {
    toast.warning('請先登入系統！');
    currentView.value = 'auth';
    return;
  }
  if (userScore.value < 80) {
    toast.error(`您的信用積分為 ${userScore.value}，低於 80 分，已被暫停借用權限！`);
    return;
  }
  const isExist = cart.value.some(cartItem => cartItem.id === item.id);
  if (isExist) {
    toast.info(`【${item.name}】已在借用清單中！`);
    return;
  }
  
  cart.value.push({
    ...item,
    borrow_quantity: 1
  });
  toast.success(`已將【${item.name}】加入清單`);
};

// 處理借用車內物品數量增減
const handleQuantityChange = (cartItem, delta) => {
  const newQty = cartItem.borrow_quantity + delta;
  const available = cartItem.total_quantity - cartItem.borrowed_quantity;
  if (newQty < 1) return;
  if (newQty > 3) {
    toast.warning('單一物品每次最多只能借用 3 個！');
    return;
  }
  if (newQty > available) {
    toast.warning(`【${cartItem.name}】可用庫存不足，目前僅剩 ${available} 個！`);
    return;
  }
  cartItem.borrow_quantity = newQty;
};

// 加入候補排隊
const handleJoinWaitlist = async (item) => {
  if (!token.value) {
    toast.warning('請先登入系統！');
    currentView.value = 'auth';
    return;
  }
  try {
    const response = await axios.post(`https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/items/${item.id}/waitlist`, {}, {
      headers: { Authorization: `Bearer ${token.value}` }
    });
    if (response.data && response.data.success) {
      toast.success(response.data.message);
    }
  } catch (error) {
    toast.error(error.response?.data?.message || '加入候補失敗');
  }
};

// 從借用車移除
const handleRemoveFromCart = (index) => {
  cart.value.splice(index, 1);
};

// 送出借用申請
const submitBorrowRequest = async () => {
  if (cart.value.length === 0) {
    toast.warning('借用車為空！');
    return;
  }
  if (!borrowerName.value.trim()) {
    toast.warning('請輸入借用人姓名/學號！');
    return;
  }

  isSubmittingBorrow.value = true;
  try {
    // 預設 7 天後歸還
    const today = new Date();
    const returnDateObj = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const return_date = returnDateObj.toISOString().split('T')[0];

    // 並行送出 API 請求，標頭附帶 JWT Token
    const promises = cart.value.map(cartItem => {
      return axios.post('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/records', {
        item_id: cartItem.id,
        borrower: borrowerName.value.trim(),
        return_date: return_date,
        quantity: cartItem.borrow_quantity
      }, {
        headers: { Authorization: `Bearer ${token.value}` }
      });
    });

    await Promise.all(promises);

    // 觸發五彩紙屑特效 (遊戲化)
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#00d2ff', '#00cc7e', '#f59e0b']
    });

    toast.success('借用申請提交成功！請至「我的租借箱」查看歸還細節。');
    cart.value = [];
    
    // 刷新資料
    await fetchItems();
    await fetchMyRecords();
  } catch (error) {
    console.error(error);
    const msg = error.response?.data?.message || '送出失敗，請重試！';
    toast.error(msg);
  } finally {
    isSubmittingBorrow.value = false;
  }
};

// ==================== 歸還與積分邏輯 (含 Modal) ====================
const showReturnModal = ref(false);
const returnPassword = ref('');
const recordToReturn = ref(null);

const openReturnModal = (record) => {
  recordToReturn.value = record;
  returnPassword.value = '';
  showReturnModal.value = true;
};

const confirmReturnItem = async () => {
  if (!recordToReturn.value) return;
  if (!returnPassword.value.trim()) {
    toast.warning('請輸入負責人歸還密碼！');
    return;
  }
  
  isSubmittingReturn.value = true;
  try {
    const response = await axios.post(`https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/records/${recordToReturn.value.id}/return`, {
      password: returnPassword.value
    });
    
    if (response.data && response.data.success) {
      if (response.data.scoreChange > 0) {
        // 準時歸還，觸發加分特效
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#2dd4bf', '#ffffff']
        });
      }
      
      const scoreMsg = response.data.scoreChange > 0 ? `+${response.data.scoreChange}` : response.data.scoreChange;
      toast.success(`${response.data.message} 積分變更: ${scoreMsg}`);
      
      showReturnModal.value = false;
      recordToReturn.value = null;
      returnPassword.value = '';
      
      // 更新資料
      fetchMyRecords();
      fetchItems();
      fetchMe();
    }
  } catch (error) {
    const msg = error.response?.data?.message || '歸還失敗，請重試！';
    toast.error(msg);
  } finally {
    isSubmittingReturn.value = false;
  }
};

// ==================== 計算屬性 ====================
// 日曆輔助：將當日借用記錄依照名稱分類計算數量
const groupRecordsByName = (records) => {
  const summary = {};
  records.forEach(rec => {
    const key = `[${rec.item_category}] ${rec.item_name}`;
    if (!summary[key]) {
      summary[key] = 0;
    }
    summary[key]++;
  });
  return summary;
};

// 1. 物品搜尋與分類過濾
const filteredItems = computed(() => {
  return items.value.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                        item.description.toLowerCase().includes(searchQuery.value.toLowerCase());
    const matchCategory = selectedCategory.value === '全部' || item.category === selectedCategory.value;
    return matchSearch && matchCategory;
  });
});

// 2. 自製日曆行事曆計算
const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth(); // 0-11
  
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 第一天是星期幾
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // 當月總天數
  
  const days = [];
  
  // 填補上個月空白
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push({ day: null, dateStr: '', records: [] });
  }
  
  // 填入當月天數與當天事件
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // 篩選出這一天需要歸還的個人借用紀錄 (排除已歸還 status === 'returned')
    const matchRecords = myRecords.value.filter(r => r.return_date === dateStr && r.status !== 'returned');
    
    days.push({
      day: d,
      dateStr,
      records: matchRecords
    });
  }
  
  return days;
});

// 切換日曆月份
const prevMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1);
};

const nextMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1);
};

// 格式化當前行事曆年月標題
const calendarTitle = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth() + 1;
  return `${year} 年 ${month} 月`;
});


// ==================== 智能通知與儀表板狀態 ====================
const showNotifications = ref(false);
const notifications = ref([]);
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length);

const fetchNotifications = async () => {
  try {
    const res = await axios.get('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/notifications', { headers: { Authorization: `Bearer ${token.value}` } });
    if (res.data.success) {
      notifications.value = res.data.notifications.map(n => ({
        id: n.id, title: n.title, message: n.message, read: n.is_read === 1, time: n.created_at
      }));
    }
  } catch(e) {}
};

const markNotificationsRead = async () => {
  notifications.value.forEach(n => n.read = true);
  try {
    await axios.put('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/notifications/read', {}, { headers: { Authorization: `Bearer ${token.value}` } });
  } catch(e) {}
};


// 簡單的圓餅圖統計資料 (利用 CSS conic-gradient)
const categoryStats = computed(() => {
  const stats = { '攝影器材': 0, '樂器': 0, '活動器材': 0 };
  myRecords.value.forEach(r => {
    if (stats[r.item_category] !== undefined) {
      stats[r.item_category]++;
    }
  });
  const total = myRecords.value.length || 1;
  return {
    photo: (stats['攝影器材'] / total) * 100,
    music: (stats['樂器'] / total) * 100,
    activity: (stats['活動器材'] / total) * 100
  };
});

// 掛載載入


// ==================== 管理員與聯絡室狀態 ====================
const adminItems = ref([]);
const newItemForm = ref({ name: '', category: '攝影器材', image: '', description: '', deposit: 0, total_quantity: 1, return_location: '系辦公室' });
const isAdminLoading = ref(false);
const imageFile = ref(null);

const handleImageUpload = (e) => {
  if (e.target.files.length > 0) {
    imageFile.value = e.target.files[0];
  }
};

const showChatRoom = ref(false);
const chatLessors = ref([]);
const currentChatLessor = ref('');
const chatMessages = ref([]);
const chatInput = ref('');
const chatTargetUserId = ref(null);

const fetchAdminItems = async () => {
  try {
    const res = await axios.get('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/items');
    if (res.data.success) adminItems.value = res.data.data;
  } catch(e) {}
};

const submitNewItem = async () => {
  isAdminLoading.value = true;
  try {
    const formData = new FormData();
    formData.append('name', newItemForm.value.name);
    formData.append('category', newItemForm.value.category);
    formData.append('description', newItemForm.value.description);
    formData.append('deposit', newItemForm.value.deposit);
    formData.append('total_quantity', newItemForm.value.total_quantity);
    formData.append('return_location', newItemForm.value.return_location);
    if (imageFile.value) {
      formData.append('image', imageFile.value);
    } else {
      formData.append('image', newItemForm.value.image);
    }

    const res = await axios.post('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/admin/items', formData, { 
      headers: { 
        Authorization: `Bearer ${token.value}`,
        'Content-Type': 'multipart/form-data'
      } 
    });
    if (res.data.success) {
      toast.success('上架成功');
      newItemForm.value.name = '';
      newItemForm.value.image = '';
      imageFile.value = null;
      fetchAdminItems();
      fetchItems();
    }
  } catch(e) { toast.error('上架失敗'); }
  finally { isAdminLoading.value = false; }
};

const toggleItemStock = async (item, diff) => {
  const newQty = item.total_quantity + diff;
  if (newQty < 0) return;
  try {
    const res = await axios.put(`https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/admin/items/${item.id}`, { total_quantity: newQty }, { headers: { Authorization: `Bearer ${token.value}` } });
    if (res.data.success) {
      toast.success('更新庫存成功');
      fetchAdminItems();
      fetchItems();
    }
  } catch(e) { toast.error('更新失敗'); }
};

const fetchChatLessors = async () => {
  if (userRole.value === 'admin') {
    const res = await axios.get('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/admin/conversations', { headers: { Authorization: `Bearer ${token.value}` } });
    if (res.data.success) chatLessors.value = res.data.conversations;
  } else {
    const res = await axios.get('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/lessors', { headers: { Authorization: `Bearer ${token.value}` } });
    if (res.data.success) chatLessors.value = res.data.lessors;
  }
};

const selectLessor = async (lessorObj) => {
  if (userRole.value === 'admin') {
    currentChatLessor.value = lessorObj.lessor_name;
    chatTargetUserId.value = lessorObj.user_id;
  } else {
    currentChatLessor.value = lessorObj.name;
    chatTargetUserId.value = null;
  }
  const url = userRole.value === 'admin' ? `https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/messages/${currentChatLessor.value}?user_id=${chatTargetUserId.value}` : `https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/messages/${currentChatLessor.value}`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token.value}` } });
  if (res.data.success) chatMessages.value = res.data.messages;
};

const sendChatMessage = async () => {
  if (!chatInput.value.trim() || !currentChatLessor.value) return;
  try {
    const payload = { lessor_name: currentChatLessor.value, content: chatInput.value, target_user_id: chatTargetUserId.value };
    const res = await axios.post('https://tea-price-tracker-d1321322-drfqfwfscbeweydu.southeastasia-01.azurewebsites.net/api/messages', payload, { headers: { Authorization: `Bearer ${token.value}` } });
    if (res.data.success) {
      chatMessages.value.push(res.data.message);
      chatInput.value = '';
    }
  } catch(e) { toast.error('發送失敗'); }
};

const toggleChatRoom = () => {
  showChatRoom.value = !showChatRoom.value;
  if (showChatRoom.value) fetchChatLessors();
};

onMounted(() => {
  fetchItems();
  if (token.value) {
    fetchMyRecords();
    fetchMe();
    fetchNotifications();
    if (localStorage.getItem('role') === 'admin') {
      fetchAdminItems();
    }
  }
});
</script>

<template>
  <div class="app-layout">
    <Toast />
    <!-- 頂部導覽列 -->
    <header class="app-header" v-show="currentView !== 'auth'">
      <div class="header-container">
        <div class="header-logo" @click="token ? currentView = 'gallery' : null">
          <h1 class="app-title">校園物品借用系統</h1>
          <div class="user-badges" v-if="token">
            <span class="user-badge">學生：{{ username }}</span>
            <span class="score-badge" :class="{'low-score': userScore < 80}">積分：{{ userScore }}</span>
          </div>
        </div>
        
        <nav class="header-nav" v-if="token">
          <!-- 鈴鐺通知 -->
          <button 
            v-if="userRole !== 'admin'"
            class="nav-tab icon-tab" 
            :class="{ 'active': currentView === 'notifications' }"
            @click="currentView = 'notifications'; markNotificationsRead();"
          >
            🔔
            <span v-if="unreadCount > 0" class="badge">{{ unreadCount }}</span>
          </button>
          
          <button 
            v-if="userRole === 'admin'"
            class="nav-tab" 
            :class="{ 'active': currentView === 'admin' }"
            @click="currentView = 'admin'; fetchAdminItems();"
          >
            ⚙️ 物品管理
          </button>
          
          <button 
            v-if="userRole !== 'admin'"
            class="nav-tab" 
            :class="{ 'active': currentView === 'dashboard' }"
            @click="currentView = 'dashboard'"
          >
            📊 數據中心
          </button>
          <button 
            v-if="userRole !== 'admin'"
            class="nav-tab" 
            :class="{ 'active': currentView === 'gallery' }"
            @click="currentView = 'gallery'"
          >
            🏪 物品大廳
          </button>
          <button 
            v-if="userRole !== 'admin'"
            class="nav-tab" 
            :class="{ 'active': currentView === 'cabinet' }"
            @click="currentView = 'cabinet'; fetchMyRecords();"
          >
            📦 我的租借箱
          </button>
          <button 
            v-if="userRole !== 'admin'"
            class="nav-tab" 
            :class="{ 'active': currentView === 'rules' }"
            @click="currentView = 'rules'"
          >
            📜 規則與積分
          </button>
          <button class="btn-logout" @click="handleLogout">登出</button>
        </nav>
      </div>
    </header>

    <!-- 主頁面渲染 -->
    <main :class="currentView === 'auth' ? 'auth-main-full' : 'app-main'">
      <Transition name="page" mode="out-in">
      <!-- ==================== View 1: 登入註冊頁面 ==================== -->
      <section v-if="currentView === 'auth'" class="auth-view split-auth-layout" key="auth">
        <!-- 左側：品牌資訊與登入表單 -->
        <div class="auth-left">
          <div class="auth-left-content">
            <h1 class="brand-title">Campus<br>Borrow.</h1>
            <p class="brand-slogan">為什麼選擇 Campus Borrow？<br>我們提供極致美學的校園資源租借體驗，讓借用與歸還都成為一種享受。</p>
            
            <div class="auth-card-minimal">
              <div class="auth-tabs minimal-tabs">
                <button 
                  class="auth-tab" 
                  :class="{ 'active': authMode === 'login' }"
                  @click="authMode = 'login'"
                >
                  學生登入
                </button>
                <button 
                  class="auth-tab" 
                  :class="{ 'active': authMode === 'admin' }"
                  @click="authMode = 'admin'"
                >
                  管理員登入
                </button>
                <button 
                  class="auth-tab" 
                  :class="{ 'active': authMode === 'register' }"
                  @click="authMode = 'register'"
                >
                  帳號註冊
                </button>
              </div>
              
              <form @submit.prevent="handleAuth" class="auth-form minimal-form">
                <div class="input-field minimal-input">
                  <label>學號 / 帳號</label>
                  <input 
                    v-model="authForm.username" 
                    type="text" 
                    placeholder="D1321322" 
                    required 
                  />
                </div>
                
                <div class="input-field minimal-input">
                  <label>登入密碼</label>
                  <input 
                    v-model="authForm.password" 
                    type="password" 
                    placeholder="Password" 
                    required 
                  />
                </div>
                
                <div class="input-field minimal-input" v-if="authMode === 'register'" style="display: flex; align-items: center; gap: 8px; margin-top: -8px;">
                  <input type="checkbox" id="reg-admin" v-model="authForm.isAdmin" />
                  <label for="reg-admin" style="margin-bottom: 0; cursor: pointer;">註冊為管理員</label>
                </div>
                
                <button type="submit" class="btn-auth-submit minimal-btn" :disabled="isAuthLoading">
                  <span v-if="isAuthLoading" class="spinner-inline"></span>
                  <span v-else>{{ authMode === 'register' ? '註冊新帳號' : (authMode === 'admin' ? '管理員登入' : '學生登入') }} ➔</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        <!-- 右側：質感物品網格展示 -->
        <div class="auth-right">
          <div class="showcase-grid">
            <div class="showcase-card">
              <div class="img-wrapper"><img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" alt="Camera" /></div>
              <div class="showcase-info">
                <h4>高階單眼</h4>
                <p>專業攝影器材</p>
              </div>
            </div>
            <div class="showcase-card">
              <div class="img-wrapper"><img src="https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" alt="Drone" /></div>
              <div class="showcase-info">
                <h4>空拍機</h4>
                <p>高空視野記錄</p>
              </div>
            </div>
            <div class="showcase-card">
              <div class="img-wrapper"><img src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" alt="Microphone" /></div>
              <div class="showcase-info">
                <h4>電容麥克風</h4>
                <p>純淨收音體驗</p>
              </div>
            </div>
            <div class="showcase-card">
              <div class="img-wrapper"><img src="https://images.unsplash.com/photo-1626218174358-7769486c4b79?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" alt="Tablet" /></div>
              <div class="showcase-info">
                <h4>平板電腦</h4>
                <p>活動簽到必備</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ==================== View 2: 租借大廳頁面 ==================== -->
      <div v-else-if="currentView === 'gallery'" class="gallery-view" key="gallery">
        <!-- 搜尋與篩選區域 -->
        <div class="filter-bar">
          <input 
            v-model="searchQuery" 
            type="text" 
            class="search-input" 
            placeholder="🔍 輸入物品名稱、規格關鍵字搜尋..."
          />
          
          <div class="category-tabs">
            <button 
              v-for="cat in categories" 
              :key="cat"
              class="cat-tab"
              :class="{ 'active': selectedCategory === cat }"
              @click="selectedCategory = cat"
            >
              {{ cat }}
            </button>
          </div>
        </div>

        <!-- 主體：物品大廳 + 借用車 (左右分欄) -->
        <div class="split-container">
          <!-- 左邊物品大廳 -->
          <section class="items-section">
            <div class="items-header">
              <h2 class="section-title">可租借物品大廳</h2>
              <span class="count-badge">共 {{ filteredItems.length }} 項結果</span>
            </div>
            
            <div v-if="isItemsLoading" class="items-grid">
              <div v-for="i in 6" :key="i" class="grid-item skeleton-card">
                <div class="skeleton-img"></div>
                <div class="skeleton-content">
                  <div class="skeleton-text title"></div>
                  <div class="skeleton-text desc"></div>
                  <div class="skeleton-text desc short"></div>
                </div>
              </div>
            </div>
            
            <div v-else-if="filteredItems.length === 0" class="no-items-placeholder empty-state">
              <div class="empty-state-icon">🔍</div>
              <p>無符合篩選條件的物品</p>
              <button class="btn-clear-filter" @click="searchQuery=''; selectedCategory='全部'">清除篩選</button>
            </div>
            
            <div v-else class="items-grid">
              <div v-for="item in filteredItems" :key="item.id" class="grid-item">
                <ItemCard 
                  :item="item" 
                  @add-to-cart="handleAddToCart"
                  @view-details="openItemModal"
                  @join-waitlist="handleJoinWaitlist"
                />
              </div>
            </div>
          </section>

          <!-- 右邊借用清單區 -->
          <aside class="cart-sidebar">
            <div class="sidebar-sticky">
              <h2 class="section-title">我的借用清單</h2>
              
              <!-- 空狀態 -->
              <div v-if="cart.length === 0" class="cart-empty empty-state">
                <div class="empty-state-icon">📥</div>
                <p>借用清單目前為空</p>
                <p class="empty-hint">去左側物品大廳挑選看看吧！</p>
              </div>

              <!-- 清單內容 -->
              <div v-else class="cart-content">
                <ul class="cart-list">
                  <li v-for="(cartItem, index) in cart" :key="cartItem.id" class="cart-item">
                    <div class="cart-item-info">
                      <span class="cart-item-name">{{ cartItem.name }}</span>
                      <span class="cart-item-deposit">小計押金: ${{ cartItem.deposit * cartItem.borrow_quantity }}</span>
                    </div>
                    <div class="cart-item-actions">
                      <div class="qty-control">
                        <button class="btn-qty" @click="handleQuantityChange(cartItem, -1)">-</button>
                        <span class="qty-display">{{ cartItem.borrow_quantity }}</span>
                        <button class="btn-qty" @click="handleQuantityChange(cartItem, 1)">+</button>
                      </div>
                      <button class="btn-remove" @click="handleRemoveFromCart(index)">移除</button>
                    </div>
                  </li>
                </ul>

                <div class="cart-summary">
                  <div class="summary-row">
                    <span>已選數量</span>
                    <strong>{{ cart.length }} 件</strong>
                  </div>
                  <div class="summary-row">
                    <span>預估總押金</span>
                    <strong class="total-deposit">${{ cart.reduce((sum, item) => sum + item.deposit * item.borrow_quantity, 0) }}</strong>
                  </div>
                  
                  <div class="input-group">
                    <label for="borrower-input" class="input-label">借用人姓名 / 學號確認</label>
                    <input 
                      id="borrower-input"
                      v-model="borrowerName" 
                      type="text" 
                      class="input-borrower" 
                      required
                    />
                  </div>

                  <button class="btn-submit" @click="submitBorrowRequest" :disabled="isSubmittingBorrow">
                    <span v-if="isSubmittingBorrow" class="spinner-inline"></span>
                    <span v-else>確認送出借用申請</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <!-- ==================== View: 通知中心頁面 ==================== -->
      <div v-else-if="currentView === 'notifications'" class="notifications-view" key="notifications">
        
        <div class="notifications-container">
          <div v-if="notifications.length === 0" class="empty-state">
             <p>目前沒有任何通知</p>
          </div>
          <div v-else class="notif-page-list">
            <div v-for="n in notifications" :key="n.id" class="notif-page-item" :class="{ unread: !n.read }">
              <div class="notif-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C19A6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </div>
              <div class="notif-content">
                <h4>{{ n.title }}</h4>
                <p>{{ n.message }}</p>
                <span class="notif-time">{{ n.time }}</span>
                <br>
                <button class="notif-action-btn" v-if="n.title === '候補通知'" @click="currentView = 'gallery'">前往大廳</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== View: 數據儀表板頁面 ==================== -->
      <div v-else-if="currentView === 'dashboard'" class="dashboard-view" key="dashboard">
        
        <div class="dashboard-grid">
          
          <div class="dashboard-card score-card">
            <h3>信用積分</h3>
            <div class="score-display">
              <div class="score-circle">
                <span class="score-value">{{ userScore }}</span>
                <span class="score-label">/ 100</span>
              </div>
            </div>
            <p class="score-desc" v-if="userScore >= 100">完美的借用紀錄，繼續保持！</p>
            <p class="score-desc" v-else-if="userScore >= 80">信用良好，請記得準時歸還物品。</p>
            <p class="score-desc text-danger" v-else>您的積分過低，已暫停借用權限。</p>
          </div>

          <div class="dashboard-card chart-card">
            <h3>近期借用分類偏好</h3>
            <div class="chart-container" v-if="myRecords.length > 0">
              <div class="css-pie-chart" :style="`background: conic-gradient(
                #171717 0% ${categoryStats.photo}%, 
                #C19A6B ${categoryStats.photo}% ${categoryStats.photo + categoryStats.music}%, 
                #A09486 ${categoryStats.photo + categoryStats.music}% 100%
              )`"></div>
              <div class="chart-legend">
                <div class="legend-item"><span class="color-box" style="background: #171717;"></span>攝影器材</div>
                <div class="legend-item"><span class="color-box" style="background: #C19A6B;"></span>樂器</div>
                <div class="legend-item"><span class="color-box" style="background: #A09486;"></span>活動器材</div>
              </div>
            </div>
            <div v-else class="empty-chart">
              尚未有借用紀錄
            </div>
          </div>
          
          <div class="dashboard-card stats-card">
            <h3>總計摘要</h3>
            <div class="stats-row">
              <div class="stat-box">
                <span class="stat-num">{{ myRecords.length }}</span>
                <span class="stat-label">歷史總借用次數</span>
              </div>
              <div class="stat-box">
                <span class="stat-num">{{ myRecords.filter(r => r.status === 'active').length }}</span>
                <span class="stat-label">目前持有物品</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ==================== View 3: 我的租借箱分頁 ==================== -->
      <div v-else-if="currentView === 'cabinet'" class="cabinet-view" key="cabinet">
        <div class="split-container">
          
          <!-- 左側：個人租借歷史清單 -->
          <section class="records-section">
            <h2 class="section-title">📦 個人物品借用箱</h2>
            
            <div v-if="myRecords.length === 0" class="no-records-placeholder">
              您目前沒有任何物品的借用歷史
            </div>
            
            <div v-else class="records-list">
              <div v-for="rec in myRecords" :key="rec.id" class="record-card" :class="rec.status">
                <img :src="rec.item_image" alt="item" class="record-img" />
                
                <div class="record-details">
                  <div class="record-meta">
                    <span class="record-category">{{ rec.item_category }}</span>
                    <!-- 狀態標記 -->
                    <span class="record-status-tag" :class="rec.status">
                      {{ rec.status === 'pending' ? '審核中' : rec.status === 'active' ? '借出中' : '已歸還' }}
                    </span>
                  </div>
                  
                  <h4 class="record-title">{{ rec.item_name }}</h4>
                  
                  <div class="record-dates">
                    <p>📅 借用日期：{{ rec.borrow_date }}</p>
                    <p class="return-limit">⏳ 預計歸還：{{ rec.return_date }}</p>
                  </div>
                  
                  <div class="record-specs">
                    <p>💰 已付押金：<strong>${{ rec.deposit }}</strong></p>
                    <p>📍 歸還地點：<span class="location-text" :title="rec.return_location">{{ rec.return_location }}</span></p>
                  </div>
                  
                  <div class="record-actions" v-if="rec.status !== 'returned'">
                    <button class="btn-return" @click="openReturnModal(rec)">歸還物品</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 右側：自建日曆行事曆 -->
          <aside class="calendar-sidebar">
            <div class="calendar-box">
              <div class="calendar-header">
                <button class="calendar-btn" @click="prevMonth">◀</button>
                <h3 class="calendar-month-title">{{ calendarTitle }}</h3>
                <button class="calendar-btn" @click="nextMonth">▶</button>
              </div>

              <!-- 週日到週六標題 -->
              <div class="calendar-grid">
                <div 
                  v-for="w in ['日', '一', '二', '三', '四', '五', '六']" 
                  :key="w" 
                  class="calendar-weekday"
                >
                  {{ w }}
                </div>
                
                <!-- 日曆網格天數 -->
                <div 
                  v-for="(dayObj, idx) in calendarDays" 
                  :key="idx" 
                  class="calendar-day" 
                  :class="{ 
                    'empty': !dayObj.day, 
                    'has-events': dayObj.records.length > 0 
                  }"
                >
                  <span class="day-number" v-if="dayObj.day">{{ dayObj.day }}</span>
                  
                  <!-- 日期內的事件氣泡 -->
                  <div class="day-events" v-if="dayObj.day && dayObj.records.length > 0">
                    <div class="event-tag group-return-tag">
                      還
                      <div class="return-tooltip">
                        <div class="tooltip-title">📅 當日預計歸還</div>
                        <div class="tooltip-divider"></div>
                        <div 
                          v-for="(count, name) in groupRecordsByName(dayObj.records)" 
                          :key="name" 
                          class="tooltip-item"
                        >
                          <span class="item-name" :title="name">{{ name }}</span>
                          <span class="item-count">x{{ count }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="calendar-legend">
                <span class="legend-dot"></span> 有物品預計歸還 (滑鼠移入日曆『還』可見詳情)
              </div>
            </div>

            <!-- 負責人歸還密碼驗證 (改為在日曆正下方對齊) -->
            <transition name="fade-slide">
              <div v-if="showReturnModal" class="return-confirm-card">
                <div class="return-card-header">
                  <h3 class="return-card-title">🛡️ 物品負責人歸還確認</h3>
                  <button class="btn-close-card" @click="showReturnModal = false">×</button>
                </div>
                
                <div class="return-card-body">
                  <div class="return-info-card" v-if="recordToReturn">
                    <div class="item-preview-row">
                      <img :src="recordToReturn.item_image" alt="item" class="item-preview-img" />
                      <div class="item-preview-info">
                        <span class="badge category-badge" style="background-color: rgba(59, 130, 246, 0.08); color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">{{ recordToReturn.item_category }}</span>
                        <h4 style="margin: 4px 0; font-size: 0.95rem; color: #1e293b; font-weight: 600;">{{ recordToReturn.item_name }}</h4>
                        <p class="borrower-text" style="margin: 0; font-size: 0.8rem; color: #64748b;">借用人：{{ recordToReturn.borrower }}</p>
                      </div>
                    </div>
                    
                    <div class="info-list" style="background-color: #f8fafc; padding: 12px 16px; border-radius: 12px; margin-bottom: 20px;">
                      <div class="info-item" style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem;">
                        <span class="info-label" style="color: #64748b;">📍 歸還地點：</span>
                        <span class="info-value text-highlight" style="font-weight: 600; color: #3b82f6;">{{ recordToReturn.return_location }}</span>
                      </div>
                      <div class="info-item" style="display: flex; justify-content: space-between; margin-bottom: 0; font-size: 0.85rem;">
                        <span class="info-label" style="color: #64748b;">📅 預計歸還：</span>
                        <span class="info-value" style="font-weight: 600; color: #334155;">{{ recordToReturn.return_date }}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="password-input-section">
                    <label for="return-password" style="display: block; font-size: 0.85rem; color: #475569; margin-bottom: 8px; font-weight: 500;">請由負責人輸入「歸還密碼」以核對物品狀況：</label>
                    <input 
                      id="return-password"
                      type="password" 
                      v-model="returnPassword" 
                      placeholder="請輸入負責人歸還密碼"
                      class="password-input"
                      @keyup.enter="confirmReturnItem"
                    />
                  </div>
                </div>
                
                <div class="return-card-footer" style="margin-top: 16px; display: flex; justify-content: flex-end; gap: 12px;">
                  <button class="btn-secondary" @click="showReturnModal = false" style="background-color: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">取消</button>
                  <button class="btn-primary btn-submit-return" @click="confirmReturnItem" :disabled="isSubmittingReturn" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; min-width: 100px;">
                    <span v-if="isSubmittingReturn" class="spinner-inline"></span>
                    <span v-else>確認歸還</span>
                  </button>
                </div>
              </div>
            </transition>
          </aside>

        </div>
      </div>

      <!-- ==================== View: 管理員後台 ==================== -->
      <div v-else-if="currentView === 'admin'" class="admin-view" key="admin">
        <h2 style="font-size: 2rem; font-weight: 800; color: #171717; margin-bottom: 32px; -webkit-text-fill-color: initial;">⚙️ 物品管理與補貨</h2>
        <div class="admin-grid">
          <!-- 上架表單 -->
          <div class="admin-card upload-card">
            <h3>📦 新增物品上架</h3>
            <form @submit.prevent="submitNewItem" class="admin-form">
              <div class="input-field"><label>物品名稱</label><input v-model="newItemForm.name" required></div>
              <div class="input-field"><label>分類</label><select v-model="newItemForm.category"><option>攝影器材</option><option>活動器材</option><option>樂器</option></select></div>
              <div class="input-field"><label>上傳圖片 (檔案或網址)</label>
  <div style="display: flex; gap: 8px;">
    <input type="file" @change="handleImageUpload" accept="image/*" style="flex:1;">
    <input v-model="newItemForm.image" placeholder="或輸入圖片網址" style="flex:1;">
  </div>
</div>
              <div class="input-field"><label>規格說明</label><textarea v-model="newItemForm.description"></textarea></div>
              <div class="input-row">
                <div class="input-field"><label>押金</label><input type="number" v-model="newItemForm.deposit" min="0"></div>
                <div class="input-field"><label>初始數量</label><input type="number" v-model="newItemForm.total_quantity" min="1"></div>
              </div>
              <div class="input-field"><label>歸還地點 (出租方)</label><input v-model="newItemForm.return_location" required></div>
              <button type="submit" class="btn-primary" style="width: 100%; margin-top: 12px; border:none; background:#171717; color:#fff; padding:12px; border-radius:8px;">確認上架物品</button>
            </form>
          </div>
          <!-- 物品清單 (下架/補貨) -->
          <div class="admin-card inventory-card">
            <h3>📋 庫存管理</h3>
            <div class="inventory-list">
              <div v-for="item in adminItems" :key="item.id" class="inventory-item">
                <img :src="item.image" class="inv-img">
                <div class="inv-info">
                  <h4>{{ item.name }}</h4>
                  <p>庫存: {{ item.total_quantity - item.borrowed_quantity }} / {{ item.total_quantity }}</p>
                  <span class="inv-status" :class="item.status === 'available' ? 'status-ok' : 'status-bad'">{{ item.status === 'available' ? '可借用' : '已下架/無庫存' }}</span>
                </div>
                <div class="inv-actions">
                  <button class="btn-stock" @click="toggleItemStock(item, 1)" title="補貨 1 個">+1</button>
                  <button class="btn-stock" @click="toggleItemStock(item, -1)" title="下架 1 個" :disabled="item.total_quantity <= item.borrowed_quantity">-1</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== View: 規則與積分說明 ==================== -->
      <div v-else-if="currentView === 'rules'" class="rules-view" key="rules">
        <h2 class="rules-main-title">📜 規則與積分說明</h2>
        
        <div class="rules-grid">
          <!-- 卡片 1: 信用積分說明 -->
          <div class="rule-card gradient-1">
            <div class="rule-icon">🌟</div>
            <h3>信用積分系統</h3>
            <p class="rule-desc">維持良好借用習慣，確保您的借用權益。</p>
            <ul class="rule-list">
              <li><strong>預設積分</strong>：每位學生初始為 100 分。</li>
              <li><strong>準時歸還</strong>：每次 <span class="text-success">+5</span> 分，系統給予感謝！</li>
              <li><strong class="text-danger">逾期歸還</strong>：每次 <strong class="text-danger">-10</strong> 分，請準時送回。</li>
              <li><strong class="text-danger">停權機制</strong>：當積分 <strong>低於 80 分</strong> 時，系統將自動暫停您的借用權限。</li>
            </ul>
          </div>
          
          <!-- 卡片 2: 借用詳細規則 -->
          <div class="rule-card gradient-2">
            <div class="rule-icon">📋</div>
            <h3>租借詳細規則</h3>
            <p class="rule-desc">了解系統限制，讓資源妥善分配。</p>
            <ul class="rule-list">
              <li><strong>數量限制</strong>：單一物品每次最多可借 <strong>3 個</strong>。</li>
              <li><strong>預設租期</strong>：預設借用天數為 <strong>7 天</strong>，請於到期日前歸還。</li>
              <li><strong>庫存機制</strong>：若庫存不足，可加入「候補排隊」，歸還後會第一時間通知。</li>
              <li><strong>歸還地點</strong>：請依據物品卡片上的「歸還地點」確實交還管理員。</li>
              <li><strong>歸還確認</strong>：歸還物品時，需由<strong>物品負責人輸入正確密碼</strong>確認後，才算完成歸還手續並更新信用積分。</li>
            </ul>
          </div>
          
          <!-- 卡片 3: 物品保護規範 -->
          <div class="rule-card gradient-3">
            <div class="rule-icon">🛡️</div>
            <h3>物品保護與賠償</h3>
            <p class="rule-desc">愛惜公物，讓學弟妹也能享有良好資源。</p>
            <ul class="rule-list">
              <li><strong>借前檢查</strong>：領取物品時請當場確認外觀與功能正常。</li>
              <li><strong>妥善使用</strong>：禁止私自拆卸、改裝或於惡劣環境使用。</li>
              <li><strong class="text-danger">損壞賠償</strong>：若造成物品損壞或遺失，需依系辦公室規定<strong>照價賠償</strong>，並扣除大量信用積分。</li>
            </ul>
          </div>
        </div>
      </div>
      </Transition>


      <!-- ==================== Modal: 物品詳情與評價 ==================== -->
      <ItemDetailsModal 
        :is-open="isModalOpen" 
        :item="selectedModalItem" 
        :token="token"
        @close="isModalOpen = false" 
      />

    </main>

    <!-- 聯絡室懸浮按鈕與面板 -->
    <div class="chat-widget" v-if="token && currentView !== 'auth'">
      <button class="chat-fab" @click="toggleChatRoom">💬<br><span style="font-size:0.6rem;">聯絡室</span></button>
      <transition name="fade-slide">
        <div class="chat-panel" v-if="showChatRoom">
          <div class="chat-header">
            <h3>💬 聯絡室 {{ userRole === 'admin' ? '(管理員模式)' : '' }}</h3>
            <button class="btn-close" @click="showChatRoom = false">×</button>
          </div>
          <div class="chat-body">
            <div class="chat-sidebar">
              <div class="chat-sidebar-title">對象</div>
              <div v-for="l in chatLessors" :key="l.name || (l.user_id + l.lessor_name)" 
                   class="lessor-item" 
                   :class="{'active': (userRole === 'admin' ? (currentChatLessor === l.lessor_name && chatTargetUserId === l.user_id) : currentChatLessor === l.name)}"
                   @click="selectLessor(l)">
                <div class="lessor-avatar">{{ (l.name || l.lessor_name).charAt(0) }}</div>
                <div class="lessor-name">{{ userRole === 'admin' ? `${l.lessor_name} (${l.username})` : l.name }}</div>
              </div>
            </div>
            <div class="chat-content">
              <div class="chat-messages" v-if="currentChatLessor" ref="messagesContainer">
                <div v-for="m in chatMessages" :key="m.id" class="message-bubble" :class="(userRole === 'admin' && m.sender === 'lessor') || (userRole !== 'admin' && m.sender === 'student') ? 'sent' : 'received'">
                  <div class="msg-text">{{ m.content }}</div>
                  <div class="msg-time">{{ m.created_at.split(' ')[1] }}</div>
                </div>
                <div v-if="chatMessages.length === 0" class="chat-empty">尚未有對話記錄，開始打招呼吧！</div>
              </div>
              <div class="chat-placeholder" v-else>請選擇左側對象以開始對話</div>
              <div class="chat-input-area" v-if="currentChatLessor">
                <input v-model="chatInput" @keyup.enter="sendChatMessage" placeholder="輸入訊息..." />
                <button @click="sendChatMessage" class="btn-send-msg">傳送</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style>
/* ==================== 頁面轉場動畫 (Liquid Glass/Smooth Fade) ==================== */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

/* ==================== Loading Spinner & Skeleton ==================== */
.spinner-inline {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #ffffff;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed !important;
  transform: none !important;
  box-shadow: none !important;
}

.skeleton-card {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0,0,0,0.02);
}

.skeleton-img {
  width: 100%;
  padding-top: 66.67%;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-content {
  padding: 20px;
}

.skeleton-text {
  height: 14px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 12px;
}

.skeleton-text.title {
  height: 20px;
  width: 70%;
  margin-bottom: 16px;
}

.skeleton-text.short {
  width: 40%;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ==================== Empty States ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  border: 1px dashed #cbd5e1;
}

.empty-state-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.8;
  animation: float 3s ease-in-out infinite;
}

.btn-clear-filter {
  margin-top: 16px;
  background: #f1f5f9;
  border: none;
  color: #475569;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear-filter:hover {
  background: #e2e8f0;
  color: #1e293b;
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

/* ==================== 響應式排版 (RWD) ==================== */
@media (max-width: 1024px) {
  .split-container {
    flex-direction: column;
  }
  
  .cart-sidebar, .calendar-sidebar {
    width: 100%;
    margin-top: 24px;
  }
  
  .sidebar-sticky {
    position: relative;
    top: 0;
  }
  
  .app-title {
    font-size: 1.2rem;
  }
}

/* ==================== 全域微電商現代質感風格 ==================== */
body {
  margin: 0;
  font-family: 'Inter', 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  color: #1e293b;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* 佈局結構 */
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid #EAEAEA;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.02);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
}

.app-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  color: #171717;
  letter-spacing: -0.5px;
}

.user-badge {
  font-size: 0.8rem;
  background-color: #F4EBE1;
  color: #171717;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 600;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-tab {
  background: none;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  color: #64748b;
  padding: 8px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-tab:hover {
  background-color: #f1f5f9;
  color: #1e293b;
}

.nav-tab.active {
  background-color: #171717;
  color: #ffffff;
}

.btn-logout {
  background: none;
  border: 1px solid #cbd5e1;
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-logout:hover {
  background-color: #fef2f2;
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

/* 主內容區 */
.app-main {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 24px;
  box-sizing: border-box;
  flex-grow: 1;
}

/* ==================== 登入/註冊卡片樣式 (左右分割質感設計) ==================== */
.split-auth-layout {
  display: flex;
  min-height: 100vh;
  background-color: #F4EBE1;
  width: 100vw;
  margin: 0;
  padding: 0;
}

.auth-main-full {
  padding: 0 !important;
  margin: 0 !important;
  max-width: 100% !important;
  width: 100vw;
}

.auth-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background-color: #F4EBE1;
}

.auth-left-content {
  max-width: 440px;
  width: 100%;
}

.brand-title {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1.1;
  color: #171717;
  margin-bottom: 20px;
  letter-spacing: -1px;
}

.brand-slogan {
  font-size: 1.05rem;
  color: #5A524A;
  margin-bottom: 40px;
  line-height: 1.6;
}

.auth-card-minimal {
  background: transparent;
}

.minimal-tabs {
  display: flex;
  gap: 16px;
  margin-bottom: 30px;
}

.minimal-tabs .auth-tab {
  flex: none;
  background: transparent;
  border: none;
  font-size: 1.1rem;
  font-weight: 700;
  color: #A09486;
  padding: 0 0 8px 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  transition: all 0.3s;
}

.minimal-tabs .auth-tab:hover {
  color: #171717;
  background: transparent;
}

.minimal-tabs .auth-tab.active {
  color: #171717;
  border-bottom-color: #171717;
  box-shadow: none;
}

.minimal-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.minimal-input label {
  font-size: 0.85rem;
  color: #171717;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.minimal-input input {
  width: 100%;
  padding: 16px 0;
  border: none;
  border-bottom: 1px solid #D6CEC4;
  background: transparent;
  font-size: 1.1rem;
  color: #171717;
  border-radius: 0;
  transition: all 0.3s;
}

.minimal-input input:focus {
  outline: none;
  border-bottom-color: #171717;
  box-shadow: none;
}

.minimal-input input::placeholder {
  color: #A09486;
}

.minimal-btn {
  margin-top: 10px;
  background: #171717;
  color: #FFFFFF;
  padding: 18px 24px;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 1px;
  border: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 0;
  cursor: pointer;
  transition: transform 0.3s, background 0.3s;
}

.minimal-btn:hover {
  background: #333333;
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}

.auth-right {
  flex: 1.2;
  background-color: #FFFFFF;
  padding: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  width: 100%;
  max-width: 600px;
}

.showcase-card {
  background: #F9F9F9;
  border-radius: 16px;
  overflow: hidden;
  transition: transform 0.3s;
  cursor: pointer;
}

.showcase-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
}

.showcase-card .img-wrapper {
  width: 100%;
  padding-top: 100%;
  position: relative;
  overflow: hidden;
}

.showcase-card img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
}

.showcase-card:hover img {
  transform: scale(1.05);
}

.showcase-info {
  padding: 16px;
  text-align: center;
}

.showcase-info h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  color: #171717;
}

.showcase-info p {
  margin: 0;
  font-size: 0.8rem;
  color: #A09486;
}

@media (max-width: 992px) {
  .split-auth-layout {
    flex-direction: column;
  }
  .auth-right {
    padding: 40px 20px;
  }
}

/* ==================== 租借大廳樣式 ==================== */
.filter-bar {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 20px;
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.01);
}

.search-input {
  width: 100%;
  padding: 14px 20px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  font-size: 0.95rem;
  color: #171717;
  box-sizing: border-box;
  background-color: #f8fafc;
  transition: all 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: #171717;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(23, 23, 23, 0.1);
}

.category-tabs {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.cat-tab {
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.cat-tab:hover {
  background-color: #e2e8f0;
  color: #171717;
}

.cat-tab.active {
  background: #171717;
  color: #ffffff;
  border: 1px solid #171717;
  box-shadow: 0 4px 10px rgba(23, 23, 23, 0.15);
}

.split-container {
  display: flex;
  gap: 32px;
}

.items-section {
  flex: 1;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.count-badge {
  font-size: 0.85rem;
  color: #64748b;
  background-color: #f1f5f9;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: 500;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.no-items-placeholder {
  padding: 80px 0;
  color: #94a3b8;
  font-size: 1rem;
}

/* 借用清單側邊欄 */
.cart-sidebar {
  width: 340px;
  flex-shrink: 0;
}

.sidebar-sticky {
  position: sticky;
  top: 100px;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 4px 25px rgba(0, 0, 0, 0.02);
}

.cart-empty {
  text-align: center;
  padding: 48px 0;
  color: #94a3b8;
}

.empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 0.8rem;
  color: #cbd5e1;
}

.cart-list {
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
  max-height: 250px;
  overflow-y: auto;
}

.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.cart-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.cart-item-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
}

.cart-item-deposit {
  font-size: 0.8rem;
  color: #f59e0b;
  font-weight: 500;
}

.btn-remove {
  background: none;
  border: none;
  color: #ef4444;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-remove:hover {
  background-color: #fef2f2;
}

.cart-summary {
  border-top: 1px solid #e2e8f0;
  padding-top: 20px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  margin-bottom: 12px;
  color: #475569;
}

.summary-row strong {
  color: #1e293b;
}

.total-deposit {
  color: #f59e0b !important;
  font-size: 1.1rem;
}

.input-group {
  margin: 16px 0 20px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.input-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
}

.input-borrower {
  width: 100%;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 0.9rem;
  color: #171717;
  background-color: #f8fafc;
  box-sizing: border-box;
  transition: all 0.3s;
}

.input-borrower:focus {
  outline: none;
  border-color: #171717;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(23, 23, 23, 0.1);
}

.btn-submit {
  width: 100%;
  border: none;
  background: #171717;
  color: #ffffff;
  padding: 14px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
}

.btn-submit:hover {
  background-color: #333333;
  transform: translateY(-1px);
}

/* ==================== 我的租借箱分頁樣式 ==================== */
.records-section {
  flex: 1;
}

.no-records-placeholder {
  padding: 80px 0;
  background-color: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 20px;
  color: #94a3b8;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 租借歷史卡片 */
.record-card {
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 18px;
  padding: 20px;
  display: flex;
  gap: 20px;
  align-items: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.01);
  transition: transform 0.3s;
}

.record-card:hover {
  transform: scale(1.01);
}

.record-img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 12px;
}

.record-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.record-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.record-category {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 600;
  background-color: #f1f5f9;
  padding: 3px 8px;
  border-radius: 6px;
}

/* 狀態標籤 */
.record-status-tag {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
}

.record-status-tag.pending {
  color: #C19A6B;
  background-color: rgba(193, 154, 107, 0.1);
}

.record-status-tag.active {
  color: #171717;
  background-color: rgba(23, 23, 23, 0.08);
}

.record-status-tag.returned {
  color: #A09486;
  background-color: rgba(160, 148, 134, 0.15);
}

.record-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 10px 0;
}

.record-dates {
  display: flex;
  gap: 24px;
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 8px;
}

.record-dates p {
  margin: 0;
}

.return-limit {
  color: #ef4444;
  font-weight: 600;
}

.record-specs {
  display: flex;
  gap: 24px;
  font-size: 0.8rem;
  color: #64748b;
}

.record-specs p {
  margin: 0;
}

.location-text {
  background-color: #f8fafc;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

/* ==================== 自建日曆行事曆樣式 ==================== */
.calendar-sidebar {
  width: 380px;
  flex-shrink: 0;
}

.calendar-box {
  background-color: #ffffff;
  border: 1px solid #EAEAEA;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.calendar-btn {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(226, 232, 240, 0.6);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  transition: all 0.3s;
  box-shadow: 0 2px 5px rgba(0,0,0,0.02);
}

.calendar-btn:hover {
  background-color: #ffffff;
  border-color: #cbd5e1;
  transform: scale(1.05);
}

.calendar-month-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #171717;
}

/* 日曆網格 */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 16px;
}

.calendar-weekday {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  padding: 6px 0;
  text-align: center;
}

.calendar-day {
  aspect-ratio: 1;
  background-color: rgba(255, 255, 255, 0.4);
  border-radius: 10px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.5);
  min-height: 42px;
  box-sizing: border-box;
  transition: all 0.3s ease;
}

.calendar-day:hover:not(.empty) {
  background-color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.calendar-day.empty {
  background: none;
  border: none;
}

.day-number {
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  text-align: left;
}

/* 當天有物品歸還 */
.calendar-day.has-events {
  background-color: #fffbeb;
  border-color: #fde68a;
}

.calendar-day.has-events .day-number {
  color: #b45309;
  font-weight: 700;
}

.day-events {
  display: flex;
  gap: 2px;
  justify-content: center;
}

.event-tag {
  background-color: #f59e0b;
  color: #ffffff;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 4px;
  cursor: help;
  user-select: none;
  animation: pulse-event 2s infinite;
}

.calendar-legend {
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-top: 1px solid #f1f5f9;
  padding-top: 16px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  background-color: #f59e0b;
  border-radius: 50%;
}

@keyframes pulse-event {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); box-shadow: 0 0 5px rgba(245, 158, 11, 0.4); }
  100% { transform: scale(1); }
}

/* 新增：使用者徽章與積分 */
.user-badges {
  display: flex;
  gap: 8px;
  align-items: center;
}
.score-badge {
  font-size: 0.8rem;
  background-color: #f1f5f9;
  color: #3b82f6;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 600;
}
.score-badge.low-score {
  color: #ef4444;
  background-color: #fef2f2;
}

/* 新增：歸還按鈕 */
.record-actions {
  margin-top: 12px;
  text-align: right;
  border-top: 1px dashed #e2e8f0;
  padding-top: 12px;
}
.btn-return {
  background: linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-return:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* 響應式調整 */
@media (max-width: 992px) {
  .split-container {
    flex-direction: column;
  }
  .cart-sidebar, .calendar-sidebar {
    width: 100%;
  }
  .sidebar-sticky {
    position: static;
  }
}

/* ==================== 升級計畫：數量控制與字體顏色調整 ==================== */
.section-title {
  color: #171717;
  font-weight: 800;
}
.cart-empty {
  color: #475569;
}
.summary-row {
  color: #1e293b;
  font-weight: 600;
}
.input-label {
  color: #1e293b;
  font-weight: 700;
}

/* 購物車內數量調整 */
.cart-item-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.qty-control {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #f1f5f9;
  border-radius: 6px;
  padding: 2px;
}
.btn-qty {
  border: none;
  background-color: #ffffff;
  color: #1e293b;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: all 0.2s;
}
.btn-qty:hover {
  background-color: #e2e8f0;
}
.qty-display {
  font-size: 0.85rem;
  font-weight: 600;
  width: 20px;
  text-align: center;
  color: #171717;
}

/* ==================== 規則與積分頁面 ==================== */
.rules-view {
  padding: 20px 0;
}
.rules-main-title {
  font-size: 2rem;
  color: #171717;
  text-align: center;
  margin-bottom: 40px;
  font-weight: 800;
  color: #171717;
  letter-spacing: -0.5px;
}
.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}
.rule-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  transition: transform 0.3s;
}
.rule-card:hover {
  transform: translateY(-5px);
}
.rule-icon {
  font-size: 2.5rem;
  margin-bottom: 16px;
}
.rule-card h3 {
  font-size: 1.4rem;
  color: #171717;
  margin-bottom: 12px;
  font-weight: 700;
}
.rule-desc {
  font-size: 0.95rem;
  color: #475569;
  margin-bottom: 20px;
  line-height: 1.5;
}
.rule-list {
  padding-left: 20px;
  color: #1e293b;
  font-size: 0.95rem;
  line-height: 1.8;
}
.text-danger {
  color: #ef4444;
}
.text-success {
  color: #10b981;
  font-weight: 700;
}
.gradient-1 {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(255, 255, 255, 0.9) 100%);
}
.gradient-2 {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(255, 255, 255, 0.9) 100%);
}
.gradient-3 {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(255, 255, 255, 0.9) 100%);
}

/* ==================== 負責人歸還確認卡片樣式 (日曆下方對齊) ==================== */
.return-confirm-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  margin-top: 20px;
  text-align: left;
  box-sizing: border-box;
  animation: fade-slide-in 0.3s ease-out;
}

.return-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 12px;
}

.return-card-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #171717;
}

.btn-close-card {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
  transition: color 0.2s;
}

.btn-close-card:hover {
  color: #475569;
}

.return-card-body {
  padding: 0;
}

.item-preview-row {
  display: flex;
  gap: 16px;
  align-items: center;
  background-color: #f8fafc;
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 16px;
}

.item-preview-img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
}

.item-preview-info h4 {
  margin: 4px 0;
  font-size: 0.95rem;
  color: #1e293b;
  font-weight: 600;
}

.borrower-text {
  margin: 0;
  font-size: 0.8rem;
  color: #64748b;
}

.info-list {
  background-color: #f8fafc;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.85rem;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #64748b;
}

.info-value {
  font-weight: 600;
  color: #334155;
}

.text-highlight {
  color: #3b82f6;
}

.password-input-section {
  margin-bottom: 8px;
}

.password-input-section label {
  display: block;
  font-size: 0.85rem;
  color: #475569;
  margin-bottom: 8px;
  font-weight: 500;
}

.password-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.password-input:focus {
  border-color: #3b82f6;
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.btn-submit-return {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}
.btn-submit-return:hover {
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

/* 歸還卡片動畫 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==================== Tooltip 樣式 (防越界處理) ==================== */
.group-return-tag {
  position: relative;
  display: inline-block;
}

.return-tooltip {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  bottom: calc(100% + 8px);
  /* 預設置中 */
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  width: max-content;
  min-width: 180px;
  max-width: 250px;
  background-color: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(8px);
  color: #ffffff;
  text-align: left;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
  z-index: 100;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: normal;
  line-height: 1.4;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
  white-space: normal;
}

/* 箭頭 */
.return-tooltip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 6px;
  border-style: solid;
  border-color: rgba(15, 23, 42, 0.95) transparent transparent transparent;
}

.group-return-tag:hover .return-tooltip {
  visibility: visible;
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* 防止最右側單元格 (星期五/六) 越界 */
.calendar-day:nth-child(7n) .return-tooltip,
.calendar-day:nth-child(7n-1) .return-tooltip {
  left: auto;
  right: -10px;
  transform: translateX(0) translateY(4px);
}
.calendar-day:nth-child(7n) .group-return-tag:hover .return-tooltip,
.calendar-day:nth-child(7n-1) .group-return-tag:hover .return-tooltip {
  transform: translateX(0) translateY(0);
}
/* 修正右側箭頭位置 */
.calendar-day:nth-child(7n) .return-tooltip::after,
.calendar-day:nth-child(7n-1) .return-tooltip::after {
  left: auto;
  right: 18px;
  transform: translateX(0);
}

.tooltip-title {
  font-weight: 700;
  color: #fde68a;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tooltip-divider {
  height: 1px;
  background-color: rgba(255, 255, 255, 0.1);
  margin-bottom: 6px;
}

.tooltip-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.tooltip-item:last-child {
  margin-bottom: 0;
}

.tooltip-item .item-name {
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.tooltip-item .item-count {
  background-color: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  padding: 0px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
}

/* ==================== 通知中心 ==================== */
.notification-wrapper {
  position: relative;
}
.icon-tab {
  position: relative;
  font-size: 1.2rem;
}
.badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #C19A6B;
  color: #fff;
  font-size: 0.6rem;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
}
.notification-dropdown {
  position: absolute;
  top: 120%;
  right: 0;
  width: 320px;
  background: #fff;
  border: 1px solid #EAEAEA;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.08);
  z-index: 200;
  overflow: hidden;
}
.notif-header {
  padding: 16px;
  background: #FAFAFA;
  border-bottom: 1px solid #EAEAEA;
  font-weight: 700;
  color: #171717;
}
.notif-list {
  max-height: 300px;
  overflow-y: auto;
}
.notif-item {
  padding: 16px;
  border-bottom: 1px solid #EAEAEA;
}
.notif-item.unread {
  background: rgba(193, 154, 107, 0.05);
}
.notif-item h4 { margin: 0 0 4px 0; font-size: 0.9rem; color: #171717; }
.notif-item p { margin: 0 0 8px 0; font-size: 0.8rem; color: #5A524A; }
.notif-time { font-size: 0.7rem; color: #A09486; }

/* ==================== 數據儀表板 ==================== */
.dashboard-view {
  padding: 0 24px;
}

.view-title {
  font-size: 2rem;
  font-weight: 800;
  color: #171717;
  margin-bottom: 32px;
  -webkit-text-fill-color: initial;
  background: none;
  text-align: left;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}
.dashboard-card {
  background: #fff;
  border: 1px solid #EAEAEA;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.02);
}
.dashboard-card h3 {
  margin: 0 0 24px 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #171717;
  -webkit-text-fill-color: initial;
  background: none;
}

.score-display {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 8px solid #F4EBE1;
  border-top-color: #C19A6B;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
.score-value { font-size: 2rem; font-weight: 800; color: #171717; }
.score-label { font-size: 0.8rem; color: #A09486; }
.score-desc { text-align: center; color: #5A524A; font-size: 0.9rem; }

.chart-container {
  display: flex;
  gap: 24px;
  align-items: center;
}
.css-pie-chart {
  width: 100px;
  height: 100px;
  border-radius: 50%;
}
.chart-legend { display: flex; flex-direction: column; gap: 8px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #5A524A; }
.color-box { width: 12px; height: 12px; border-radius: 3px; }
.empty-chart { text-align: center; color: #A09486; padding: 40px 0; }

.stats-row {
  display: flex;
  gap: 24px;
}
.stat-box {
  flex: 1;
  background: #FAFAFA;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
}
.stat-num { display: block; font-size: 2rem; font-weight: 800; color: #171717; margin-bottom: 4px; }
.stat-label { font-size: 0.8rem; color: #A09486; }

/* ==================== 微動畫 ==================== */
.staggered-fade-enter-active,
.staggered-fade-leave-active {
  transition: all 0.5s ease;
}
.staggered-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.staggered-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
.grid-item {
  animation: fadeUp 0.6s ease forwards;
  opacity: 0;
}
@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}

.empty-svg {
  margin-bottom: 16px;
  animation: float 4s ease-in-out infinite;
}

.notifications-view {
  padding: 0 24px;
  max-width: 800px;
  margin: 0 auto;
}
.notifications-container {
  background: #fff;
  border: 1px solid #EAEAEA;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.02);
  overflow: hidden;
}
.notif-page-item {
  display: flex;
  gap: 20px;
  padding: 24px 32px;
  border-bottom: 1px solid #EAEAEA;
  align-items: center;
  text-align: left;
  transition: background 0.3s;
}
.notif-page-item:hover {
  background: #FAFAFA;
}
.notif-page-item:last-child {
  border-bottom: none;
}
.notif-page-item.unread {
  background: rgba(193, 154, 107, 0.05);
}
.notif-icon-wrapper {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #EAEAEA;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.02);
}
.notif-content {
  flex: 1;
}
.notif-content h4 { 
  margin: 0 0 6px 0; 
  font-size: 1.15rem; 
  color: #171717; 
  font-weight: 700;
  -webkit-text-fill-color: initial;
}
.notif-content p { 
  margin: 0 0 8px 0; 
  font-size: 0.95rem; 
  color: #5A524A; 
  line-height: 1.5;
}
.notif-time { 
  font-size: 0.8rem; 
  color: #A09486; 
  font-weight: 500;
}
.notif-action-btn {
  padding: 8px 16px;
  background: #171717;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}
.notif-action-btn:hover {
  transform: translateY(-2px);
}
/* ==================== Admin View ==================== */
.admin-view { padding: 0 24px; max-width: 1000px; margin: 0 auto; }
.admin-grid { display: flex; gap: 24px; align-items: flex-start; }
.admin-card { background: #fff; border: 1px solid #EAEAEA; border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.02); flex: 1; }
.admin-card h3 { margin: 0 0 20px 0; font-size: 1.1rem; color: #171717; }
.admin-form .input-field { margin-bottom: 16px; }
.admin-form label { display: block; font-size: 0.85rem; color: #5A524A; margin-bottom: 8px; font-weight: 600; }
.admin-form input, .admin-form select, .admin-form textarea { width: 100%; padding: 10px; border: 1px solid #EAEAEA; border-radius: 8px; background: #FAFAFA; box-sizing: border-box; color: #171717; }
.admin-form textarea { height: 80px; resize: vertical; }
.input-row { display: flex; gap: 16px; }
.input-row .input-field { flex: 1; }

.inventory-list { display: flex; flex-direction: column; gap: 16px; max-height: 500px; overflow-y: auto; }
.inventory-item { display: flex; gap: 16px; padding: 12px; border: 1px solid #EAEAEA; border-radius: 12px; align-items: center; }
.inv-img { width: 60px; height: 60px; object-fit: cover; border-radius: 8px; }
.inv-info { flex: 1; }
.inv-info h4 { margin: 0 0 4px 0; font-size: 1rem; color: #171717; -webkit-text-fill-color: initial; }
.inv-info p { margin: 0 0 4px 0; font-size: 0.8rem; color: #5A524A; }
.inv-status { font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
.status-ok { background: rgba(16, 185, 129, 0.1); color: #10B981; }
.status-bad { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
.inv-actions { display: flex; flex-direction: column; gap: 8px; }
.btn-stock { background: #FAFAFA; border: 1px solid #EAEAEA; border-radius: 6px; padding: 4px 12px; cursor: pointer; font-weight: 600; transition: 0.2s; }
.btn-stock:hover:not(:disabled) { background: #EAEAEA; }
.btn-stock:disabled { opacity: 0.5; cursor: not-allowed; }

/* ==================== Chat Room ==================== */
.chat-widget { position: fixed; right: 30px; bottom: 30px; z-index: 1000; display: flex; flex-direction: column; align-items: flex-end; }
.chat-fab { width: 64px; height: 64px; border-radius: 50%; background: #171717; color: #fff; border: none; box-shadow: 0 10px 25px rgba(0,0,0,0.2); cursor: pointer; font-size: 1.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.chat-fab:hover { transform: scale(1.1); }
.chat-panel { position: absolute; bottom: 80px; right: 0; width: 400px; height: 500px; background: #fff; border-radius: 20px; box-shadow: 0 15px 40px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; border: 1px solid #EAEAEA; }
.chat-header { background: #171717; color: #fff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
.chat-header h3 { margin: 0; font-size: 1.1rem; color: #fff; -webkit-text-fill-color: initial; }
.btn-close { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; }
.chat-body { display: flex; flex: 1; height: calc(100% - 56px); }
.chat-sidebar { width: 140px; background: #FAFAFA; border-right: 1px solid #EAEAEA; overflow-y: auto; }
.chat-sidebar-title { font-size: 0.75rem; color: #A09486; font-weight: 700; padding: 12px; text-transform: uppercase; }
.lessor-item { padding: 12px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: background 0.2s; border-bottom: 1px solid #EAEAEA; }
.lessor-item:hover { background: #f0f0f0; }
.lessor-item.active { background: #fff; border-left: 3px solid #C19A6B; }
.lessor-avatar { width: 24px; height: 24px; background: #C19A6B; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; flex-shrink: 0; }
.lessor-name { font-size: 0.85rem; color: #171717; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chat-content { flex: 1; display: flex; flex-direction: column; background: #fff; }
.chat-messages { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.message-bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; position: relative; }
.message-bubble.sent { align-self: flex-end; background: #171717; color: #fff; border-bottom-right-radius: 4px; }
.message-bubble.received { align-self: flex-start; background: #F4EBE1; color: #171717; border-bottom-left-radius: 4px; }
.msg-text { font-size: 0.9rem; line-height: 1.4; word-break: break-all; }
.msg-time { font-size: 0.65rem; opacity: 0.7; margin-top: 4px; text-align: right; }
.chat-empty { text-align: center; color: #A09486; font-size: 0.85rem; margin-top: 40px; }
.chat-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: #A09486; font-size: 0.9rem; }
.chat-input-area { padding: 12px; border-top: 1px solid #EAEAEA; display: flex; gap: 8px; background: #fff; }
.chat-input-area input { flex: 1; padding: 8px 12px; border: 1px solid #EAEAEA; border-radius: 20px; outline: none; font-size: 0.9rem; }
.chat-input-area input:focus { border-color: #C19A6B; }
.btn-send-msg { background: #C19A6B; color: #fff; border: none; padding: 8px 16px; border-radius: 20px; font-weight: 600; cursor: pointer; transition: 0.2s; }
.btn-send-msg:hover { background: #b0895a; }

</style>
