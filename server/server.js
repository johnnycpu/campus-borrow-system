const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'campus-item-borrow-secret-key-2026';

// 啟用 CORS 與 JSON 解析中介軟體
app.use(cors());
app.use(express.json());

// 設定 SQLite 資料庫連線路徑 (同目錄下的 database.db)
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('資料庫連線失敗:', err.message);
  } else {
    console.log('成功連線至 SQLite 資料庫。');
    initializeDatabase();
  }
});

// ==================== JWT 驗證中介軟體 ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // 取得 Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({ success: false, message: '未經授權，請先登入系統' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: '憑證無效或已過期，請重新登入' });
    }
    req.user = user; // 將使用者資訊存入 req 供後續路由使用
    next();
  });
};

// ==================== 資料庫初始化 ====================
function initializeDatabase() {
  db.serialize(() => {
    // 1. 建立 users 資料表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'student',
        score INTEGER DEFAULT 100,
        badges TEXT DEFAULT '[]'
      )
    `, (err) => {
      if (err) console.error('建立 users 資料表失敗:', err.message);
      else console.log('users 資料表檢查/建立成功。');
    });

    // 2. 建立 items 資料表 (擴充規格：押金、總量、已借量、歸還地)
    db.run(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        image TEXT,
        status TEXT DEFAULT 'available',
        description TEXT,
        deposit INTEGER DEFAULT 0,
        total_quantity INTEGER DEFAULT 1,
        borrowed_quantity INTEGER DEFAULT 0,
        return_location TEXT DEFAULT '系辦公室',
        model_url TEXT
      )
    `, (err) => {
      if (err) {
        console.error('建立 items 資料表失敗:', err.message);
        return;
      }
      console.log('items 資料表檢查/建立成功。');
      
      // 檢查是否已有物品，若無則寫入 7 筆精緻種子資料
      db.get('SELECT COUNT(*) as count FROM items', [], (err, row) => {
        if (err) return;
        if (row.count === 0) {
          insertDummyItems();
        }
      });
    });

    // 3. 建立 records 資料表 (擴充規格：連結 user_id、押金記錄)
    db.run(`
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        borrower TEXT NOT NULL,
        borrow_date TEXT NOT NULL,
        return_date TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        deposit INTEGER DEFAULT 0,
        FOREIGN KEY (item_id) REFERENCES items (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `, (err) => {
      if (err) console.error('建立 records 資料表失敗:', err.message);
      else console.log('records 資料表檢查/建立成功。');
    });

    // 4. 建立 reviews 資料表 (評價)
    db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `, (err) => {
      if (err) console.error('建立 reviews 資料表失敗:', err.message);
      else console.log('reviews 資料表檢查/建立成功。');
    });

    // 5. 建立 waitlists 資料表 (候補)
    db.run(`
      CREATE TABLE IF NOT EXISTS waitlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT DEFAULT 'waiting',
        FOREIGN KEY (item_id) REFERENCES items (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `, (err) => {
      if (err) console.error('建立 waitlists 資料表失敗:', err.message);
      else console.log('waitlists 資料表檢查/建立成功。');
    });
  });
}

// 插入 7 筆精美種子資料 (Unsplash 高畫質真實物品連結、押金與庫存)
function insertDummyItems() {
  const dummyItems = [
    {
      name: "Sony FX3 電影級專業相機",
      category: "攝影器材",
      image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600",
      status: "available",
      description: "資工系辦公室的鎮系之寶，具備雙原生 ISO 與強大暗光表現，拍片創作的最佳首選。",
      deposit: 3000,
      total_quantity: 2,
      borrowed_quantity: 0,
      return_location: "工程館三樓資工系辦公室",
      model_url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/AntiqueCamera/glTF-Binary/AntiqueCamera.glb"
    },
    {
      name: "Rode Wireless GO II 無線麥克風 (一拖二)",
      category: "攝影器材",
      image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600",
      status: "available",
      description: "雙通道無線收音系統，傳輸距離遠，音質清晰透亮，適合專題訪談或影片錄製。",
      deposit: 500,
      total_quantity: 5,
      borrowed_quantity: 0,
      return_location: "工程館三樓資工系辦公室",
      model_url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb"
    },
    {
      name: "DJI Mini 4 Pro 專業空拍機 (含屏遙控器)",
      category: "攝影器材",
      image: "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=600",
      status: "available",
      description: "249g 超輕巧無人空拍機，具備全向避障與 4K 垂直拍攝功能。撞牆需照價賠償。",
      deposit: 2000,
      total_quantity: 3,
      borrowed_quantity: 1, // 預先借出 1 筆
      return_location: "工程館三樓資工系辦公室",
      model_url: "https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb" // 暫時使用太空人代替無人機
    },
    {
      name: "Fender Player Stratocaster 電吉他",
      category: "樂器",
      image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600",
      status: "available",
      description: "經典 Stratocaster 琴身，熱音社友情贊助。音色乾淨清脆，適合各式曲風彈奏練習。",
      deposit: 1500,
      total_quantity: 2,
      borrowed_quantity: 0,
      return_location: "社團大樓四樓熱音社辦公室",
      model_url: null
    },
    {
      name: "YAMAHA P-125 數位攜帶型電子琴",
      category: "樂器",
      image: "https://images.unsplash.com/photo-1552422535-c45813c61732?w=600",
      status: "available",
      description: "配備 GHS 漸進式琴鍵，觸感極佳。附琴架、延音踏板，便於練習與小型成果演出。",
      deposit: 2000,
      total_quantity: 1,
      borrowed_quantity: 1, // 總量 1 借出 1，可用應為 0 (測試前端按鈕禁用)
      return_location: "社團大樓三樓鋼琴社辦公室",
      model_url: null
    },
    {
      name: "Shure SM58 專業動圈式麥克風",
      category: "活動器材",
      image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600",
      status: "available",
      description: "世界公認的傳奇舞台人聲麥克風，心形指向性結構能有效隔離背景雜音，防摔耐撞。",
      deposit: 200,
      total_quantity: 10,
      borrowed_quantity: 0,
      return_location: "活動中心二樓課外活動組",
      model_url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb"
    },
    {
      name: "Epson EB-FH52 4K雷射無線行動投影機",
      category: "活動器材",
      image: "https://images.unsplash.com/photo-1535016120720-40c646be5580?w=600",
      description: "具備 4000 流明高亮度，在亮光環境下投影依然清晰，支援 Miracast 無線投影投放。",
      deposit: 1200,
      status: "available",
      total_quantity: 4,
      borrowed_quantity: 0,
      return_location: "活動中心二樓課外活動組",
      model_url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxTextured/glTF-Binary/BoxTextured.glb"
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO items (name, category, image, status, description, deposit, total_quantity, borrowed_quantity, return_location, model_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  dummyItems.forEach(item => {
    stmt.run(item.name, item.category, item.image, item.status, item.description, item.deposit, item.total_quantity, item.borrowed_quantity, item.return_location, item.model_url);
  });
  stmt.finalize(() => {
    console.log('成功寫入 7 筆精緻物品種子資料。');
  });
}

// ==================== 使用者認證 API ====================

// 1. 使用者註冊
app.post('/api/auth/register', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '請輸入帳號 (username) 與密碼 (password)' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: '資料庫錯誤' });
    if (user) return res.status(400).json({ success: false, message: '此帳號已被註冊' });

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).json({ success: false, error: '密碼加密失敗' });

      const insertSql = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
      db.run(insertSql, [username, hashedPassword, role || 'student'], function(err) {
        if (err) return res.status(500).json({ success: false, error: '註冊失敗' });
        res.status(201).json({
          success: true,
          message: '註冊成功！',
          data: { id: this.lastID, username, role: role || 'student' }
        });
      });
    });
  });
});

// 2. 使用者登入
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '請輸入帳號與密碼' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: '資料庫錯誤' });
    if (!user) return res.status(401).json({ success: false, message: '帳號或密碼錯誤' });

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err || !isMatch) return res.status(401).json({ success: false, message: '帳號或密碼錯誤' });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: '登入成功！',
        token,
        user: { id: user.id, username: user.username, role: user.role, score: user.score, badges: JSON.parse(user.badges || '[]') }
      });
    });
  });
});

// 3. 取得當前使用者最新資訊
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, role, score, badges FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: '資料庫錯誤' });
    if (!user) return res.status(404).json({ success: false, message: '找不到使用者' });
    
    res.json({
      success: true,
      user: { ...user, badges: JSON.parse(user.badges || '[]') }
    });
  });
});

// ==================== 租借系統 API ====================

// 1. 取得所有物品
app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    
    // 動態修正 items 的 status (若 borrowed_quantity >= total_quantity，標記為 borrowed)
    const fixedRows = rows.map(item => {
      const isOut = item.borrowed_quantity >= item.total_quantity;
      return {
        ...item,
        status: isOut ? 'borrowed' : 'available'
      };
    });

    res.json({ success: true, data: fixedRows });
  });
});

// 2. 申請借用物品 (需驗證 Token，整合庫存管理與交易處理，並支援數量選擇)
app.post('/api/records', authenticateToken, (req, res) => {
  const { item_id, borrower, return_date, quantity } = req.body;
  const user_id = req.user.id; // 從 JWT 解出使用者 ID

  if (!item_id || !borrower || !return_date) {
    return res.status(400).json({ success: false, message: '缺少必要欄位 (item_id, borrower, return_date)' });
  }

  const borrow_date = new Date().toISOString().split('T')[0];

  // 先取得使用者的積分，檢查是否 < 80，若小於 80 則停權
  db.get('SELECT score FROM users WHERE id = ?', [user_id], (err, userRow) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (userRow.score < 80) {
      return res.status(403).json({ success: false, message: `您的信用積分 (${userRow.score}) 低於 80 分，已被暫停借用權限。` });
    }

    // 解析數量，預設為 1，最大限制為 3
    const qty = Math.min(3, Math.max(1, parseInt(quantity) || 1));

    // 1. 確認物品庫存狀態
    db.get('SELECT * FROM items WHERE id = ?', [item_id], (err, item) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!item) return res.status(404).json({ success: false, message: '找不到此物品' });

      const availableQty = item.total_quantity - item.borrowed_quantity;
      if (availableQty < qty) {
        return res.status(400).json({ success: false, message: `【${item.name}】可用庫存不足，目前剩餘 ${availableQty} 個` });
      }

      // 2. 開始交易處理
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        let successCount = 0;
        let hasError = false;

        const insertSql = `
          INSERT INTO records (user_id, item_id, borrower, borrow_date, return_date, status, deposit)
          VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `;

        // 動作 A：向 records 寫入 qty 筆紀錄
        for (let i = 0; i < qty; i++) {
          db.run(insertSql, [user_id, item_id, borrower, borrow_date, return_date, item.deposit], function(err) {
            if (hasError) return; // 發生錯誤即停止後續動作
            
            if (err) {
              hasError = true;
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, error: err.message });
            }
            
            successCount++;

            // 當所要求的數量皆寫入成功後，更新 items 資料表
            if (successCount === qty) {
              // 動作 B：更新 items 借出數量 + qty
              const newBorrowedQty = item.borrowed_quantity + qty;
              const newStatus = newBorrowedQty >= item.total_quantity ? 'borrowed' : 'available';

              db.run('UPDATE items SET borrowed_quantity = ?, status = ? WHERE id = ?', [newBorrowedQty, newStatus, item_id], function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ success: false, error: err.message });
                }

                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ success: false, error: '提交租借交易失敗' });
                  }

                  res.json({
                    success: true,
                    message: '借用申請成功提交！',
                    data: {
                      item_id,
                      borrower,
                      borrow_date,
                      return_date,
                      status: 'pending',
                      deposit: item.deposit,
                      quantity: qty
                    }
                  });
                });
              });
            }
          });
        }
      });
    });
  });
});

// 3. 取得當端登入使用者的租借箱清單
app.get('/api/my-records', authenticateToken, (req, res) => {
  const user_id = req.user.id;
  
  const sql = `
    SELECT r.*, i.name as item_name, i.category as item_category, i.image as item_image, i.return_location
    FROM records r
    JOIN items i ON r.item_id = i.id
    WHERE r.user_id = ?
    ORDER BY r.id DESC
  `;

  db.all(sql, [user_id], (err, rows) => {
    if (err) {
      console.error('查詢個人租借箱失敗:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

// 4. 歸還物品 (處理歸還邏輯與信用積分)
app.post('/api/records/:id/return', authenticateToken, (req, res) => {
  const record_id = req.params.id;
  const user_id = req.user.id;
  const { password } = req.body;

  // 驗證物品負責人歸還密碼
  if (password !== 'admin123') {
    return res.status(401).json({ success: false, message: '負責人歸還密碼錯誤，請洽管理員確認！' });
  }
  
  db.get('SELECT * FROM records WHERE id = ? AND user_id = ?', [record_id, user_id], (err, record) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!record) return res.status(404).json({ success: false, message: '找不到此借用紀錄' });
    if (record.status === 'returned') return res.status(400).json({ success: false, message: '此物品已歸還' });

    // 判斷是否逾期
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = today > record.return_date;
    const scoreChange = isOverdue ? -10 : 5; // 逾期扣 10 分，準時加 5 分
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // 1. 更新紀錄狀態為已歸還
      db.run('UPDATE records SET status = "returned" WHERE id = ?', [record_id], function(err) {
        if (err) { db.run('ROLLBACK'); return res.status(500).json({ success: false, error: err.message }); }
        
        // 2. 更新物品數量與狀態 (歸還後借出數量 -1)
        db.get('SELECT * FROM items WHERE id = ?', [record.item_id], (err, item) => {
          if (err || !item) { db.run('ROLLBACK'); return res.status(500).json({ success: false, error: '物品查詢失敗' }); }
          
          const newBorrowedQty = Math.max(0, item.borrowed_quantity - 1);
          const newStatus = newBorrowedQty >= item.total_quantity ? 'borrowed' : 'available';

          db.run('UPDATE items SET borrowed_quantity = ?, status = ? WHERE id = ?', [newBorrowedQty, newStatus, item.id], function(err) {
            if (err) { db.run('ROLLBACK'); return res.status(500).json({ success: false, error: err.message }); }

            // 3. 更新使用者信用積分
            db.run('UPDATE users SET score = score + ? WHERE id = ?', [scoreChange, user_id], function(err) {
              if (err) { db.run('ROLLBACK'); return res.status(500).json({ success: false, error: err.message }); }

              db.run('COMMIT', (err) => {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ success: false, error: '提交交易失敗' }); }
                res.json({ 
                  success: true, 
                  message: isOverdue ? '歸還成功，但因逾期已扣除信用積分。' : '歸還成功！感謝您的準時歸還。', 
                  scoreChange, 
                  isOverdue 
                });
              });
            });
          });
        });
      });
    });
  });
});

// ==================== 評價系統 API ====================

// 1. 取得指定物品的評價
app.get('/api/items/:id/reviews', (req, res) => {
  const item_id = req.params.id;
  const sql = `
    SELECT r.*, u.username 
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.item_id = ?
    ORDER BY r.id DESC
  `;
  db.all(sql, [item_id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

// 2. 新增評價 (限已登入且借過該物品的使用者)
app.post('/api/items/:id/reviews', authenticateToken, (req, res) => {
  const item_id = req.params.id;
  const user_id = req.user.id;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: '請提供 1 到 5 星的評分' });
  }

  // 確認使用者是否借過此物品
  db.get('SELECT * FROM records WHERE item_id = ? AND user_id = ?', [item_id, user_id], (err, record) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!record) return res.status(403).json({ success: false, message: '您必須先借用過此物品才能發表評價' });

    const created_at = new Date().toISOString();
    const insertSql = 'INSERT INTO reviews (item_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)';
    
    db.run(insertSql, [item_id, user_id, rating, comment || '', created_at], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.status(201).json({ success: true, message: '評價發布成功！', data: { id: this.lastID } });
    });
  });
});

// ==================== 候補排隊 API ====================
// 1. 加入候補名單
app.post('/api/items/:id/waitlist', authenticateToken, (req, res) => {
  const item_id = req.params.id;
  const user_id = req.user.id;

  // 確認物品是否真的無庫存
  db.get('SELECT * FROM items WHERE id = ?', [item_id], (err, item) => {
    if (err || !item) return res.status(404).json({ success: false, message: '找不到物品' });
    if (item.total_quantity - item.borrowed_quantity > 0) {
      return res.status(400).json({ success: false, message: '此物品目前有庫存，可直接借用！' });
    }

    // 確認是否已在排隊中
    db.get('SELECT * FROM waitlists WHERE item_id = ? AND user_id = ? AND status = "waiting"', [item_id, user_id], (err, waitlist) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (waitlist) return res.status(400).json({ success: false, message: '您已經在此物品的候補名單中了！' });

      const created_at = new Date().toISOString();
      db.run('INSERT INTO waitlists (item_id, user_id, created_at, status) VALUES (?, ?, ?, "waiting")', [item_id, user_id, created_at], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: '成功加入候補！當物品歸還時，系統將保留給您。' });
      });
    });
  });
});

// 啟動監聽
app.listen(PORT, () => {
  console.log(`後端伺服器正在運行於 http://localhost:${PORT}`);
});
