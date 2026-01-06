using System;
using Autodesk.Revit.UI;
using System.Reflection;
using RevitMCP.Core;
using RevitMCP.Configuration;

namespace RevitMCP
{
    public class Application : IExternalApplication
    {
        private static SocketService _socketService;
        private static UIApplication _uiApp;

        public static SocketService SocketService => _socketService;
        public static UIApplication UIApp => _uiApp;

        public Result OnStartup(UIControlledApplication application)
        {
            try
            {
                // 创建功能区面板
                RibbonPanel panel = application.CreateRibbonPanel("MCP Tools");
                
                string assemblyPath = Assembly.GetExecutingAssembly().Location;

                // 1. MCP 服务切换按钮 (Toggle)
                PushButtonData toggleButtonData = new PushButtonData(
                    "MCPToggle",
                    "MCP 服务\n(开/关)",
                    assemblyPath,
                    "RevitMCP.Commands.ToggleServiceCommand");
                toggleButtonData.ToolTip = "启动或停止 MCP WebSocket 服务";
                // 建议：如果有图示资源，可以在这里设置 LargeImage
                PushButton toggleButton = panel.AddItem(toggleButtonData) as PushButton;

                // 3. 设置按钮
                PushButtonData settingsButtonData = new PushButtonData(
                    "MCPSettings",
                    "MCP\n设置",
                    assemblyPath,
                    "RevitMCP.Commands.SettingsCommand");
                settingsButtonData.ToolTip = "打开 MCP 设置窗口";
                PushButton settingsButton = panel.AddItem(settingsButtonData) as PushButton;

                // 初始化配置管理器
                _ = ConfigManager.Instance;

                // 初始化 ExternalEventManager (必须在 UI 线程创建)
                _ = ExternalEventManager.Instance;

                TaskDialog.Show("RevitMCP", 
                    "RevitMCP 插件已加载\n\n" +
                    "请点击「MCP 服务 (开/关)」按钮来启用 AI 控制功能");
                
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("错误", "加载 MCP 工具失败: " + ex.Message);
                return Result.Failed;
            }
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            try
            {
                // 停止 Socket 服务
                if (_socketService != null)
                {
                    _socketService.Stop();
                }
                
                return Result.Succeeded;
            }
            catch
            {
                return Result.Failed;
            }
        }

        /// <summary>
        /// 启动 MCP 服务
        /// </summary>
        public static void StartMCPService(UIApplication uiApp)
        {
            try
            {
                _uiApp = uiApp;
                var settings = ConfigManager.Instance.Settings;

                if (_socketService != null && _socketService.IsConnected)
                {
                    TaskDialog.Show("MCP 服务", "服务已在执行中");
                    return;
                }

                // 建立 Socket 服务
                _socketService = new SocketService(settings);

                // 订阅命令接收事件
                _socketService.CommandReceived += OnCommandReceived;

                // 启动服务
                _socketService.StartAsync().ConfigureAwait(false);

                // 更新设置
                settings.IsEnabled = true;
                ConfigManager.Instance.SaveSettings();
            }
            catch (Exception ex)
            {
                TaskDialog.Show("错误", $"启动 MCP 服务失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 停止 MCP 服务
        /// </summary>
        public static void StopMCPService()
        {
            try
            {
                if (_socketService != null)
                {
                    _socketService.Stop();
                    _socketService = null;
                }

                var settings = ConfigManager.Instance.Settings;
                settings.IsEnabled = false;
                ConfigManager.Instance.SaveSettings();
            }
            catch (Exception ex)
            {
                TaskDialog.Show("错误", $"停止 MCP 服务失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 处理接收到的命令
        /// </summary>
        private static async void OnCommandReceived(object sender, Models.RevitCommandRequest request)
        {
            // 使用外部事件在 Revit UI 线程执行命令
            ExternalEventManager.Instance.ExecuteCommand((uiApp) =>
            {
                try
                {
                    var executor = new CommandExecutor(uiApp  );
                    var response = executor.ExecuteCommand(request);

                    // 发送回应
                    _socketService?.SendResponseAsync(response).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    var errorResponse = new Models.RevitCommandResponse
                    {
                        Success = false,
                        Error = ex.Message,
                        RequestId = request.RequestId
                    };

                    _socketService?.SendResponseAsync(errorResponse).ConfigureAwait(false);
                }
            });
        }
    }
}
