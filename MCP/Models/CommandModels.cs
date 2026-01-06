using System;

namespace RevitMCP.Models
{
    /// <summary>
    /// Revit 命令请求模型
    /// </summary>
    [Serializable]
    public class RevitCommandRequest
    {
        /// <summary>
        /// 命令名称
        /// </summary>
        public string CommandName { get; set; }

        /// <summary>
        /// 命令参数（JSON 字符串）
        /// </summary>
        public object Parameters { get; set; }

        /// <summary>
        /// 请求 ID（用于跟踪响应）
        /// </summary>
        public string RequestId { get; set; }
    }

    /// <summary>
    /// Revit 命令回应模型
    /// </summary>
    [Serializable]
    public class RevitCommandResponse
    {
        /// <summary>
        /// 执行是否成功
        /// </summary>
        public bool Success { get; set; }

        /// <summary>
        /// 回应数据
        /// </summary>
        public object Data { get; set; }

        /// <summary>
        /// 错误信息
        /// </summary>
        public string Error { get; set; }

        /// <summary>
        /// 请求 ID
        /// </summary>
        public string RequestId { get; set; }
    }
}
