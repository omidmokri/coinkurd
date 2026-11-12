using System;
using System.Runtime.InteropServices;

namespace Entekhab
{
    static class Native
    {
        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
        [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hWnd, int msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int RegisterWindowMessage(string name);

        static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);
        /// <summary>the message a second launch sends so the open window comes forward instead</summary>
        public static readonly int WM_SHOWME = RegisterWindowMessage("Entekhab.Desktop.ShowMe");

        public static void ActivateExisting() => PostMessage(HWND_BROADCAST, WM_SHOWME, IntPtr.Zero, IntPtr.Zero);

        /// <summary>a dark title bar (Windows 10 2004+ / 11) and, on Windows 11, a dark caption with the site's orange edge</summary>
        public static void DarkFrame(IntPtr hwnd)
        {
            try
            {
                int on = 1;
                if (DwmSetWindowAttribute(hwnd, 20, ref on, 4) != 0) DwmSetWindowAttribute(hwnd, 19, ref on, 4);
                int caption = 0x000A0A0A, text = 0x00EEF2F5, border = 0x001A93F7;   // COLORREF is 0x00BBGGRR
                DwmSetWindowAttribute(hwnd, 35, ref caption, 4);
                DwmSetWindowAttribute(hwnd, 36, ref text, 4);
                DwmSetWindowAttribute(hwnd, 34, ref border, 4);
            }
            catch { /* older Windows: the normal frame */ }
        }
    }
}
