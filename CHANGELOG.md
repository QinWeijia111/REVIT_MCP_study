# 變更日誌 (Changelog)

所有重要的專案變更都會記錄在此檔案中。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

---

## [1.2.0] - 2024-12-11

### ✨ 新功能

#### Grid 與 Column 工具擴展
- **新增 `get_all_grids`**：取得專案中所有網格線（Grid）資訊
  - 回傳：Grid 名稱、方向（水平/垂直）、起點/終點座標（公釐）
  - 可用於計算網格交會點，配合 `create_column` 使用
- **新增 `get_column_types`**：取得專案中可用的柱類型
  - 回傳：類型名稱、族群名稱、尺寸資訊（寬x深）
  - 支援材質篩選（如：混凝土、鋼）
- **新增 `create_column`**：在指定位置建立柱子
  - 支援指定底部/頂部樓層
  - 支援指定柱類型名稱
  - 座標使用公釐，內部自動轉換為 Revit 英尺單位

### 📁 修改檔案

| 檔案 | 變更 |
|------|------|
| `MCP-Server/src/tools/revit-tools.ts` | 新增 3 個工具定義 |
| `MCP/MCP/Core/CommandExecutor.cs` | 新增 3 個命令實作 |

---

## [1.1.0] - 2024-12-11

### 🐛 Bug 修正

#### JSON 屬性名稱大小寫不匹配問題
- **問題**：MCP Server 發送的 JSON 使用 camelCase（`commandName`、`parameters`、`requestId`），但 Revit Add-in (C#) 期待 PascalCase（`CommandName`、`Parameters`、`RequestId`）
- **症狀**：透過 Gemini CLI 或其他 MCP 客戶端連線時出現「命令執行逾時」錯誤
- **修正**：修改 `MCP-Server/src/socket.ts`，將發送的 JSON 屬性名稱改為 PascalCase
- **影響範圍**：所有使用 MCP Server 的客戶端（Gemini CLI、Claude Desktop、VS Code Copilot、Antigravity）

### 📚 文件更新

#### Gemini CLI MCP 設定方式錯誤修正
- **問題**：原文件說明使用 `gemini --config gemini_mcp_config.json` 參數，但 Gemini CLI 實際上使用 `~/.gemini/settings.json` 設定 MCP
- **修正**：更新 README.md 和 README.en.md，說明正確的設定方式
- **新增內容**：
  - 設定檔位置：`%USERPROFILE%\.gemini\settings.json`
  - 如何加入 `mcpServers` 區塊
  - 使用 `/mcp list` 驗證連接

#### PowerShell 執行原則錯誤解決方法
- **問題**：Windows 預設停用 PowerShell 腳本執行，導致 `npm install` 失敗
- **新增**：在文件中加入 `Set-ExecutionPolicy` 解決方法

#### Git Clone 首次設定指南
- **問題**：透過 `git clone` 取得專案的使用者無法直接使用，因為以下檔案不包含在儲存庫中：
  - `MCP-Server/build/` - 需要執行 `npm run build` 產生
  - `MCP-Server/node_modules/` - 需要執行 `npm install` 產生
  - `MCP/MCP/bin/` - 需要編譯或下載 Release
- **新增**：在 README 中加入「⚠️ 透過 Git Clone 的首次設定」區塊

#### 設定檔硬編碼路徑問題
- **問題**：`gemini_mcp_config.json` 和 `claude_desktop_config.json` 使用硬編碼的使用者路徑
- **修正**：改為佔位符路徑 `【請修改此路徑】`，提醒使用者自行修改
- **保留**：`.vscode/mcp.json` 使用 `${workspaceFolder}` 變數，無需修改

---

## [1.0.0] - 2024-12-10

### ✨ 新功能

- 初始版本發布
- Revit Add-in (C#) 實作
- MCP Server (Node.js/TypeScript) 實作
- 支援 10 種 Revit 操作工具
- 支援多種 AI 平台（Claude Desktop、Gemini CLI、VS Code Copilot、Antigravity）

---

## 提交歷史對照

| Commit | 說明 |
|--------|------|
| `0dcdc54` | 修正 JSON 屬性名稱為 PascalCase |
| `348775d` | 修正 Gemini CLI MCP 設定說明 |
| `2e75839` | 新增 Git Clone 首次設定指南 |
| `ed7ee1b` | 新增英文版文件支援 |
| `a223ede` | 更新 WebSocket 說明與技術補充附錄 |
| `d088f06` | 新增安裝指令稿 |
