# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Revit MCP** is an AI-powered Revit control system that enables AI language models to directly control Autodesk Revit through the Model Context Protocol (MCP). It creates a bridge between AI assistants and Revit's BIM capabilities.

**Target Version**: Revit 2023

**Architecture**: Three-layer system
- **MCP Server** (Node.js/TypeScript): Defines MCP tools and manages AI ↔ Revit communication
- **Revit Add-in** (C#/.NET 4.8): WebSocket server running inside Revit
- **Communication**: WebSocket on port 8999 (localhost only)

## Essential Commands

### Building the Project

```powershell
# Build MCP Server (TypeScript → JavaScript)
cd MCP-Server
npm install
npm run build

# Build Revit Add-in (C# → DLL) for Revit 2023
cd MCP
dotnet build -c Release
```

### Development Workflow

```powershell
# After modifying C# code:
# 1. Close Revit (required to overwrite DLL)
# 2. Build the add-in
dotnet build -c Release

# 3. Deploy DLL (automated script)
.\scripts\install-addon.ps1

# 4. Restart Revit
```

### Testing

```powershell
# Start MCP Server in dev mode
cd MCP-Server
npm run dev

# Test WebSocket connection (requires Revit running with MCP service enabled)
node build/index.js
```

## Critical Architecture Concepts

### 1. Communication Flow

```
AI Assistant (Claude/Gemini)
    ↓ stdio/MCP protocol
MCP Server (Node.js)
    ↓ WebSocket (port 8999)
Revit Add-in (C#)
    ↓ Revit API
Revit Application
```

**Key Points**:
- MCP Server uses stdio transport (not HTTP)
- WebSocket connection is localhost-only for security
- All Revit operations run in UI thread via `ExternalEventManager`
- Coordinates use **millimeters** in MCP layer, **feet** in Revit API (conversion: `mm / 304.8`)

### 2. Transaction Management

All Revit write operations MUST be wrapped in transactions:

```csharp
using (Transaction trans = new Transaction(doc, "Description"))
{
    trans.Start();
    // Revit API operations here
    trans.Commit();
}
```

**Why**: Revit API requires explicit transaction boundaries for data modifications. Operations are reversible via Ctrl+Z.

### 3. External Events Pattern

Commands from MCP Server execute asynchronously but MUST run on Revit's UI thread:

```csharp
// In Application.cs
ExternalEventManager.Instance.ExecuteCommand((uiApp) => {
    var executor = new CommandExecutor(uiApp);
    var response = executor.ExecuteCommand(request);
    _socketService?.SendResponseAsync(response);
});
```

**Why**: Revit API is not thread-safe. External events provide the synchronization mechanism.

### 4. Element ID Compatibility

- **Revit 2022/2023**: `ElementId.IntegerValue` (int)
- **Revit 2024+**: `ElementId.IntegerValue` (long) - causes 56 warnings when using 2022 API style but functions correctly

## Project Structure

```
MCP/                          # C# Revit Add-in
├── Application.cs            # Add-in entry point, ribbon setup
├── Core/
│   ├── CommandExecutor.cs    # Main command router (all 28 tools)
│   ├── SocketService.cs      # WebSocket server implementation
│   └── ExternalEventManager.cs  # Thread synchronization
├── Models/
│   └── CommandModels.cs      # Request/Response DTOs
└── RevitMCP.2024.csproj      # Use this for Revit 2024

MCP-Server/                   # Node.js MCP Server
├── src/
│   ├── index.ts              # MCP server main entry
│   ├── socket.ts             # WebSocket client to Revit
│   └── tools/
│       └── revit-tools.ts    # All 28 MCP tool definitions
└── build/                    # Compiled output (gitignored)

domain/                       # Business workflows (read before complex tasks)
├── element-coloring-workflow.md  # How to color elements
├── corridor-analysis-protocol.md # Corridor width checking
├── fire-rating-check.md      # Fire rating compliance
└── qa-checklist.md           # Quality assurance checklist
```

## Version-Specific Guidance

### Revit 2023 (Target Version)
- Use `RevitMCP.csproj`
- DLL output: `bin/Release/RevitMCP.dll`
- Deploy to: `%APPDATA%\Autodesk\Revit\Addins\2023\RevitMCP\`
- No API warnings expected

## Important Implementation Patterns

### Adding a New MCP Tool

1. **Define tool schema** in `MCP-Server/src/tools/revit-tools.ts`:
```typescript
{
    name: "my_new_tool",
    description: "What it does",
    inputSchema: {
        type: "object",
        properties: {
            paramName: { type: "string", description: "..." }
        },
        required: ["paramName"]
    }
}
```

2. **Implement handler** in `MCP/Core/CommandExecutor.cs`:
```csharp
case "my_new_tool":
    result = MyNewTool(parameters);
    break;
```

3. **Rebuild both projects**:
```powershell
cd MCP-Server && npm run build
cd ../MCP && dotnet build -c Release
```

### Coordinate Conversion

```csharp
// MCP (mm) → Revit API (feet)
XYZ point = new XYZ(x / 304.8, y / 304.8, z / 304.8);

// Revit API (feet) → MCP (mm)
double mmValue = feetValue * 304.8;
```

### Element Graphics Override

For visual feedback (coloring elements):
```csharp
OverrideGraphicSettings override = new OverrideGraphicSettings();
override.SetCutForegroundPatternColor(new Color(r, g, b));
override.SetCutForegroundPatternId(solidPatternId);
view.SetElementOverrides(elementId, override);
```

**Pattern selection**:
- Floor plans: Use `SetCutForeground*` (cut patterns)
- Elevations/3D: Use `SetSurfaceForeground*` (surface patterns)

## Workflow-Driven Development

Before implementing complex features, check `domain/` for existing workflows:

| Keyword | Workflow File | Purpose |
|---------|---------------|---------|
| Corridor, width, escape route | `corridor-analysis-protocol.md` | Corridor width analysis |
| Fire rating, fire resistance | `fire-rating-check.md` | Fire rating compliance |
| Color, highlight, visualize | `element-coloring-workflow.md` | Element coloring workflow |
| QA, check, verify | `qa-checklist.md` | Quality assurance steps |

**Pattern**: Read workflow → Understand steps → Use existing MCP tools to implement

## Common Pitfalls

1. **Missing Transaction**: Write operations without `Transaction` will throw exceptions
2. **Wrong Thread**: Direct API calls from WebSocket handler will fail - use `ExternalEventManager`
3. **Coordinate Units**: Mixing mm/feet causes position errors - always convert
4. **View Context**: Creating dimensions in wrong view type (e.g., 3D view for floor plan dimensions)
5. **FamilySymbol Activation**: Must call `symbol.Activate()` before placing families

## Git Workflow

- **Don't commit**: `build/`, `bin/`, `obj/`, `node_modules/`
- **Commit format**: Use descriptive messages (see `git log` for style)
- **Branch**: `main` is stable, create feature branches for major changes

## Security Notes

- WebSocket server binds to `localhost:8999` ONLY (no external access)
- No authentication required (local machine trust model)
- Port 8964 mentioned in README is outdated - current implementation uses 8999

## MCP Client Configuration

This project can connect to:
- **Claude Desktop**: Configure via Settings → MCP Servers
- **Gemini CLI**: Edit `~/.gemini/settings.json`
- **VS Code Copilot**: Already configured in `.vscode/mcp.json`

All require absolute path to `MCP-Server/build/index.js` except VS Code (uses `${workspaceFolder}`).

## When Adding Features

1. Check if related workflow exists in `domain/`
2. Verify if similar tool exists in `revit-tools.ts`
3. Ensure operations are reversible (use Transactions)
4. Add coordinate conversion if handling geometry
5. Test with Revit 2023
6. Update this file if adding new architectural patterns
