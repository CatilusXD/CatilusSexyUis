#include "cheat.h"
#include <chrono>
#include <random>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <atomic>

// ---------------------------------------------------------------------------
// Diagnostic log — rolling, re-runs every 2s so we can see state transitions.
// Written to C:\apexbuild\diag.txt
// ---------------------------------------------------------------------------
static void runDiagnostics(Mem& mem) {
    static auto lastRun = std::chrono::steady_clock::time_point{};
    auto now = std::chrono::steady_clock::now();
    if (now - lastRun < std::chrono::seconds(2)) return;
    lastRun = now;

    static bool first = true;
    FILE* f = fopen("C:\\apexbuild\\diag.txt", first ? "w" : "a");
    first = false;
    if (!f) return;
    auto say = [&](const char* fmt, ...) {
        va_list ap; va_start(ap, fmt); vfprintf(f, fmt, ap); va_end(ap);
        fprintf(f, "\n");
    };

    say("=== VESPER (tick) base=0x%llX  drv=%s ===",
        (unsigned long long)mem.base, mem.ok ? "YES" : "NO");

    uintptr_t lp = mem.rpm<uintptr_t>(mem.base + Offsets::Misc::LocalPlayer);
    say("LocalPlayer: 0x%llX  (offset 0x%llX)",
        (unsigned long long)lp, (unsigned long long)Offsets::Misc::LocalPlayer);

    if (lp && lp != 0xFFFFFFFFFFFFFFFFULL) {
        int hp  = mem.rpm<int>(lp + Offsets::DT_Player::m_iHealth);
        int mhp = mem.rpm<int>(lp + Offsets::DT_Player::m_iMaxHealth);
        int sh  = mem.rpm<int>(lp + Offsets::DT_BaseCombatCharacter::m_shieldHealth);
        int sq  = mem.rpm<int>(lp + Offsets::DT_BaseCombatCharacter::m_squadID);
        Vec3 org = mem.rpm<Vec3>(lp + Offsets::Misc::m_vecAbsOrigin);
        float pitch = mem.rpm<float>(lp + Offsets::Misc::m_viewangle);
        float yaw   = mem.rpm<float>(lp + Offsets::Misc::m_viewangle + 4);
        say("  hp=%d/%d shield=%d squad=%d", hp, mhp, sh, sq);
        say("  origin=%.1f,%.1f,%.1f  view=p%.1f y%.1f",
            org.x, org.y, org.z, pitch, yaw);
    }

    uintptr_t gv = mem.rpm<uintptr_t>(mem.base + Offsets::Misc::GlobalVars);
    float gt = (gv && gv != 0xFFFFFFFFFFFFFFFFULL) ? mem.rpm<float>(gv + 0x10) : 0.f;
    say("GlobalVars: 0x%llX  gametime=%.2f", (unsigned long long)gv, gt);

    Matrix44 vm;
    mem.readBuf(mem.base + Offsets::Misc::ViewMatrix, &vm, sizeof(vm));
    say("ViewMatrix m00=%.4f m11=%.4f m33=%.4f", vm.m[0][0], vm.m[1][1], vm.m[3][3]);
    say("");
    fclose(f);
}

// ---------------------------------------------------------------------------
// RNG helpers
// ---------------------------------------------------------------------------
static std::mt19937& rng() {
    static std::mt19937 g(std::random_device{}());
    return g;
}
static float randF(float lo, float hi) { return std::uniform_real_distribution<float>(lo, hi)(rng()); }
static int   randMs(float lo, float hi) { return (int)randF(lo, hi); }
static bool  chance(float pct) { return randF(0.f, 100.f) <= pct; }

static float readGameTime(Mem& mem) {
    uintptr_t gv = mem.rpm<uintptr_t>(mem.base + Offsets::Misc::GlobalVars);
    if (!gv || gv == 0xFFFFFFFFFFFFFFFFULL) return 0.f;
    return mem.rpm<float>(gv + 0x10);
}

// ---------------------------------------------------------------------------
// readState — pulls LocalPlayer, entities, view matrix, game time into state
// ---------------------------------------------------------------------------
void Cheat::readState() {
    if (!g_mem.valid()) {
        std::lock_guard<std::mutex> lk(stateMx);
        state.attached = false;
        return;
    }

    runDiagnostics(g_mem);
    float gameTime = readGameTime(g_mem);

    LocalPlayer lp;
    lp.read(g_mem, gameTime);

    Matrix44 vm;
    g_mem.readBuf(g_mem.base + Offsets::Misc::ViewMatrix, &vm, sizeof(vm));

    auto ents = readEntities(g_mem, lp, !cfg.espTeamFilter, gameTime);

    float sw, sh;
    {
        std::lock_guard<std::mutex> lk(stateMx);
        sw = state.screenW; sh = state.screenH;
    }
    for (auto& e : ents) {
        e.onScreen = worldToScreen(vm, e.origin,  e.screenFeet, sw, sh);
        bool onHd  = worldToScreen(vm, e.headPos, e.screenHead, sw, sh);
        e.onScreen = e.onScreen && onHd;
    }

    std::vector<DeathBox> boxes;
    for (int i = 0; i < 512; i++) {
        uintptr_t ptr = getEntityPtr(g_mem, i);
        if (!ptr) continue;
        int model = g_mem.rpm<int>(ptr + 0x64);
        if (model < 1 || model > 8191) continue;
        int health = g_mem.rpm<int>(ptr + Offsets::DT_Player::m_iHealth);
        if (health > 0) continue;
        uint8_t ut = g_mem.rpm<uint8_t>(ptr + 0x60);
        if (ut != 0x5) continue;
        DeathBox db;
        db.read(g_mem, ptr);
        if (!db.valid) continue;
        db.distance = (db.origin - lp.origin).len() * 0.0254f;
        db.onScreen = worldToScreen(vm, db.origin, db.screen, sw, sh);
        boxes.push_back(db);
        if (boxes.size() >= 64) break;
    }

    auto specs = readSpectators(g_mem, lp);

    {
        std::lock_guard<std::mutex> lk(stateMx);
        state.attached   = true;
        state.local      = lp;
        state.entities   = std::move(ents);
        state.deathBoxes = std::move(boxes);
        state.spectators = std::move(specs);
        state.viewMatrix = vm;
        state.gameTime   = gameTime;
    }
}

// ---------------------------------------------------------------------------
// applyAimbot
// ---------------------------------------------------------------------------
void Cheat::applyAimbot() {
    if (!cfg.aimEnabled || panicNow) return;
    bool keyHeld = cfg.aimKey ? (GetAsyncKeyState(cfg.aimKey) & 0x8000) != 0 : true;
    if (!keyHeld) return;

    std::lock_guard<std::mutex> lk(stateMx);
    if (!state.local.valid) return;

    Entity* best = nullptr;
    float bestFov = cfg.aimFOV;
    for (auto& e : state.entities) {
        if (!e.valid) continue;
        if (cfg.aimVisCheck  && !e.isVisible) continue;
        if (cfg.aimTeamCheck && e.squadID == state.local.squadID) continue;

        Vec3 target = e.headPos;
        if (e.hasBones) {
            switch (cfg.aimBone) {
            case 0: target = e.boneMatrix.getBonePos(Offsets::BONE_HEAD);    break;
            case 1: target = e.boneMatrix.getBonePos(Offsets::BONE_NECK);    break;
            case 2: target = e.boneMatrix.getBonePos(Offsets::BONE_CHEST);   break;
            case 3: target = e.boneMatrix.getBonePos(Offsets::BONE_STOMACH); break;
            }
        }
        float fov = fovToTarget(state.local.viewAngles, state.local.camPos, target);
        if (fov < bestFov) { bestFov = fov; best = &e; }
    }
    if (!best) return;

    Vec3 target = best->headPos;
    if (best->hasBones) {
        switch (cfg.aimBone) {
        case 0: target = best->boneMatrix.getBonePos(Offsets::BONE_HEAD);    break;
        case 1: target = best->boneMatrix.getBonePos(Offsets::BONE_NECK);    break;
        case 2: target = best->boneMatrix.getBonePos(Offsets::BONE_CHEST);   break;
        case 3: target = best->boneMatrix.getBonePos(Offsets::BONE_STOMACH); break;
        }
    }

    Vec3 needed = calcAngle(state.local.camPos, target);
    float dPitch = normAngle(needed.x - state.local.viewAngles.x);
    float dYaw   = normAngle(needed.y - state.local.viewAngles.y);
    float smooth = std::max(1.f, cfg.aimSmooth);
    float newPitch = state.local.viewAngles.x + dPitch / smooth;
    float newYaw   = state.local.viewAngles.y + dYaw   / smooth;

    uintptr_t vaAddr = state.local.addr + Offsets::Misc::m_viewangle;
    g_mem.wpm<float>(vaAddr,     newPitch);
    g_mem.wpm<float>(vaAddr + 4, newYaw);
}

// ---------------------------------------------------------------------------
// applyTriggerbot — non-blocking
// ---------------------------------------------------------------------------
void Cheat::applyTriggerbot() {
    if (!cfg.trigEnabled || panicNow) return;
    bool keyHeld = cfg.trigKey ? (GetAsyncKeyState(cfg.trigKey) & 0x8000) != 0 : true;
    if (!keyHeld) { trigOnTarget_ = false; return; }
    if (GetAsyncKeyState(VK_LBUTTON) & 0x8000) return;

    bool onTarget = false;
    {
        std::lock_guard<std::mutex> lk(stateMx);
        if (!state.local.valid) return;
        for (auto& e : state.entities) {
            if (!e.valid) continue;
            if (cfg.trigVisCheck  && !e.isVisible) continue;
            if (cfg.trigTeamCheck && e.squadID == state.local.squadID) continue;
            float fov = fovToTarget(state.local.viewAngles, state.local.camPos, e.headPos);
            if (fov <= cfg.trigFOV) { onTarget = true; break; }
        }
    }

    auto now = std::chrono::steady_clock::now();
    if (onTarget && !trigOnTarget_) {
        float lo = cfg.trigDelayMin, hi = cfg.trigDelayMax;
        if (hi < lo) hi = lo;
        trigFireDelay_   = std::chrono::milliseconds((int)randF(lo, hi));
        trigAcquireTime_ = now;
    }
    trigOnTarget_ = onTarget;
    if (!onTarget) return;
    if (now - trigAcquireTime_ < trigFireDelay_) return;

    if (!trigFiring_) {
        INPUT inp{}; inp.type = INPUT_MOUSE;
        inp.mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
        SendInput(1, &inp, sizeof(INPUT));
        trigFiring_ = true;
        trigClickTime_ = now;
        trigHoldDuration_ = std::chrono::milliseconds(randMs(20, 60));
    } else if (now - trigClickTime_ >= trigHoldDuration_) {
        INPUT inp{}; inp.type = INPUT_MOUSE;
        inp.mi.dwFlags = MOUSEEVENTF_LEFTUP;
        SendInput(1, &inp, sizeof(INPUT));
        trigFiring_ = false;
        trigAcquireTime_ = now;
    }
}

// ---------------------------------------------------------------------------
// applyRCS — delta-based recoil compensation
// ---------------------------------------------------------------------------
void Cheat::applyRCS() {
    if (!cfg.rcsEnabled || panicNow) return;
    bool shooting = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;
    if (!shooting) { rcsPrevPitch_ = 0.f; rcsPrevYaw_ = 0.f; return; }

    std::lock_guard<std::mutex> lk(stateMx);
    if (!state.local.valid) return;

    uintptr_t punchAddr = state.local.addr + Offsets::C_Player::m_vecPunchBase_Angle;
    float punchPitch = g_mem.rpm<float>(punchAddr);
    float punchYaw   = g_mem.rpm<float>(punchAddr + 4);
    float dP = punchPitch - rcsPrevPitch_;
    float dY = punchYaw   - rcsPrevYaw_;
    rcsPrevPitch_ = punchPitch; rcsPrevYaw_ = punchYaw;

    float corrP = -dP * (cfg.rcsVScale / 100.f) * 2.f;
    float corrY = -dY * (cfg.rcsHScale / 100.f) * 2.f;
    if (fabsf(corrP) < 0.001f && fabsf(corrY) < 0.001f) return;

    uintptr_t vaAddr = state.local.addr + Offsets::Misc::m_viewangle;
    float curP = g_mem.rpm<float>(vaAddr);
    float curY = g_mem.rpm<float>(vaAddr + 4);
    g_mem.wpm<float>(vaAddr,     clamp(curP + corrP, -89.f, 89.f));
    g_mem.wpm<float>(vaAddr + 4, normAngle(curY + corrY));
}

// ---------------------------------------------------------------------------
// applyBhop — press jump on ground, release in air
// ---------------------------------------------------------------------------
void Cheat::applyBhop() {
    if (!cfg.bhopEnabled || panicNow) return;
    bool spaceHeld = (GetAsyncKeyState(VK_SPACE) & 0x8000) != 0;
    bool keyHeld = cfg.bhopMode == 0
        ? spaceHeld : (GetAsyncKeyState(cfg.bhopKey) & 0x8000) != 0;
    if (!keyHeld) return;

    std::lock_guard<std::mutex> lk(stateMx);
    if (!state.local.valid) return;

    int flags = g_mem.rpm<int>(state.local.addr + Offsets::DT_Player::m_fFlags);
    bool onGround = (flags & 1) != 0;
    if (onGround) {
        if (!chance(cfg.bhopChance)) return;
        g_mem.wpm<int>(g_mem.base + Offsets::Buttons::btn_jump, 5);
    } else {
        g_mem.wpm<int>(g_mem.base + Offsets::Buttons::btn_jump, 4);
    }
}

// ---------------------------------------------------------------------------
// applyGlow — writes highlight settings for ESP glow
// ---------------------------------------------------------------------------
void Cheat::applyGlow() {
    if (!cfg.glowEnabled || panicNow) return;
    std::lock_guard<std::mutex> lk(stateMx);
    if (!state.local.valid) return;

    for (auto& e : state.entities) {
        if (!e.valid) continue;
        bool isEnemy = (e.squadID != state.local.squadID);
        if (!isEnemy && !cfg.glowTeam) continue;

        g_mem.wpm<uint8_t>(e.addr + Offsets::DT_HighlightSettings::m_highlightFocused, 1);
        uint32_t teamBit = isEnemy ? 0xFFFFFFFF : 0x00000001;
        g_mem.wpm<uint32_t>(e.addr + Offsets::DT_HighlightSettings::m_highlightTeamBits, teamBit);
        float fadeDur = cfg.glowIntensity * 0.5f;
        g_mem.wpm<float>(e.addr + Offsets::DT_HighlightSettings::m_highlightFadeDuration, fadeDur);
    }
}

// ---------------------------------------------------------------------------
// Main worker loop
// ---------------------------------------------------------------------------
void Cheat::loop() {
    while (running) {
        if (!g_mem.valid()) {
            g_mem.close();
            bool ok = g_mem.open(L"r5apex.exe");
            if (!ok) ok = g_mem.open(L"r5apex_dx12.exe");
            if (!ok) { std::this_thread::sleep_for(std::chrono::seconds(2)); continue; }
        }

        panicNow = (cfg.panicEnabled && cfg.panicKey &&
                   (GetAsyncKeyState(cfg.panicKey) & 0x8000));

        readState();
        if (!panicNow) {
            applyAimbot();
            applyTriggerbot();
            applyRCS();
            applyBhop();
            applyGlow();
        }
        if (cfg.sprintEnabled && !panicNow) {
            std::lock_guard<std::mutex> lk(stateMx);
            if (state.local.valid)
                g_mem.wpm<int>(g_mem.base + Offsets::Buttons::btn_sprint, 5);
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
}

void Cheat::start() {
    if (running) return;
    running = true;
    worker  = std::thread(&Cheat::loop, this);
}

void Cheat::stop() {
    running = false;
    if (worker.joinable()) worker.join();
    g_mem.close();
}
