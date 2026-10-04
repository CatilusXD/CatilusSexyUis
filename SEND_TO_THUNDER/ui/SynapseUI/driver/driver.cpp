// vesper kernel driver
// Reads/writes Apex Legends memory from ring-0, bypassing EAC's
// ObRegisterCallbacks which strips VM access rights from user-mode handles.
//
// Load with KDMapper (or equivalent manual mapper) before launching vesper.exe.
// KDMapper may pass DriverObject == NULL, handled via IoCreateDriver below.

// ntifs.h must come first — it pulls in the full kernel API surface:
// PsLookupProcessByProcessId, PsGetProcessPeb, KeStackAttachProcess,
// KeUnstackDetachProcess, KAPC_STATE, MmCopyMemory.
#include <ntifs.h>
#include <ntddk.h>
#define VESPER_KERNEL_BUILD   // tells shared.h we are the kernel driver
#include "shared.h"

#pragma warning(disable: 4201)  // nameless struct/union
#pragma warning(disable: 4100)  // unreferenced formal parameter

// ---------------------------------------------------------------------------
// Undocumented exports we resolve at runtime to avoid linker dependencies
// ---------------------------------------------------------------------------
typedef NTSTATUS (NTAPI* PfnIoCreateDriver)(PUNICODE_STRING, PDRIVER_INITIALIZE);

// PsGetProcessPeb is exported by ntoskrnl but not declared in WDK headers
// under /kernel compilation — declare it ourselves.
extern "C" NTKERNELAPI PVOID PsGetProcessPeb(PEPROCESS Process);

// ---------------------------------------------------------------------------
// Minimal PEB layout for x64 Windows 10/11
// ---------------------------------------------------------------------------
struct KPebLdrData {
    ULONG      Length;         // +0x00
    BOOLEAN    Initialized;   // +0x04
    UCHAR      Pad[3];         // +0x05
    PVOID      SsHandle;       // +0x08
    LIST_ENTRY InLoadOrderModuleList; // +0x10
};

struct KPeb {
    UCHAR        InheritedAddressSpace;    // +0x00
    UCHAR        ReadImageFileExecOptions; // +0x01
    UCHAR        BeingDebugged;            // +0x02
    UCHAR        BitField;                 // +0x03
    ULONG        Padding0;                 // +0x04
    PVOID        Mutant;                   // +0x08
    PVOID        ImageBaseAddress;         // +0x10
    KPebLdrData* Ldr;                      // +0x18
};

struct KLdrEntry {
    LIST_ENTRY     InLoadOrderLinks;       // +0x00 (16 bytes)
    LIST_ENTRY     InMemoryOrderLinks;     // +0x10
    LIST_ENTRY     InInitializationOrderLinks; // +0x20
    PVOID          DllBase;                // +0x30
    PVOID          EntryPoint;             // +0x38
    ULONG          SizeOfImage;            // +0x40
    ULONG          Pad;                    // +0x44
    UNICODE_STRING FullDllName;            // +0x48 (16 bytes)
    UNICODE_STRING BaseDllName;            // +0x58
};

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
static PDEVICE_OBJECT g_device = nullptr;

// ---------------------------------------------------------------------------
// Kernel diagnostic: write a DWORD to HKLM\SOFTWARE\VesperDrv\<name>
// so usermode can check exactly where setup failed.
// ---------------------------------------------------------------------------
static void KRegDword(const WCHAR* valueName, ULONG value) {
    OBJECT_ATTRIBUTES oa;
    UNICODE_STRING keyName = RTL_CONSTANT_STRING(L"\\Registry\\Machine\\SOFTWARE\\VesperDrv");
    InitializeObjectAttributes(&oa, &keyName,
        OBJ_CASE_INSENSITIVE | OBJ_KERNEL_HANDLE, nullptr, nullptr);
    HANDLE key = nullptr;
    NTSTATUS st = ZwCreateKey(&key, KEY_SET_VALUE, &oa, 0, nullptr,
        REG_OPTION_NON_VOLATILE, nullptr);
    if (!NT_SUCCESS(st)) return;
    UNICODE_STRING vn;
    RtlInitUnicodeString(&vn, valueName);
    ZwSetValueKey(key, &vn, 0, REG_DWORD, &value, sizeof(ULONG));
    ZwClose(key);
}

// ---------------------------------------------------------------------------
// Case-insensitive wide string compare (no CRT in kernel)
// ---------------------------------------------------------------------------
static BOOLEAN WcsIEqualN(const WCHAR* a, USHORT aLen, const WCHAR* b) {
    USHORT bLen = 0;
    while (b[bLen]) bLen++;
    if (aLen != bLen * sizeof(WCHAR)) return FALSE;
    for (USHORT i = 0; i < bLen; i++) {
        WCHAR ca = a[i], cb = b[i];
        if (ca >= L'A' && ca <= L'Z') ca += 32;
        if (cb >= L'A' && cb <= L'Z') cb += 32;
        if (ca != cb) return FALSE;
    }
    return TRUE;
}

// ---------------------------------------------------------------------------
// Get PEB address via PsGetProcessPeb — direct ntoskrnl export (WDK 6+).
// No handle, no access-rights check, no Zw round-trip needed.
// ---------------------------------------------------------------------------
static PVOID GetPebAddress(PEPROCESS proc) {
    return PsGetProcessPeb(proc);
}

// ---------------------------------------------------------------------------
// Read 'size' bytes from virtual address 'addr' in process 'pid'
// Uses MmCopyMemory (Win 8.1+) which is safe against paged/invalid memory.
// ---------------------------------------------------------------------------
static NTSTATUS KReadMem(ULONG pid, ULONG64 addr, PVOID outBuf, ULONG64 size, SIZE_T* copied) {
    if (size == 0 || size > 0x4000) return STATUS_INVALID_PARAMETER;

    PEPROCESS proc = NULL;
    NTSTATUS st = PsLookupProcessByProcessId(ULongToHandle(pid), &proc);
    if (!NT_SUCCESS(st)) return st;

    KAPC_STATE apc;
    BOOLEAN attached = (PsGetCurrentProcess() != proc);
    if (attached) KeStackAttachProcess(proc, &apc);

    MM_COPY_ADDRESS src;
    src.VirtualAddress = (PVOID)(ULONG_PTR)addr;
    st = MmCopyMemory(outBuf, src, (SIZE_T)size, MM_COPY_MEMORY_VIRTUAL, copied);

    if (attached) KeUnstackDetachProcess(&apc);
    ObDereferenceObject(proc);
    return st;
}

// ---------------------------------------------------------------------------
// Write 'size' bytes to virtual address 'addr' in process 'pid'
// ---------------------------------------------------------------------------
static NTSTATUS KWriteMem(ULONG pid, ULONG64 addr, const VOID* data, ULONG64 size) {
    if (size == 0 || size > 0x4000) return STATUS_INVALID_PARAMETER;

    PEPROCESS proc = NULL;
    NTSTATUS st = PsLookupProcessByProcessId(ULongToHandle(pid), &proc);
    if (!NT_SUCCESS(st)) return st;

    KAPC_STATE apc;
    BOOLEAN attached = (PsGetCurrentProcess() != proc);
    if (attached) KeStackAttachProcess(proc, &apc);

    // Direct copy while attached to the target process address space.
    // Works for writable data pages (heap/stack/global vars) — exactly what
    // game cheats need. Code pages (read-only) would fault; the SEH catches it.
    __try {
        RtlCopyMemory((PVOID)(ULONG_PTR)addr, data, (SIZE_T)size);
        st = STATUS_SUCCESS;
    } __except(EXCEPTION_EXECUTE_HANDLER) {
        st = GetExceptionCode();
    }

    if (attached) KeUnstackDetachProcess(&apc);
    ObDereferenceObject(proc);
    return st;
}

// ---------------------------------------------------------------------------
// Walk the target process's PEB to find a module base address
// ---------------------------------------------------------------------------
static NTSTATUS KGetBase(ULONG pid, const WCHAR* modName, ULONG64* base) {
    *base = 0;

    PEPROCESS proc = NULL;
    NTSTATUS st = PsLookupProcessByProcessId(ULongToHandle(pid), &proc);
    if (!NT_SUCCESS(st)) return st;

    PVOID pebAddr = GetPebAddress(proc);
    if (!pebAddr) {
        ObDereferenceObject(proc);
        return STATUS_UNSUCCESSFUL;
    }
    st = STATUS_NOT_FOUND;

    KAPC_STATE apc;
    BOOLEAN attached = (PsGetCurrentProcess() != proc);
    if (attached) KeStackAttachProcess(proc, &apc);

    st = STATUS_NOT_FOUND;
    __try {
        KPeb* peb = (KPeb*)pebAddr;
        if (!peb->Ldr) { st = STATUS_UNSUCCESSFUL; __leave; }

        PLIST_ENTRY head = &peb->Ldr->InLoadOrderModuleList;
        for (PLIST_ENTRY e = head->Flink; e != head; e = e->Flink) {
            KLdrEntry* entry = CONTAINING_RECORD(e, KLdrEntry, InLoadOrderLinks);
            if (entry->BaseDllName.Buffer && entry->BaseDllName.Length &&
                WcsIEqualN(entry->BaseDllName.Buffer, entry->BaseDllName.Length, modName)) {
                *base = (ULONG64)(ULONG_PTR)entry->DllBase;
                st = STATUS_SUCCESS;
                break;
            }
        }
    } __except(EXCEPTION_EXECUTE_HANDLER) {
        st = GetExceptionCode();
    }

    if (attached) KeUnstackDetachProcess(&apc);
    ObDereferenceObject(proc);
    return st;
}

// ---------------------------------------------------------------------------
// IRP_MJ_DEVICE_CONTROL dispatcher
// ---------------------------------------------------------------------------
static NTSTATUS NTAPI DispatchIoctl(PDEVICE_OBJECT, PIRP irp) {
    PIO_STACK_LOCATION sl = IoGetCurrentIrpStackLocation(irp);
    ULONG code   = sl->Parameters.DeviceIoControl.IoControlCode;
    ULONG inLen  = sl->Parameters.DeviceIoControl.InputBufferLength;
    ULONG outLen = sl->Parameters.DeviceIoControl.OutputBufferLength;

    // METHOD_BUFFERED: SystemBuffer holds input; after completion the IO
    // manager copies 'Information' bytes from SystemBuffer to user output.
    PVOID   buf  = irp->AssociatedIrp.SystemBuffer;
    NTSTATUS st  = STATUS_INVALID_PARAMETER;
    ULONG_PTR info = 0;

    switch (code) {

    case IOCTL_VESPER_READ: {
        if (inLen < sizeof(VesperReadReq)) break;
        // Read fields BEFORE we overwrite the buffer with game data
        VesperReadReq req;
        RtlCopyMemory(&req, buf, sizeof(req));
        if (req.size == 0 || req.size > 0x4000) break;
        if (outLen < (ULONG)req.size) break;
        SIZE_T copied = 0;
        st = KReadMem(req.pid, req.address, buf, req.size, &copied);
        info = copied;
        break;
    }

    case IOCTL_VESPER_WRITE: {
        if (inLen < sizeof(VesperWriteHdr)) break;
        VesperWriteHdr hdr;
        RtlCopyMemory(&hdr, buf, sizeof(hdr));
        if (hdr.size == 0 || hdr.size > 0x4000) break;
        if ((ULONG64)inLen < sizeof(VesperWriteHdr) + hdr.size) break;
        st = KWriteMem(hdr.pid, hdr.address,
            (UCHAR*)buf + sizeof(VesperWriteHdr), hdr.size);
        break;
    }

    case IOCTL_VESPER_BASE: {
        if (inLen  < sizeof(VesperBaseReq))  break;
        if (outLen < sizeof(VesperBaseResp)) break;
        VesperBaseReq req;
        RtlCopyMemory(&req, buf, sizeof(req));
        req.modname[259] = L'\0'; // ensure null terminated
        ULONG64 base = 0;
        st = KGetBase(req.pid, req.modname, &base);
        if (NT_SUCCESS(st)) {
            ((VesperBaseResp*)buf)->base = base;
            info = sizeof(VesperBaseResp);
        }
        break;
    }

    }

    irp->IoStatus.Status = st;
    irp->IoStatus.Information = info;
    IoCompleteRequest(irp, IO_NO_INCREMENT);
    return st;
}

// ---------------------------------------------------------------------------
// Trivial complete-success handler for IRP_MJ_CREATE / IRP_MJ_CLOSE
// ---------------------------------------------------------------------------
static NTSTATUS NTAPI DispatchPass(PDEVICE_OBJECT, PIRP irp) {
    irp->IoStatus.Status = STATUS_SUCCESS;
    irp->IoStatus.Information = 0;
    IoCompleteRequest(irp, IO_NO_INCREMENT);
    return STATUS_SUCCESS;
}

// ---------------------------------------------------------------------------
// Driver unload: remove symlink and device
// ---------------------------------------------------------------------------
static VOID NTAPI OnUnload(PDRIVER_OBJECT) {
    UNICODE_STRING link = RTL_CONSTANT_STRING(L"\\GLOBAL??\\VesperDrv");
    IoDeleteSymbolicLink(&link);
    if (g_device) { IoDeleteDevice(g_device); g_device = nullptr; }
}

// ---------------------------------------------------------------------------
// Real initialisation — called either directly (normal load) or via
// IoCreateDriver (KDMapper / manual-mapper path)
// ---------------------------------------------------------------------------
static NTSTATUS NTAPI SetupDriver(PDRIVER_OBJECT drv, PUNICODE_STRING) {
    KRegDword(L"SetupCalled", 1);

    UNICODE_STRING devName  = RTL_CONSTANT_STRING(L"\\Device\\VesperDrv");
    UNICODE_STRING linkName = RTL_CONSTANT_STRING(L"\\GLOBAL??\\VesperDrv");

    IoDeleteSymbolicLink(&linkName);
    KRegDword(L"SymlinkDeleted", 1);

    NTSTATUS st = IoCreateDevice(drv, 0, &devName,
        FILE_DEVICE_UNKNOWN, FILE_DEVICE_SECURE_OPEN, FALSE, &g_device);
    KRegDword(L"IoCreateDevice", (ULONG)st);

    if (st == STATUS_OBJECT_NAME_COLLISION) {
        FILE_OBJECT* fo = nullptr;
        PDEVICE_OBJECT existingDev = nullptr;
        NTSTATUS getSt = IoGetDeviceObjectPointer(&devName, FILE_READ_ACCESS, &fo, &existingDev);
        KRegDword(L"GetDevicePtr", (ULONG)getSt);
        if (NT_SUCCESS(getSt)) {
            g_device = existingDev;
            ObDereferenceObject(fo);
            st = STATUS_SUCCESS;
        } else {
            return st;
        }
    } else if (!NT_SUCCESS(st)) {
        return st;
    }

    g_device->Flags &= ~DO_DEVICE_INITIALIZING;
    KRegDword(L"DeviceReady", 1);

    st = IoCreateSymbolicLink(&linkName, &devName);
    KRegDword(L"IoCreateSymlink", (ULONG)st);

    if (!NT_SUCCESS(st)) {
        IoDeleteDevice(g_device);
        g_device = nullptr;
        return st;
    }

    for (ULONG i = 0; i <= IRP_MJ_MAXIMUM_FUNCTION; i++)
        drv->MajorFunction[i] = DispatchPass;
    drv->MajorFunction[IRP_MJ_DEVICE_CONTROL] = DispatchIoctl;
    drv->DriverUnload = OnUnload;
    KRegDword(L"SetupDone", 99);
    return STATUS_SUCCESS;
}

// ---------------------------------------------------------------------------
// DriverEntry
// When called by KDMapper, DriverObject may be NULL.
// Resolve IoCreateDriver at runtime to create a proper driver object.
//
// Fast Startup (Windows hibernate-based shutdown) persists kernel objects
// across reboots, so \Driver\VesperDrv may already exist. We avoid this by
// trying \Driver\VesperDrv0 .. \Driver\VesperDrv15 until we find a free slot.
// The device and symlink (\Device\VesperDrv / \DosDevices\VesperDrv) use a
// fixed name — only the internal driver object name needs to be unique.
// ---------------------------------------------------------------------------
extern "C" NTSTATUS DriverEntry(PDRIVER_OBJECT drv, PUNICODE_STRING reg) {
    KRegDword(L"DriverEntry", 1);
    KRegDword(L"DrvObjIsNull", drv ? 0 : 1);

    if (drv) return SetupDriver(drv, reg);

    UNICODE_STRING crName = RTL_CONSTANT_STRING(L"IoCreateDriver");
    PfnIoCreateDriver IoCreateDriver =
        (PfnIoCreateDriver)MmGetSystemRoutineAddress(&crName);
    KRegDword(L"IoCreateDriverFn", IoCreateDriver ? 1 : 0);
    if (!IoCreateDriver) return STATUS_NOT_IMPLEMENTED;

    static const WCHAR kPrefix[] = L"\\Driver\\VesperDrv";
    WCHAR nameBuf[32];
    UNICODE_STRING drvName;
    NTSTATUS st = STATUS_OBJECT_NAME_COLLISION;

    for (int i = 0; i < 16 && st == STATUS_OBJECT_NAME_COLLISION; i++) {
        int off = 0;
        for (; kPrefix[off]; off++) nameBuf[off] = kPrefix[off];
        nameBuf[off++] = (WCHAR)(L'0' + (WCHAR)i);
        nameBuf[off]   = L'\0';
        RtlInitUnicodeString(&drvName, nameBuf);
        st = IoCreateDriver(&drvName, SetupDriver);
        KRegDword(L"LastIoCreateDrv", (ULONG)st);
        KRegDword(L"LastIndex", (ULONG)i);
    }
    KRegDword(L"FinalStatus", (ULONG)st);
    return st;
}
