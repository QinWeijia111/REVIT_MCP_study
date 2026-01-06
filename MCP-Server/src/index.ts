#!/usr/bin/env node

/**
 * Revit MCP Server
 * 提供 AI 与 Revit 之间的 MCP 协议桥接
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { RevitSocketClient } from "./socket.js";
import { registerRevitTools, executeRevitTool } from "./tools/revit-tools.js";

// MCP 服务器实例
const server = new Server(
    {
        name: "revit-mcp-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Revit Socket 客户端
const revitClient = new RevitSocketClient();

/**
 * 处理工具列表请求
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = registerRevitTools();
    console.error(`[MCP Server] 已注册 ${tools.length} 个 Revit 工具`);
    return { tools };
});

/**
 * 处理工具调用请求
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.error(`[MCP Server] 执行工具: ${request.params.name}`);
    console.error(`[MCP Server] 参数:`, JSON.stringify(request.params.arguments, null, 2));

    try {
        // 检查 Revit 连接状态
        if (!revitClient.isConnected()) {
            console.error("[MCP Server] Revit 未连接，尝试连接...");
            await revitClient.connect();
        }

        // 执行 Revit 工具
        const result = await executeRevitTool(
            request.params.name,
            request.params.arguments || {},
            revitClient
        );

        console.error(`[MCP Server] 工具执行成功`);

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[MCP Server] 工具执行失败: ${errorMessage}`);

        return {
            content: [
                {
                    type: "text",
                    text: `错误: ${errorMessage}`,
                },
            ],
            isError: true,
        };
    }
});

/**
 * 启动服务器
 */
async function main() {
    console.error("Revit MCP Server 启动中...");
    console.error("等待 Revit Plugin 连接...");

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("MCP Server 已准备就绪");
    console.error("Socket 服务器监听端口: 8999");
}

main().catch((error) => {
    console.error("服务器启动失败:", error);
    process.exit(1);
});
