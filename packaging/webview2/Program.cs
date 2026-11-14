using System;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace WordGarden
{
    internal static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.SetHighDpiMode(HighDpiMode.SystemAware);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly WebView2 _webView;

        public MainForm()
        {
            Text = "单词花园";
            Width = 1200;
            Height = 820;
            MinimumSize = new System.Drawing.Size(380, 620);
            StartPosition = FormStartPosition.CenterScreen;

            _webView = new WebView2
            {
                Dock = DockStyle.Fill
            };
            Controls.Add(_webView);

            Load += async (_, _) => await InitializeAsync();
        }

        private async System.Threading.Tasks.Task InitializeAsync()
        {
            // 存储目录：%APPDATA%\单词花园（不是缓存，卸载/清浏览器缓存都不丢）
            string dataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "单词花园");

            var env = await CoreWebView2Environment.CreateAsync(
                userDataFolder: dataDir);

            await _webView.EnsureCoreWebView2Async(env);

            // 阻止新窗口（应用内导航都应在当前窗口）
            _webView.CoreWebView2.NewWindowRequested += (_, e) => e.Handled = true;

            // 启用 JS 对话框：window.confirm / alert / prompt
            // （WebView2 默认禁用，会导致应用内「退出课程？进度不保存」等确认框不弹出、
            //    confirm() 恒返回 false，进而「退出」按钮点了没反应、叉叉关不掉）
            _webView.CoreWebView2.ScriptDialogOpening += (_, e) =>
            {
                string text = e.Message;
                DialogResult result;

                switch (e.Kind)
                {
                    case CoreWebView2ScriptDialogKind.Confirm:
                        result = MessageBox.Show(
                            this,
                            text,
                            "单词花园",
                            MessageBoxButtons.OKCancel,
                            MessageBoxIcon.Question,
                            MessageBoxDefaultButton.Button2);
                        e.ResultText = (result == DialogResult.OK) ? "true" : "false";
                        break;

                    case CoreWebView2ScriptDialogKind.Alert:
                        MessageBox.Show(this, text, "单词花园",
                            MessageBoxButtons.OK, MessageBoxIcon.Information);
                        e.ResultText = "";
                        break;

                    case CoreWebView2ScriptDialogKind.Prompt:
                        // 应用内未使用 prompt，直接返回默认值
                        e.ResultText = e.DefaultText ?? "";
                        break;
                }
            };

            // 禁止任意外部导航，只允许本地页面
            _webView.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (e.Uri.StartsWith("http://") || e.Uri.StartsWith("https://"))
                {
                    e.Cancel = true;
                }
            };

            // 加载本地单文件 HTML
            string htmlPath = Path.Combine(AppContext.BaseDirectory, "index.html");
            if (File.Exists(htmlPath))
            {
                _webView.CoreWebView2.Navigate(new Uri(htmlPath).AbsoluteUri);
            }
            else
            {
                MessageBox.Show("找不到 index.html，请确认程序文件完整。", "单词花园",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
