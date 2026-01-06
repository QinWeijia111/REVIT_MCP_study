using System;

namespace RevitMCP.Configuration
{
    /// <summary>
    /// MCP 服务设置
    /// </summary>
    [Serializable]
    public class ServiceSettings
    {
        /// <summary>
        /// WebSocket 服务器主机地址
        /// </summary>
        public string Host { get; set; } = "localhost";

        /// <summary>
        /// WebSocket 服务器端口
        /// </summary>
        public int Port { get; set; } = 8999;

        /// <summary>
        /// 是否启用 MCP 服务
        /// </summary>
        public bool IsEnabled { get; set; } = false;

        /// <summary>
        /// 自动重连间隔（毫秒）
        /// </summary>
        public int ReconnectInterval { get; set; } = 5000;

        /// <summary>
        /// 命令执行超时时间（毫秒）
        /// </summary>
        public int CommandTimeout { get; set; } = 30000;
    }
}
