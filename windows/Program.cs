using System;
using System.Diagnostics;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace Entekhab
{
    static class Program
    {
        /// The version the app says it is: read from the file itself, which the build stamps from
        /// windows/Entekhab.csproj. Written by hand it drifts, and an app that believes it is older than it is
        /// tells its owner forever that an update is waiting.
        public static readonly string Version = ReadVersion();

        static string ReadVersion()
        {
            try
            {
                var v = FileVersionInfo.GetVersionInfo(Assembly.GetExecutingAssembly().Location);
                var n = v.FileMajorPart + "." + v.FileMinorPart + "." + v.FileBuildPart;
                if (n != "0.0.0") return n;
            }
            catch { }
            return "0.0.0";
        }

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
