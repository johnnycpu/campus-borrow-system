---
description: 初始化 2026 期末專題「校園物品借用系統」的前後端分離（server/client）專案骨架與資料庫連接。
---

請讀取目前的 workweb 目錄，並嚴格執行以下專案初始化步驟：

1. 在根目錄下建立一個名為 /server 的資料夾。在裡面初始化 npm 專案（npm init -y），並安裝 express、sqlite3、cors 與 nodemon。建立一個基礎的 server.js，設定好連接 database.db 的 SQLite 基礎代碼。
2. 在根目錄下建立一個名為 /client 的資料夾。在裡面使用 Vite 腳手架建立一個最基礎的 Vue 3 專案（純 JavaScript 即可），並安裝 axios 用於未來呼叫 API。
3. 自動修改 /server 和 /client 的 package.json 中的啟動腳本，確保設定完全正確。

執行完成後，請將新建立的所有結構與代碼加入當前的上下文記憶中。