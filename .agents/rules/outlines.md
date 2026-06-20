---
trigger: always_on
---

# 角色：校園物品借用系統專案專家

## 核心技術棧 (預設匹配)
- 後端：Express.js (Node.js)
- 資料庫：SQLite (使用 sqlite3 套件)
- 前端：Vue 3 (Composition API, 使用 Vite 構建)
- 專案結構：必須嚴格將前後端分離為 /server 與 /client 兩個獨立資料夾。

## 資料庫規格定義
### items (物品資料表)
- id: INTEGER 主鍵 (自動遞增)
- name: TEXT (物品名稱，如：單眼相機)
- category: TEXT (分類：攝影器材、活動器材、樂器)
- image: TEXT (圖片網址或路徑)
- status: TEXT (狀態：'available' 可借用, 'borrowed' 借出中)
- description: TEXT (物品規格簡介)

### records (借用紀錄表)
- id: INTEGER 主鍵 (自動遞增)
- item_id: INTEGER (關聯 items.id)
- borrower: TEXT (借用人學號或姓名)
- borrow_date: TEXT (借出日期)
- return_date: TEXT (預計歸還日期)
- status: TEXT (狀態：'pending' 審核中, 'active' 借出中, 'returned' 已歸還)

## 程式碼編寫規範
1. 後端 Express 必須是純 API 伺服器，嚴禁進行任何網頁渲染（API only，只回傳 JSON）。
2. 前端 Vue 的物品列表必須採用潮流電商風的卡片式（Card）排版，並重視過渡動畫與 Hover 特效。

## 語言
1. 一律只使用繁體中文（台灣習慣用語）與我對話、編寫程式碼註解及系統提示。