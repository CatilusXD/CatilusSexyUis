#pragma once

// Shared between the kernel driver (driver.cpp) and user-mode vesper.exe.
// driver.cpp defines VESPER_KERNEL_BUILD before including this file.

#ifdef VESPER_KERNEL_BUILD
// ---- kernel side: ntifs.h + ntddk.h already included by driver.cpp ----
#else
// ---- user-mode side ----
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <winioctl.h>   // CTL_CODE, METHOD_BUFFERED, FILE_ANY_ACCESS
#endif

#define VESPER_DEVICE_TYPE  ((ULONG)0x8888u)
#define IOCTL_VESPER_READ   CTL_CODE(VESPER_DEVICE_TYPE, 0x800, METHOD_BUFFERED, FILE_ANY_ACCESS)
#define IOCTL_VESPER_WRITE  CTL_CODE(VESPER_DEVICE_TYPE, 0x801, METHOD_BUFFERED, FILE_ANY_ACCESS)
#define IOCTL_VESPER_BASE   CTL_CODE(VESPER_DEVICE_TYPE, 0x802, METHOD_BUFFERED, FILE_ANY_ACCESS)

#pragma pack(push, 1)

// IOCTL_VESPER_READ
//   Input : VesperReadReq
//   Output: raw bytes read from the target process (size == req.size)
struct VesperReadReq {
    ULONG  pid;
    ULONG64 address;
    ULONG64 size;       // bytes to read, capped at 0x4000 by the driver
};

// IOCTL_VESPER_WRITE
//   Input : VesperWriteHdr followed immediately by 'size' bytes of data
//   Output: none
struct VesperWriteHdr {
    ULONG  pid;
    ULONG64 address;
    ULONG64 size;
};

// IOCTL_VESPER_BASE
//   Input : VesperBaseReq
//   Output: VesperBaseResp
struct VesperBaseReq {
    ULONG pid;
    WCHAR modname[260];  // e.g. L"r5apex.exe"
};
struct VesperBaseResp {
    ULONG64 base;        // 0 if not found
};

#pragma pack(pop)
