#pragma once
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <tlhelp32.h>
#include <cstdint>
#include <cstring>
#include <initializer_list>
#include <string>

#include "../../driver/shared.h"

// ---------------------------------------------------------------------------
// Mem — all memory access goes through the vesper kernel driver (\\.\VesperDrv).
//
// EAC's ObRegisterCallbacks strips PROCESS_VM_READ/WRITE from user-mode
// handles. The kernel driver bypasses this entirely by using MmCopyMemory
// and KeStackAttachProcess at ring-0, where ObRegisterCallbacks has no
// authority over direct memory access.
//
// Usage:
//   g_mem.open(L"r5apex.exe");   // finds PID and module base via driver
//   uintptr_t v = g_mem.rpm<uintptr_t>(addr);
// ---------------------------------------------------------------------------
class Mem {
public:
    uintptr_t base = 0;
    bool      ok   = false;

    // Try to attach to the named process. Returns false if the driver isn't
    // loaded or the process isn't running. Thread-safe to call repeatedly.
    bool open(const wchar_t* procName) {
        close();

        // Open the kernel driver device
        drv_ = CreateFileW(L"\\\\.\\VesperDrv",
            GENERIC_READ | GENERIC_WRITE, 0, nullptr,
            OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (drv_ == INVALID_HANDLE_VALUE) return false;

        // PID via Toolhelp32 — doesn't need VM_READ rights on the target
        pid_ = findPid(procName);
        if (!pid_) { close(); return false; }

        // Module base via driver (Toolhelp32 TH32CS_SNAPMODULE needs VM_READ
        // which EAC strips, so we ask the driver to walk the PEB instead)
        VesperBaseReq req{};
        req.pid = pid_;
        wcsncpy_s(req.modname, procName, 259);

        VesperBaseResp resp{};
        DWORD ret = 0;
        if (!DeviceIoControl(drv_, IOCTL_VESPER_BASE,
                &req, sizeof(req), &resp, sizeof(resp), &ret, nullptr)
            || !resp.base) {
            close();
            return false;
        }

        base = static_cast<uintptr_t>(resp.base);
        ok   = true;
        return true;
    }

    void close() {
        if (drv_ != INVALID_HANDLE_VALUE) {
            CloseHandle(drv_);
            drv_ = INVALID_HANDLE_VALUE;
        }
        pid_  = 0;
        base  = 0;
        ok    = false;
    }

    // Check that the process is still alive.
    // PROCESS_QUERY_LIMITED_INFORMATION is NOT stripped by EAC.
    bool valid() const {
        if (!ok || drv_ == INVALID_HANDLE_VALUE) return false;
        HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid_);
        if (!h) return false;
        DWORD ec = 0;
        bool alive = GetExitCodeProcess(h, &ec) && ec == STILL_ACTIVE;
        CloseHandle(h);
        return alive;
    }

    // ------------------------------------------------------------------
    // rpm<T> — read a value from the target process
    // ------------------------------------------------------------------
    template<typename T>
    T rpm(uintptr_t addr) const {
        T val{};
        VesperReadReq req;
        req.pid     = pid_;
        req.address = static_cast<ULONG64>(addr);
        req.size    = sizeof(T);
        DWORD ret = 0;
        DeviceIoControl(drv_, IOCTL_VESPER_READ,
            &req, sizeof(req), &val, sizeof(T), &ret, nullptr);
        return val;
    }

    // ------------------------------------------------------------------
    // wpm<T> — write a value to the target process
    // ------------------------------------------------------------------
    template<typename T>
    bool wpm(uintptr_t addr, const T& val) const {
        // Pack header + data into a single contiguous buffer on the stack
        struct alignas(1) Pkt {
            VesperWriteHdr hdr;
            unsigned char  data[sizeof(T)];
        } pkt;
        pkt.hdr.pid     = pid_;
        pkt.hdr.address = static_cast<ULONG64>(addr);
        pkt.hdr.size    = sizeof(T);
        memcpy(pkt.data, &val, sizeof(T));
        DWORD ret = 0;
        return DeviceIoControl(drv_, IOCTL_VESPER_WRITE,
            &pkt, sizeof(pkt), nullptr, 0, &ret, nullptr) != FALSE;
    }

    // ------------------------------------------------------------------
    // readBuf — read an arbitrary number of bytes (≤ 16 KB per call)
    // ------------------------------------------------------------------
    bool readBuf(uintptr_t addr, void* dst, size_t sz) const {
        VesperReadReq req;
        req.pid     = pid_;
        req.address = static_cast<ULONG64>(addr);
        req.size    = static_cast<ULONG64>(sz);
        DWORD ret = 0;
        return DeviceIoControl(drv_, IOCTL_VESPER_READ,
            &req, sizeof(req), dst, static_cast<DWORD>(sz), &ret, nullptr)
            != FALSE && ret == static_cast<DWORD>(sz);
    }

    // ------------------------------------------------------------------
    // readStr — read a null-terminated string from the target process
    // ------------------------------------------------------------------
    std::string readStr(uintptr_t addr, size_t maxLen = 64) const {
        std::string buf(maxLen, '\0');
        VesperReadReq req;
        req.pid     = pid_;
        req.address = static_cast<ULONG64>(addr);
        req.size    = static_cast<ULONG64>(maxLen);
        DWORD ret = 0;
        if (!DeviceIoControl(drv_, IOCTL_VESPER_READ,
                &req, sizeof(req), buf.data(),
                static_cast<DWORD>(maxLen), &ret, nullptr))
            return {};
        buf.resize(strnlen(buf.c_str(), maxLen));
        return buf;
    }

    // ------------------------------------------------------------------
    // read<T> — follow a pointer chain
    //   read<float>(base, {0x10, 0x50, 0x4})
    //   reads: *(*(*(base + 0x10) + 0x50) + 0x4)
    // ------------------------------------------------------------------
    template<typename T>
    T read(uintptr_t startAddr, std::initializer_list<uintptr_t> offsets) const {
        uintptr_t cur = startAddr;
        const uintptr_t* arr = offsets.begin();
        size_t cnt = offsets.size();
        for (size_t i = 0; i < cnt; i++)
            cur = (i + 1 < cnt) ? rpm<uintptr_t>(cur + arr[i])
                                 : cur + arr[i];
        return rpm<T>(cur);
    }

    DWORD pid() const { return pid_; }

private:
    HANDLE drv_ = INVALID_HANDLE_VALUE;
    DWORD  pid_ = 0;

    static DWORD findPid(const wchar_t* name) {
        PROCESSENTRY32W pe = { sizeof(pe) };
        HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snap == INVALID_HANDLE_VALUE) return 0;
        DWORD pid = 0;
        if (Process32FirstW(snap, &pe))
            do {
                if (_wcsicmp(pe.szExeFile, name) == 0) {
                    pid = pe.th32ProcessID;
                    break;
                }
            } while (Process32NextW(snap, &pe));
        CloseHandle(snap);
        return pid;
    }
};

inline Mem g_mem;
