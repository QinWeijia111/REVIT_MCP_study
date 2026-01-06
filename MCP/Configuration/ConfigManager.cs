using System;
using System.IO;
using System.Text;
using Newtonsoft.Json;

namespace RevitMCP.Configuration
{
    /// <summary>
    /// 配置管理器
    /// </summary>
    public class ConfigManager
    {
        private static ConfigManager _instance;
        private static readonly object _lock = new object();
        private readonly string _configPath;

        public ServiceSettings Settings { get; private set; }

        private ConfigManager()
        {
            // 配置文件存放在 AppData\Roaming\RevitMCP
            string appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string configDir = Path.Combine(appDataPath, "RevitMCP");
            
            if (!Directory.Exists(configDir))
            {
                Directory.CreateDirectory(configDir);
            }

            _configPath = Path.Combine(configDir, "config.json");
            LoadSettings();
        }

        public static ConfigManager Instance
        {
            get
            {
                lock (_lock)
                {
                    if (_instance == null)
                    {
                        _instance = new ConfigManager();
                    }
                    return _instance;
                }
            }
        }

        /// <summary>
        /// 加载设置
        /// </summary>
        private void LoadSettings()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    string json = File.ReadAllText(_configPath, Encoding.UTF8);
                    Settings = JsonConvert.DeserializeObject<ServiceSettings>(json) ?? new ServiceSettings();
                }
                else
                {
                    Settings = new ServiceSettings();
                    SaveSettings();
                }
            }
            catch (Exception)
            {
                Settings = new ServiceSettings();
            }
        }

        /// <summary>
        /// 保存设置
        /// </summary>
        public void SaveSettings()
        {
            try
            {
                string json = JsonConvert.SerializeObject(Settings, Formatting.Indented);
                File.WriteAllText(_configPath, json, Encoding.UTF8);
            }
            catch (Exception ex)
            {
                throw new Exception($"保存配置失败: {ex.Message}");
            }
        }
    }
}
