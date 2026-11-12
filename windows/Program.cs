using System;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace Entekhab
{
    static class Program
    {
        public const string Version = "1.0.1";

        [STAThread]
        static int Main(string[] args)
        {
            string selftest = null, start = null;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--selftest" && i + 1 < args.Length) selftest = args[++i];
                else if (MainForm.IsSite(args[i])) start = args[i];
            }

            // one window: a second launch brings the first one forward (the self-test always runs on its own)
            bool first;
            using (var one = new Mutex(true, selftest == null ? "Entekhab.Desktop.Single" : "Entekhab.Desktop.Test." + Guid.NewGuid(), out first))
            {
                if (!first) { Native.ActivateExisting(); return 0; }
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12 | (SecurityProtocolType)12288;   // TLS 1.2 + 1.3
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                var form = new MainForm(selftest, start);
                Application.Run(form);
                return form.ExitCode;
            }
        }
    }
}
