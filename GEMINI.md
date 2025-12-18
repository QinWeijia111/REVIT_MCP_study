# Gemini Context & Project Map

此檔案旨在協助 Gemini/AI 快速理解專案結構與資源位置。

## 📁 專案結構地圖

| 路徑 | 說明 | 關鍵檔案 |
| :--- | :--- | :--- |
| **`MCP/`** | **C# Revit Add-in** 核心代碼 | `CommandExecutor.cs` (核心邏輯)<br>`RevitMCP.2024.csproj` |
| **`MCP-Server/`** | **Node.js MCP Server** 與工具腳本 | `src/tools/revit-tools.ts` (工具定義)<br>`index.ts` (伺服器入口)<br>`*.js` (執行腳本) |
| **`domain/`** | **業務流程與核心知識** (優先閱讀) | `element-coloring-workflow.md` (上色流程)<br>`room-boundary.md` |
| **`docs/tools/`** | **技術規格與 API 文檔** | `override_element_color_design.md`<br>`override_graphics_examples.md` |
| **`scripts/`** | **輔助腳本** | `install-addon.ps1` (安裝腳本) |

## 🚀 常用任務索引

### 1. 元素上色與視覺化
*   **流程文件**：`domain/element-coloring-workflow.md`
*   **執行腳本**：
    *   清除顏色：`node MCP-Server/clear_walls.js`
    *   取消接合：`node MCP-Server/step_unjoin.js`
    *   上色：`node MCP-Server/fire_rating_full.js`
    *   恢復接合：`node MCP-Server/step_rejoin.js`

### 2. 房間邊界處理
*   **流程文件**：`domain/room-boundary.md`

### 3. 建置與部署
*   **C# 建置**：`dotnet build -c Release MCP/RevitMCP.2024.csproj`
*   **部署 DLL**：使用 `scripts/install-addon.ps1` 或手動複製到 `C:\ProgramData\Autodesk\Revit\Addins\2024\RevitMCP\`

## ⚠️ 開發注意事項

1.  **修改 C# 後**：必須關閉 Revit -> 編譯 -> 部署 -> 開啟 Revit。
2.  **腳本路徑**：所有 Node.js 腳本預設在 `MCP-Server/` 目錄下執行。
3.  **依賴關係**：`MCP-Server` 透過 WebSocket (Port 8765) 與 Revit Add-in 通訊。

---

## 🤖 AI 助手智能部署指南

**適用於**: Claude Desktop, Gemini CLI, VS Code Copilot, Antigravity 等 AI 助手

### 📋 使用者環境偵測協定

當使用者請求協助部署此專案時，**AI 助手應該按照以下流程進行**：

#### 第一步：環境資訊收集

**必須詢問使用者以下資訊**（如果尚未提供）：

```markdown
1. **Revit 版本**：您安裝的是哪個版本的 Revit？
   - [ ] Revit 2022
   - [ ] Revit 2023
   - [ ] Revit 2024
   - [ ] 其他版本（請說明）

2. **AI Client**：您目前使用的 AI 助手環境是？
   - [ ] Claude Desktop
   - [ ] Gemini CLI (Antigravity)
   - [ ] VS Code with Copilot
   - [ ] 其他（請說明）

3. **專案位置**：您將專案 clone 到哪個目錄？
   - 範例：`C:\\Users\\YourName\\Desktop\\REVIT_MCP_study`
```

#### 第二步：環境判斷邏輯

根據收集到的資訊，AI 助手應該：

##### A. Revit 版本判斷

```yaml
Revit 2022:
  csproj: "RevitMCP.csproj"
  build_command: "dotnet build -c Release RevitMCP.csproj"
  dll_output: "MCP\bin\Release\RevitMCP.dll"
  addins_path: "%APPDATA%\Autodesk\Revit\Addins\2022"
  api_style: "int ElementId (無警告)"
  
Revit 2023:
  csproj: "RevitMCP.csproj" 
  build_command: "dotnet build -c Release RevitMCP.csproj"
  dll_output: "MCP\bin\Release\RevitMCP.dll"
  addins_path: "%APPDATA%\Autodesk\Revit\Addins\2023"
  api_style: "int ElementId (無警告)"
  
Revit 2024:
  csproj: "RevitMCP.2024.csproj"
  build_command: "dotnet build -c Release RevitMCP.2024.csproj"
  dll_output: "MCP\bin\Release.2024\RevitMCP.dll"
  addins_path: "%APPDATA%\Autodesk\Revit\Addins\2024"
  api_style: "long ElementId (有 56 個警告但功能正常)"
  note: "警告是因為使用 Revit 2022 相容寫法，不影響功能"
```

##### B. AI Client 判斷

```yaml
Claude Desktop:
  config_file: "~/.config/claude/claude_desktop_config.json" (macOS/Linux)
               "~/AppData/Roaming/Claude/config.json" (Windows)
  config_format:
    mcpServers:
      revit-mcp:
        command: "node"
        args: ["絕對路徑\MCP-Server\build\index.js"]
  restart_required: true
  verification: "重啟 Claude Desktop 後，檢查伺服器列表"

Gemini CLI (Antigravity):
  config_file: "~/.gemini/settings.json"
  config_format:
    mcpServers:
      revit-mcp:
        command: "node"
        args: ["絕對路徑\MCP-Server\build\index.js"]
  verification: "執行 /mcp list 檢查連接"
  
VS Code Copilot:
  config_file: ".vscode/mcp.json" (專案根目錄)
  config_format:
    mcpServers:
      revit-mcp:
        command: "node"
        args: ["${workspaceFolder}/MCP-Server/build/index.js"]
  advantage: "可使用 ${workspaceFolder} 變數，不需要絕對路徑"
  restart_required: "重新載入 VS Code 視窗"
```

#### 第三步：生成客製化部署指令

**AI 助手應該根據以上判斷，生成完整的部署命令序列**：

##### 範例 1：Revit 2024 + Gemini CLI

```powershell
# 1. 建置 C# Add-in (Revit 2024)
cd "專案路徑\MCP"
dotnet build -c Release RevitMCP.2024.csproj
# 預期：56 個警告（正常，不影響功能）

# 2. 執行安裝腳本
cd ..
.\scripts\install-addon-bom.ps1
# 選擇：2024

# 3. 建置 MCP Server
cd MCP-Server
npm install
npm run build

# 4. 設定 Gemini CLI
# 編輯：~/.gemini/settings.json
# 加入：
{
  "mcpServers": {
    "revit-mcp": {
      "command": "node",
      "args": ["絕對路徑\\MCP-Server\\build\\index.js"]
    }
  }
}

# 5. 驗證
/mcp list  # 應該看到 revit-mcp
```

##### 範例 2：Revit 2022 + Claude Desktop

```powershell
# 1. 建置 C# Add-in (Revit 2022)
cd "專案路徑\MCP"
dotnet build -c Release RevitMCP.csproj
# 預期：無警告

# 2. 手動部署 (如果安裝腳本不支援 2022)
$target = "$env:APPDATA\Autodesk\Revit\Addins\2022\RevitMCP"
New-Item -ItemType Directory -Path $target -Force
Copy-Item "bin\Release\RevitMCP.dll" $target -Force
Copy-Item "RevitMCP.addin" $target -Force

# 3. 建置 MCP Server
cd ..\MCP-Server
npm install
npm run build

# 4. 設定 Claude Desktop
# Windows: %APPDATA%\Claude\config.json
# 加入 MCP server 設定

# 5. 重啟 Claude Desktop
```

### 🎯 AI 助手行為準則

1. **永遠先偵測環境**：不要假設使用者的版本或 client
2. **提供版本特定的指令**：根據 Revit 版本調整 .csproj 檔名和路徑
3. **說明警告原因**：如果是 2024，解釋 56 個警告是正常的（API 相容性）
4. **使用絕對路徑**：除了 VS Code 可用 `${workspaceFolder}`，其他都需要絕對路徑
5. **驗證步驟**：提供明確的驗證命令確認安裝成功
6. **錯誤處理**：如果使用者版本不在支援列表（2022-2024），提示需要調整 API 參照

### 🔍 常見問題處理邏輯

```yaml
問題: "建置時出現 56 個警告"
判斷:
  - 如果 Revit 版本 == 2024: 
      回應: "這是正常的。專案為了支援 2022-2024，使用 2022 相容寫法。警告不影響功能。"
  - 如果 Revit 版本 == 2022/2023:
      回應: "不應該有警告，請檢查是否使用了正確的 .csproj 檔案"

問題: "找不到 RevitMCP.dll"
判斷:
  - 檢查使用的建置命令是否匹配版本：
      2022/2023: RevitMCP.csproj → bin\Release\RevitMCP.dll
      2024: RevitMCP.2024.csproj → bin\Release.2024\RevitMCP.dll
  
問題: "MCP Server 連接失敗"
判斷:
  - 檢查設定檔中的路徑是否為絕對路徑
  - 檢查是否執行了 npm run build
  - 檢查 WebSocket port 8765 是否被佔用
```

### 📊 環境設定快速參考

| Revit 版本 | .csproj | DLL 輸出路徑 | Addins 路徑 | 警告數 |
|:----------|:--------|:------------|:-----------|:------|
| 2022 | `RevitMCP.csproj` | `bin\Release\` | `Addins\2022` | 0 |
| 2023 | `RevitMCP.csproj` | `bin\Release\` | `Addins\2023` | 0 |
| 2024 | `RevitMCP.2024.csproj` | `bin\Release.2024\` | `Addins\2024` | 56 (正常) |

| AI Client | 設定檔位置 | 路徑格式 | 重啟需求 |
|:---------|:----------|:---------|:--------|
| Claude Desktop | `~/AppData/Roaming/Claude/config.json` | 絕對路徑 | 是 |
| Gemini CLI | `~/.gemini/settings.json` | 絕對路徑 | 否 |
| VS Code | `.vscode/mcp.json` | 可用變數 | 重新載入視窗 |

---

**最後更新**: 2024-12-18
