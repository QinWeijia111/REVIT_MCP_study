using System;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Autodesk.Revit.UI;
using Newtonsoft.Json;
using RevitMCP.Configuration;
using RevitMCP.Models;

namespace RevitMCP.Core
{
    /// <summary>
    /// WebSocket 服务 - 作为服务器端接收 MCP Server 的连接
    /// </summary>
    public class SocketService
    {
        private HttpListener _httpListener;
        private WebSocket _webSocket;
        private bool _isRunning;
        private readonly ServiceSettings _settings;
        private CancellationTokenSource _cancellationTokenSource;

        public event EventHandler<RevitCommandRequest> CommandReceived;
        public bool IsConnected => _webSocket != null && _webSocket.State == WebSocketState.Open;

        public SocketService(ServiceSettings settings)
        {
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
        }

        /// <summary>
        /// 启动 WebSocket 服务器
        /// </summary>
        public async Task StartAsync()
        {
            if (_isRunning)
            {
                return;
            }

            try
            {
                _cancellationTokenSource = new CancellationTokenSource();
                _isRunning = true;

                // 使用 HttpListener 来接受 WebSocket 连接
                _httpListener = new HttpListener();
                _httpListener.Prefixes.Add($"http://{_settings.Host}:{_settings.Port}/");
                _httpListener.Start();

                TaskDialog.Show("MCP 服务", $"WebSocket 服务器已启动\n监听: {_settings.Host}:{_settings.Port}");

                // 在后台线程中等待连接
                _ = Task.Run(async () => await AcceptConnectionsAsync(_cancellationTokenSource.Token));
            }
            catch (Exception ex)
            {
                _isRunning = false;
                TaskDialog.Show("错误", $"启动 WebSocket 服务器失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 接受 WebSocket 连接
        /// </summary>
        private async Task AcceptConnectionsAsync(CancellationToken cancellationToken)
        {
            while (_isRunning && !cancellationToken.IsCancellationRequested)
            {
                try
                {
                    var context = await _httpListener.GetContextAsync();
                    
                    if (context.Request.IsWebSocketRequest)
                    {
                        var wsContext = await context.AcceptWebSocketAsync(null);
                        _webSocket = wsContext.WebSocket;

                        System.Diagnostics.Debug.WriteLine("[Socket] MCP Server 已连接");

                        // 开始接收消息
                        await ReceiveMessagesAsync(cancellationToken);
                    }
                    else
                    {
                        context.Response.StatusCode = 400;
                        context.Response.Close();
                    }
                }
                catch (Exception ex)
                {
                    if (_isRunning)
                    {
                        System.Diagnostics.Debug.WriteLine($"[Socket] 接受连接错误: {ex.Message}");
                    }
                }
            }
        }

        /// <summary>
        /// 接收消息
        /// </summary>
        private async Task ReceiveMessagesAsync(CancellationToken cancellationToken)
        {
            var buffer = new byte[4096];

            try
            {
                while (_webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
                {
                    var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        HandleMessage(message);
                    }
                    else if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", cancellationToken);
                        System.Diagnostics.Debug.WriteLine("[Socket] MCP Server 已断线");
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[Socket] 接收消息错误: {ex.Message}");
            }
        }

        /// <summary>
        /// 处理接收到的消息
        /// </summary>
        private void HandleMessage(string message)
        {
            try
            {
                var request = JsonConvert.DeserializeObject<RevitCommandRequest>(message);
                CommandReceived?.Invoke(this, request);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[Socket] 解析命令失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 发送回应
        /// </summary>
        public async Task SendResponseAsync(RevitCommandResponse response)
        {
            if (!IsConnected)
            {
                throw new InvalidOperationException("WebSocket 未连接");
            }

            try
            {
                string json = JsonConvert.SerializeObject(response);
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                await _webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[Socket] 发送回应失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 停止服务
        /// </summary>
        public void Stop()
        {
            _isRunning = false;
            _cancellationTokenSource?.Cancel();

            if (_webSocket != null && _webSocket.State == WebSocketState.Open)
            {
                _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "服务关闭", CancellationToken.None).Wait();
            }

            _httpListener?.Stop();
            TaskDialog.Show("MCP 服务", "WebSocket 服务器已停止");
        }
    }
}
