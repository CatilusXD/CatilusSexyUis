// SynapseRebornApex UI host — WebView2 config UI + built-in GDI ESP overlay.

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <windowsx.h>
#include <dwmapi.h>
#include <shellapi.h>
#include <shlobj.h>
#include <tlhelp32.h>
#include <wrl.h>

#include <atomic>
#include <mutex>
#include <string>
#include <thread>
#include <cstdio>
#include <cstring>
#include <cstdlib>

#include "apex/cheat.h"

#include "WebView2.h"
#include "WebView2EnvironmentOptions.h"
#include "../res/resource.h"

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Make;

namespace {

constexpr wchar_t kWindowClass[] = L"SynapseRebornApexWindow";
constexpr wchar_t kTitle[] = L"Synapse Reborn Apex";
constexpr wchar_t kHost[] = L"app.synapse";
constexpr wchar_t kOrigin[] = L"https://app.synapse/";
constexpr wchar_t kRuntimeDownload[] = L"https://go.microsoft.com/fwlink/p/?LinkId=2124703";

// Sizes in DIPs, matching the Electron window (1040x600, min 880x540).
constexpr int kWidth = 1040;
constexpr int kHeight = 600;
constexpr int kMinWidth = 880;
constexpr int kMinHeight = 540;
// Invisible strip around the UI that acts as the resize border.
constexpr int kResizeBorder = 6;

HWND g_hwnd = nullptr;
ComPtr<ICoreWebView2Controller> g_controller;
ComPtr<ICoreWebView2> g_webview;
bool g_active = true;
bool g_shown = false;

// ── Apex process poller ────────────────────────────────────────────────────
static std::atomic<bool> g_pollStop{ false };
static std::thread       g_pollThread;

static bool IsProcessRunning(const wchar_t* name) {
  HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snap == INVALID_HANDLE_VALUE) return false;
  PROCESSENTRY32W pe{ sizeof(pe) };
  bool found = false;
  if (Process32FirstW(snap, &pe))
    do { if (_wcsicmp(pe.szExeFile, name) == 0) { found = true; break; } }
    while (Process32NextW(snap, &pe));
  CloseHandle(snap);
  return found;
}

static void PostGameState(bool running) {
  if (!g_webview) return;
  const wchar_t* json = running
    ? L"{\"type\":\"game\",\"running\":true}"
    : L"{\"type\":\"game\",\"running\":false}";
  g_webview->PostWebMessageAsJson(json);
}

// ── GDI overlay ───────────────────────────────────────────────────────────
static std::atomic<bool> g_overlayStop{ false };
static std::thread       g_overlayThread;

// Draw ESP onto memDC (black = transparent via LWA_COLORKEY).
static void overlayFrameGDI(HDC memDC, int ovW, int ovH)
{
    RECT full = {0, 0, ovW, ovH};
    FillRect(memDC, &full, (HBRUSH)GetStockObject(BLACK_BRUSH));

    bool attached = false;
    GameState snap;
    {
        std::lock_guard<std::mutex> lk(g_cheat.stateMx);
        attached = g_cheat.state.attached;
        if (attached) {
            snap = g_cheat.state;
            snap.screenW = (float)ovW;
            snap.screenH = (float)ovH;
        }
    }
    if (!attached) return;

    const CheatConfig& cfg = g_cheat.cfg;
    if (!cfg.espEnabled) return;

    static const COLORREF COLS[] = {
        RGB(255,80,80), RGB(255,160,60), RGB(255,220,60), RGB(80,220,100),
        RGB(60,215,195), RGB(80,130,255), RGB(170,115,255), RGB(240,240,240),
    };
    auto col = [](int i) { return COLS[i & 7]; };

    SetBkMode(memDC, TRANSPARENT);
    HFONT hFont = CreateFontA(12,0,0,0,FW_BOLD,FALSE,FALSE,FALSE,
        DEFAULT_CHARSET,OUT_DEFAULT_PRECIS,CLIP_DEFAULT_PRECIS,
        CLEARTYPE_QUALITY,DEFAULT_PITCH|FF_DONTCARE,"Tahoma");
    HFONT oldFont = (HFONT)SelectObject(memDC, hFont);
    HBRUSH nullBr = (HBRUSH)GetStockObject(NULL_BRUSH);

    for (auto& e : snap.entities) {
        if (!e.valid || !e.onScreen) continue;
        if (e.distance > cfg.espMaxDist) continue;
        if (cfg.espVisCheck && !e.isVisible) continue;

        float bh = e.screenFeet.y - e.screenHead.y;
        if (bh < 5.f) continue;
        float bw = bh * 0.45f;
        float bx = e.screenFeet.x - bw * 0.5f;
        float by = e.screenHead.y;

        COLORREF c = e.isVisible ? col(cfg.espColorVis) : col(cfg.espColorInvis);

        HPEN shPen = CreatePen(PS_SOLID, 2, RGB(10,10,10));
        SelectObject(memDC, shPen); SelectObject(memDC, nullBr);
        Rectangle(memDC,(int)bx,(int)by,(int)(bx+bw),(int)(by+bh));
        DeleteObject(shPen);

        HPEN boxPen = CreatePen(PS_SOLID, 1, c);
        SelectObject(memDC, boxPen);
        Rectangle(memDC,(int)bx,(int)by,(int)(bx+bw),(int)(by+bh));
        DeleteObject(boxPen);

        if (cfg.espHealthBar && e.maxHealth > 0) {
            float frac = (float)e.health / e.maxHealth;
            int bary=(int)by, barh=(int)bh, barx=(int)bx-6;
            HBRUSH darkBr = CreateSolidBrush(RGB(20,20,20));
            RECT bg={barx,bary,barx+4,bary+barh}; FillRect(memDC,&bg,darkBr); DeleteObject(darkBr);
            int fillH=(int)(barh*frac);
            COLORREF hcol = frac>0.5f?RGB(80,220,100):frac>0.25f?RGB(220,180,40):RGB(220,60,60);
            HBRUSH hpBr=CreateSolidBrush(hcol);
            RECT fill={barx,bary+barh-fillH,barx+4,bary+barh}; FillRect(memDC,&fill,hpBr); DeleteObject(hpBr);
        }

        if (cfg.espDistance || cfg.espName) {
            char buf[48];
            if (cfg.espDistance && cfg.espName) snprintf(buf,sizeof buf,"%.0fm  %dhp",e.distance,e.health);
            else if (cfg.espDistance)           snprintf(buf,sizeof buf,"%.0fm",e.distance);
            else                                snprintf(buf,sizeof buf,"%dhp",e.health);
            int tx=(int)(bx+bw*0.5f)-20, ty=(int)by-14;
            SetTextColor(memDC,RGB(10,10,10)); TextOutA(memDC,tx+1,ty+1,buf,(int)strlen(buf));
            SetTextColor(memDC,c);             TextOutA(memDC,tx,ty,buf,(int)strlen(buf));
        }

        if (cfg.espSnapLines) {
            HPEN snapPen = CreatePen(PS_SOLID, 1, c);
            SelectObject(memDC, snapPen);
            MoveToEx(memDC, ovW/2, ovH, nullptr);
            LineTo(memDC,(int)(bx+bw*0.5f),(int)(by+bh));
            DeleteObject(snapPen);
        }
    }
    SelectObject(memDC, oldFont); DeleteObject(hFont);
}

static void OverlayThreadProc()
{
    // Create a fullscreen topmost layered window (black = transparent).
    WNDCLASSEXW oc{sizeof(oc)};
    oc.lpfnWndProc   = DefWindowProcW;
    oc.hInstance     = GetModuleHandleW(nullptr);
    oc.lpszClassName = L"SynapseOverlayWC";
    RegisterClassExW(&oc);

    POINT origin{0,0};
    HMONITOR mon = MonitorFromPoint(origin, MONITOR_DEFAULTTOPRIMARY);
    MONITORINFO mi{sizeof(mi)};
    GetMonitorInfoW(mon, &mi);
    int W = mi.rcMonitor.right - mi.rcMonitor.left;
    int H = mi.rcMonitor.bottom - mi.rcMonitor.top;
    printf("[OVERLAY] Monitor: %dx%d\n", W, H); fflush(stdout);

    // Keep state in sync so WorldToScreen uses correct dimensions
    {
        std::lock_guard<std::mutex> lk(g_cheat.stateMx);
        g_cheat.state.screenW = (float)W;
        g_cheat.state.screenH = (float)H;
    }

    HWND ov = CreateWindowExW(
        WS_EX_TOPMOST|WS_EX_LAYERED|WS_EX_TRANSPARENT|WS_EX_TOOLWINDOW|WS_EX_NOACTIVATE,
        L"SynapseOverlayWC", L"",
        WS_POPUP,
        mi.rcMonitor.left, mi.rcMonitor.top, W, H,
        nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
    if (!ov) return;

    SetLayeredWindowAttributes(ov, RGB(0,0,0), 0, LWA_COLORKEY);

    // TEMPORARILY disabled for debugging — so overlay is visible in screenshots
    // typedef BOOL(WINAPI* pfnSWDA)(HWND, DWORD);
    // if (auto SWDA = (pfnSWDA)GetProcAddress(GetModuleHandleW(L"user32.dll"), "SetWindowDisplayAffinity"))
    //     SWDA(ov, 0x11);

    HDC ovDC  = GetDC(ov);
    HDC memDC = CreateCompatibleDC(ovDC);
    HBITMAP bmp    = CreateCompatibleBitmap(ovDC, W, H);
    HBITMAP oldBmp = (HBITMAP)SelectObject(memDC, bmp);
    ReleaseDC(ov, ovDC);

    ShowWindow(ov, SW_SHOWNOACTIVATE);

    while (!g_overlayStop.load()) {
        overlayFrameGDI(memDC, W, H);
        HDC dc = GetDC(ov);
        BitBlt(dc, 0, 0, W, H, memDC, 0, 0, SRCCOPY);
        ReleaseDC(ov, dc);
        Sleep(16);
    }

    SelectObject(memDC, oldBmp);
    DeleteObject(bmp);
    DeleteDC(memDC);
    DestroyWindow(ov);
    UnregisterClassW(L"SynapseOverlayWC", GetModuleHandleW(nullptr));
}

static void StartCheat() {
    printf("[SYNAPSE] Apex detected — starting cheat + overlay\n"); fflush(stdout);
    if (g_cheat.running.load()) { printf("[SYNAPSE] Already running\n"); fflush(stdout); return; }
    g_cheat.cfg.espEnabled  = true;
    g_cheat.cfg.espSnapLines = true;
    g_cheat.start();
    g_overlayStop = false;
    g_overlayThread = std::thread(OverlayThreadProc);
}

static void StopCheat() {
    printf("[SYNAPSE] Apex lost — stopping cheat + overlay\n"); fflush(stdout);
    g_overlayStop = true;
    if (g_overlayThread.joinable()) g_overlayThread.join();
    g_cheat.stop();
}

static void StartApexPoller() {
  g_pollThread = std::thread([]() {
    bool last = false;
    while (!g_pollStop.load()) {
      bool cur = IsProcessRunning(L"r5apex.exe") || IsProcessRunning(L"r5apex_dx12.exe");
      if (cur != last) {
        last = cur;
        // Marshal the update onto the UI thread via PostMessage.
        PostMessageW(g_hwnd, WM_APP + 1, cur ? 1 : 0, 0);
      }
      Sleep(2000);
    }
  });
}

// Injected before any page script runs; defines window.synapse.
constexpr wchar_t kBridgeScript[] = LR"JS(
(() => {
  const wv = window.chrome && window.chrome.webview;
  if (!wv || window.synapse) return;
  let seq = 0;
  const pending = new Map();
  const stateListeners = new Set();
  wv.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'reply') { const r = pending.get(m.id); if (r) { pending.delete(m.id); r(m.value); } }
    else if (m.type === 'state') stateListeners.forEach((cb) => { try { cb({ maximized: !!m.maximized, focused: !!m.focused }); } catch (err) { console.error(err); } });
  });
  const send = (msg) => wv.postMessage(msg);
  const invoke = (cmd) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); send(cmd + ':' + id); });
  window.synapse = Object.freeze({
    isWebView2: true,
    platform: 'win32',
    minimize: () => send('minimize'),
    toggleMaximize: () => send('toggle-maximize'),
    close: () => send('close'),
    isMaximized: () => invoke('is-maximized'),
    setOpacity: (v) => { const n = Math.min(1, Math.max(0.3, Number(v) || 1)); document.documentElement.style.setProperty('--window-opacity', String(n)); },
    setAlwaysOnTop: (b) => send('topmost:' + (b ? 1 : 0)),
    openExternal: (url) => send('open:' + String(url)),
    send: (msg) => send(String(msg)),
    onWindowState: (cb) => { stateListeners.add(cb); return () => stateListeners.delete(cb); },
  });
})();
)JS";

int Scale(int dips) { return MulDiv(dips, GetDpiForWindow(g_hwnd), USER_DEFAULT_SCREEN_DPI); }

bool StartsWith(const std::wstring& s, const wchar_t* prefix) { return s.rfind(prefix, 0) == 0; }

void OpenExternal(const std::wstring& url) {
  if (StartsWith(url, L"https://") || StartsWith(url, L"http://"))
    ShellExecuteW(nullptr, L"open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

std::wstring ExeDir() {
  wchar_t path[MAX_PATH];
  DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH);
  std::wstring dir(path, n);
  return dir.substr(0, dir.find_last_of(L"\\/"));
}

bool FileExists(const std::wstring& path) {
  DWORD a = GetFileAttributesW(path.c_str());
  return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

// The UI folder: "ui" next to the exe. Debug builds prefer the source "web"
// folder (bin\<config>\..\..\web) so edits show up on reload without a rebuild.
std::wstring UiFolder() {
  const std::wstring exe = ExeDir();
#ifdef _DEBUG
  wchar_t full[MAX_PATH];
  if (GetFullPathNameW((exe + L"\\..\\..\\web").c_str(), MAX_PATH, full, nullptr) &&
      FileExists(std::wstring(full) + L"\\index.html"))
    return full;
#endif
  return exe + L"\\ui";
}

std::wstring UserDataFolder() {
  PWSTR local = nullptr;
  std::wstring dir;
  if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &local))) dir = std::wstring(local) + L"\\SynapseRebornApex";
  CoTaskMemFree(local);
  if (dir.empty()) dir = ExeDir() + L"\\SynapseRebornApex.data";
  CreateDirectoryW(dir.c_str(), nullptr);
  return dir + L"\\WebView2";
}

void Layout();

void ShowMainWindow() {
  if (g_shown) return;
  g_shown = true;
  ShowWindow(g_hwnd, SW_SHOW);
  SetForegroundWindow(g_hwnd);
  if (g_controller) {
    // The controller was created while the window was hidden.
    g_controller->put_IsVisible(TRUE);
    Layout();
    g_controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
  }
}

void Fail(const wchar_t* what, HRESULT hr) {
  ShowWindow(g_hwnd, SW_HIDE);
  if (hr == HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND)) {
    if (MessageBoxW(nullptr,
                    L"SynapseRebornApex Apex needs the Microsoft Edge WebView2 Runtime, which is not installed.\n\n"
                    L"Open the download page now?",
                    kTitle, MB_YESNO | MB_ICONWARNING) == IDYES)
      OpenExternal(kRuntimeDownload);
  } else {
    wchar_t msg[256];
    swprintf_s(msg, L"%s (0x%08lX).", what, static_cast<unsigned long>(hr));
    MessageBoxW(nullptr, msg, kTitle, MB_OK | MB_ICONERROR);
  }
  DestroyWindow(g_hwnd);
}

void Layout() {
  if (!g_controller) return;
  RECT rc;
  GetClientRect(g_hwnd, &rc);
  if (!IsZoomed(g_hwnd)) InflateRect(&rc, -Scale(kResizeBorder), -Scale(kResizeBorder));
  g_controller->put_Bounds(rc);
}

void PostState() {
  if (!g_webview) return;
  wchar_t json[96];
  swprintf_s(json, L"{\"type\":\"state\",\"maximized\":%s,\"focused\":%s}",
             IsZoomed(g_hwnd) ? L"true" : L"false", g_active ? L"true" : L"false");
  g_webview->PostWebMessageAsJson(json);
}

void Reply(const std::wstring& id, bool value) {
  // id comes from the page; only digits are echoed back.
  if (id.empty() || id.find_first_not_of(L"0123456789") != std::wstring::npos) return;
  std::wstring json = L"{\"type\":\"reply\",\"id\":" + id + L",\"value\":" + (value ? L"true" : L"false") + L"}";
  g_webview->PostWebMessageAsJson(json.c_str());
}

void OnBridgeMessage(const std::wstring& msg) {
  const size_t colon = msg.find(L':');
  const std::wstring cmd = msg.substr(0, colon);
  const std::wstring arg = colon == std::wstring::npos ? L"" : msg.substr(colon + 1);

  if (cmd == L"minimize") ShowWindow(g_hwnd, SW_MINIMIZE);
  else if (cmd == L"toggle-maximize") ShowWindow(g_hwnd, IsZoomed(g_hwnd) ? SW_RESTORE : SW_MAXIMIZE);
  else if (cmd == L"close") PostMessageW(g_hwnd, WM_CLOSE, 0, 0);
  else if (cmd == L"is-maximized") Reply(arg, IsZoomed(g_hwnd) != FALSE);
  else if (cmd == L"topmost") SetWindowPos(g_hwnd, arg == L"1" ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
  else if (cmd == L"open") OpenExternal(arg);
  else if (cmd == L"launch-game") ShellExecuteW(nullptr, L"open", L"origin://LaunchGame/Apex", nullptr, nullptr, SW_SHOWNORMAL);
  else if (cmd == L"kill-game") {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap != INVALID_HANDLE_VALUE) {
      PROCESSENTRY32W pe{ sizeof(pe) };
      if (Process32FirstW(snap, &pe)) do {
        if (_wcsicmp(pe.szExeFile, L"r5apex.exe") == 0) {
          HANDLE h = OpenProcess(PROCESS_TERMINATE, FALSE, pe.th32ProcessID);
          if (h) { TerminateProcess(h, 0); CloseHandle(h); }
        }
      } while (Process32NextW(snap, &pe));
      CloseHandle(snap);
    }
  }
}

void ConfigureWebView() {
  ComPtr<ICoreWebView2Settings> settings;
  g_webview->get_Settings(&settings);
  settings->put_IsStatusBarEnabled(FALSE);
  settings->put_IsZoomControlEnabled(FALSE);
  settings->put_AreDefaultContextMenusEnabled(TRUE);  // the page blocks it except on inputs
#ifdef _DEBUG
  constexpr BOOL kDebug = TRUE;
#else
  constexpr BOOL kDebug = FALSE;
#endif
  settings->put_AreDevToolsEnabled(kDebug);
  if (ComPtr<ICoreWebView2Settings3> s3; SUCCEEDED(settings.As(&s3))) s3->put_AreBrowserAcceleratorKeysEnabled(kDebug);
  if (ComPtr<ICoreWebView2Settings4> s4; SUCCEEDED(settings.As(&s4))) {
    s4->put_IsPasswordAutosaveEnabled(FALSE);
    s4->put_IsGeneralAutofillEnabled(FALSE);
  }
  // Lets CSS `app-region: drag` (the title bar) move the window, snap it and
  // maximize on double click, like a native caption.
  if (ComPtr<ICoreWebView2Settings9> s9; SUCCEEDED(settings.As(&s9))) s9->put_IsNonClientRegionSupportEnabled(TRUE);

  if (ComPtr<ICoreWebView2Controller2> c2; SUCCEEDED(g_controller.As(&c2)))
    c2->put_DefaultBackgroundColor(COREWEBVIEW2_COLOR{0, 0, 0, 0});

  if (ComPtr<ICoreWebView2_3> wv3; SUCCEEDED(g_webview.As(&wv3)))
    wv3->SetVirtualHostNameToFolderMapping(kHost, UiFolder().c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS);

  g_webview->AddScriptToExecuteOnDocumentCreated(kBridgeScript, nullptr);

  // Bridge messages, accepted only from the app's own pages.
  g_webview->add_WebMessageReceived(
      Callback<ICoreWebView2WebMessageReceivedEventHandler>(
          [](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
            LPWSTR source = nullptr, text = nullptr;
            args->get_Source(&source);
            const bool trusted = source && StartsWith(source, kOrigin);
            CoTaskMemFree(source);
            if (trusted && SUCCEEDED(args->TryGetWebMessageAsString(&text)) && text) OnBridgeMessage(text);
            CoTaskMemFree(text);
            return S_OK;
          }).Get(),
      nullptr);

  // Keep the app on its own pages; anything else opens in the default browser.
  g_webview->add_NavigationStarting(
      Callback<ICoreWebView2NavigationStartingEventHandler>(
          [](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT {
            LPWSTR uri = nullptr;
            args->get_Uri(&uri);
            const std::wstring u = uri ? uri : L"";
            CoTaskMemFree(uri);
            if (!StartsWith(u, kOrigin)) {
              args->put_Cancel(TRUE);
              OpenExternal(u);
            }
            return S_OK;
          }).Get(),
      nullptr);

  g_webview->add_NewWindowRequested(
      Callback<ICoreWebView2NewWindowRequestedEventHandler>(
          [](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT {
            LPWSTR uri = nullptr;
            args->get_Uri(&uri);
            if (uri) OpenExternal(uri);
            CoTaskMemFree(uri);
            args->put_Handled(TRUE);
            return S_OK;
          }).Get(),
      nullptr);

  // Show the window once the first page has rendered (like Electron's ready-to-show).
  g_webview->add_NavigationCompleted(
      Callback<ICoreWebView2NavigationCompletedEventHandler>(
          [](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs*) -> HRESULT {
            ShowMainWindow();
            PostState();
            return S_OK;
          }).Get(),
      nullptr);
}

void CreateWebView() {
  auto options = Make<CoreWebView2EnvironmentOptions>();
  // Electron allows audio to start without a click; match it for the music player.
  options->put_AdditionalBrowserArguments(L"--autoplay-policy=no-user-gesture-required");

  const HRESULT hr = CreateCoreWebView2EnvironmentWithOptions(
      nullptr, UserDataFolder().c_str(), options.Get(),
      Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
          [](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
            if (FAILED(result) || !env) { Fail(L"Could not start WebView2", result); return S_OK; }
            return env->CreateCoreWebView2Controller(
                g_hwnd,
                Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                      if (FAILED(result) || !controller) { Fail(L"Could not create the WebView2 view", result); return S_OK; }
                      g_controller = controller;
                      g_controller->get_CoreWebView2(&g_webview);
                      ConfigureWebView();
                      Layout();
                      if (!FileExists(UiFolder() + L"\\index.html")) {
                        MessageBoxW(nullptr, (L"The UI files were not found in:\n" + UiFolder()).c_str(), kTitle, MB_OK | MB_ICONERROR);
                        DestroyWindow(g_hwnd);
                        return S_OK;
                      }
                      g_webview->Navigate((std::wstring(kOrigin) + L"index.html").c_str());
                      return S_OK;
                    }).Get());
          }).Get());
  if (FAILED(hr)) Fail(L"Could not start WebView2", hr);
}

LRESULT HitTest(POINT pt) {
  if (IsZoomed(g_hwnd)) return HTCLIENT;
  RECT rc;
  GetWindowRect(g_hwnd, &rc);
  const int b = Scale(kResizeBorder);
  const bool left = pt.x < rc.left + b, right = pt.x >= rc.right - b;
  const bool top = pt.y < rc.top + b, bottom = pt.y >= rc.bottom - b;
  if (top && left) return HTTOPLEFT;
  if (top && right) return HTTOPRIGHT;
  if (bottom && left) return HTBOTTOMLEFT;
  if (bottom && right) return HTBOTTOMRIGHT;
  if (left) return HTLEFT;
  if (right) return HTRIGHT;
  if (top) return HTTOP;
  if (bottom) return HTBOTTOM;
  return HTCLIENT;
}

LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  switch (msg) {
    case WM_NCCALCSIZE:
      // No system frame. A maximized window is placed past the monitor edges by
      // the frame thickness, so pull the client area back in.
      if (wp && IsZoomed(hwnd)) {
        auto* p = reinterpret_cast<NCCALCSIZE_PARAMS*>(lp);
        const UINT dpi = GetDpiForWindow(hwnd);
        const int fx = GetSystemMetricsForDpi(SM_CXFRAME, dpi) + GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi);
        const int fy = GetSystemMetricsForDpi(SM_CYFRAME, dpi) + GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi);
        InflateRect(&p->rgrc[0], -fx, -fy);
      }
      return 0;
    case WM_NCHITTEST:
      return HitTest({GET_X_LPARAM(lp), GET_Y_LPARAM(lp)});
    case WM_NCACTIVATE:
      return TRUE;  // nothing to repaint in the (absent) frame
    case WM_ACTIVATE:
      g_active = LOWORD(wp) != WA_INACTIVE;
      if (g_active && g_controller) g_controller->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
      PostState();
      return 0;
    case WM_SIZE:
      Layout();
      if (g_controller) g_controller->put_IsVisible(wp != SIZE_MINIMIZED);
      if (wp == SIZE_MAXIMIZED || wp == SIZE_RESTORED) PostState();
      return 0;
    case WM_MOVE:
    case WM_MOVING:
      if (g_controller) g_controller->NotifyParentWindowPositionChanged();
      break;
    case WM_GETMINMAXINFO: {
      auto* mmi = reinterpret_cast<MINMAXINFO*>(lp);
      mmi->ptMinTrackSize = {Scale(kMinWidth + 2 * kResizeBorder), Scale(kMinHeight + 2 * kResizeBorder)};
      return 0;
    }
    case WM_DPICHANGED: {
      const auto* r = reinterpret_cast<const RECT*>(lp);
      SetWindowPos(hwnd, nullptr, r->left, r->top, r->right - r->left, r->bottom - r->top, SWP_NOZORDER | SWP_NOACTIVATE);
      return 0;
    }
    case WM_ERASEBKGND:
      return 1;
    case WM_PAINT:
      ValidateRect(hwnd, nullptr);
      return 0;
    case WM_CLOSE:
      DestroyWindow(hwnd);
      return 0;
    case WM_APP + 1:
      PostGameState(wp == 1);
      if (wp == 1) StartCheat(); else StopCheat();
      return 0;
    case WM_DESTROY:
      g_pollStop = true;
      if (g_pollThread.joinable()) g_pollThread.detach();
      StopCheat();
      if (g_controller) g_controller->Close();
      g_controller = nullptr;
      g_webview = nullptr;
      PostQuitMessage(0);
      return 0;
  }
  return DefWindowProcW(hwnd, msg, wp, lp);
}

void PlaceWindow() {
  HMONITOR mon = MonitorFromWindow(g_hwnd, MONITOR_DEFAULTTOPRIMARY);
  MONITORINFO mi{sizeof(mi)};
  GetMonitorInfoW(mon, &mi);
  const RECT& wa = mi.rcWork;
  const int w = Scale(kWidth + 2 * kResizeBorder), h = Scale(kHeight + 2 * kResizeBorder);
  const int x = wa.left + ((wa.right - wa.left) - w) / 2, y = wa.top + ((wa.bottom - wa.top) - h) / 2;
  SetWindowPos(g_hwnd, nullptr, x, y, w, h, SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
}

}  // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
  // Debug console — shows driver/attach/ESP status in real time
  AllocConsole();
  FILE* _cf = nullptr;
  freopen_s(&_cf, "CONOUT$", "w", stdout);
  freopen_s(&_cf, "CONOUT$", "w", stderr);
  SetConsoleTitleW(L"Synapse Reborn Apex — Debug Console");
  printf("[SYNAPSE] Starting up...\n"); fflush(stdout);

  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  if (FAILED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED))) return 1;

  WNDCLASSEXW wc{sizeof(wc)};
  wc.lpfnWndProc = WndProc;
  wc.hInstance = instance;
  wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  wc.hIcon = LoadIconW(instance, MAKEINTRESOURCEW(IDI_APPICON));
  wc.hIconSm = static_cast<HICON>(LoadImageW(instance, MAKEINTRESOURCEW(IDI_APPICON), IMAGE_ICON,
                                             GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), 0));
  wc.lpszClassName = kWindowClass;
  RegisterClassExW(&wc);

  // WS_CAPTION/WS_THICKFRAME keep snapping and the minimize/maximize animations;
  // WM_NCCALCSIZE removes the visible frame. WS_EX_NOREDIRECTIONBITMAP makes the
  // window transparent wherever the WebView draws nothing (the rounded corners).
  g_hwnd = CreateWindowExW(WS_EX_NOREDIRECTIONBITMAP, kWindowClass, kTitle,
                           WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX,
                           CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT, nullptr, nullptr, instance, nullptr);
  if (!g_hwnd) return 1;

  // No DWM shadow, border or corner rounding: the page draws the window edge.
  const DWMNCRENDERINGPOLICY policy = DWMNCRP_DISABLED;
  DwmSetWindowAttribute(g_hwnd, DWMWA_NCRENDERING_POLICY, &policy, sizeof(policy));
  const DWM_WINDOW_CORNER_PREFERENCE corners = DWMWCP_DONOTROUND;
  DwmSetWindowAttribute(g_hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &corners, sizeof(corners));
  const COLORREF noBorder = DWMWA_COLOR_NONE;
  DwmSetWindowAttribute(g_hwnd, DWMWA_BORDER_COLOR, &noBorder, sizeof(noBorder));

  PlaceWindow();
  StartApexPoller();
  CreateWebView();

  MSG msg;
  while (GetMessageW(&msg, nullptr, 0, 0)) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
  CoUninitialize();
  return static_cast<int>(msg.wParam);
}
