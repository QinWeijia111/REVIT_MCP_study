using System;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMCP.Commands
{
    /// <summary>
    /// 切换 MCP 服务状态命令 (开/关)
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class ToggleServiceCommand : IExternalCommand
    {
        public Result Execute(
            ExternalCommandData commandData,
            ref string message,
            ElementSet elements)
        {
            try
            {
                // 检查当前状态
                bool isConnected = Application.SocketService != null && Application.SocketService.IsConnected;

                if (isConnected)
                {
                    // 如果已连接，则停止
                    Application.StopMCPService();
                    TaskDialog.Show("MCP 服务", "🔴 服务已停止");
                }
                else
                {
                    // 如果未连接，则启动
                    Application.StartMCPService(commandData.Application);
                }

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                TaskDialog.Show("错误", "切换服务状态失败: " + ex.Message);
                return Result.Failed;
            }
        }
    }


    /// <summary>
    /// 打开设置窗口命令
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class SettingsCommand : IExternalCommand
    {
        public Result Execute(
            ExternalCommandData commandData,
            ref string message,
            ElementSet elements)
        {
            try
            {
                var settings = Configuration.ConfigManager.Instance.Settings;
                string info = $"当前设置:\n\n" +
                    $"主机: {settings.Host}\n" +
                    $"端口: {settings.Port}\n" +
                    $"服务状态: {(settings.IsEnabled ? "启用" : "禁用")}\n\n" +
                    $"配置文件位置:\n" +
                    $"{Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData)}\\RevitMCP\\config.json";
                
                TaskDialog.Show("MCP 设置", info);
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                TaskDialog.Show("错误", "打开设置失败: " + ex.Message);
                return Result.Failed;
            }
        }
    }
}
