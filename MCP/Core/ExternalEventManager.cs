using System;
using Autodesk.Revit.UI;

namespace RevitMCP.Core
{
    /// <summary>
    /// 外部事件管理器
    /// 确保命令在 Revit UI 线程中执行
    /// </summary>
    public class ExternalEventManager
    {
        private static ExternalEventManager _instance;
        private static readonly object _lock = new object();
        
        private ExternalEvent _externalEvent;
        private CommandEventHandler _eventHandler;

        private ExternalEventManager()
        {
            _eventHandler = new CommandEventHandler();
            _externalEvent = ExternalEvent.Create(_eventHandler);
        }

        public static ExternalEventManager Instance
        {
            get
            {
                lock (_lock)
                {
                    if (_instance == null)
                    {
                        _instance = new ExternalEventManager();
                    }
                    return _instance;
                }
            }
        }

        /// <summary>
        /// 执行命令
        /// </summary>
        public void ExecuteCommand(Action<UIApplication> action)
        {
            _eventHandler.SetAction(action);
            _externalEvent.Raise();
        }

        /// <summary>
        /// 命令事件处理器
        /// </summary>
        private class CommandEventHandler : IExternalEventHandler
        {
            private Action<UIApplication> _action;

            public void SetAction(Action<UIApplication> action)
            {
                _action = action;
            }

            public void Execute(UIApplication app)
            {
                try
                {
                    _action?.Invoke(app);
                }
                catch (Exception ex)
                {
                    TaskDialog.Show("命令执行错误", ex.Message);
                }
            }

            public string GetName()
            {
                return "RevitMCP Command Handler";
            }
        }
    }
}
