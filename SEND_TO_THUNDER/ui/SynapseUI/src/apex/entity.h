#pragma once
#include "mem.h"
#include "math.h"
#include "offsets.h"
#include <string>
#include <vector>
#include <cstring>

// Forward declaration — defined below Entity
inline uintptr_t getEntityPtr(const Mem& mem, int i);

struct Entity {
    uintptr_t addr      = 0;
    bool      valid     = false;
    bool      local     = false;

    int       health    = 0;
    int       maxHealth = 100;
    int       shield    = 0;
    int       maxShield = 100;
    int       squadID   = -1;

    Vec3      origin;
    Vec3      headPos;
    Vec3      velocity;

    float     aimPitch  = 0.f;
    float     aimYaw    = 0.f;

    float     lastVisible = 0.f;
    bool      isVisible   = false;

    bool      cloaked     = false;
    bool      phaseShifted = false;

    uintptr_t weaponPtr   = 0;
    int       ammoClip    = 0;
    int       ammoStock   = 0;
    bool      inReload    = false;
    bool      isFiring    = false;

    float     distance    = 0.f;
    Vec2      screenFeet;
    Vec2      screenHead;
    bool      onScreen    = false;

    BoneMatrix boneMatrix;
    bool       hasBones   = false;

    void read(Mem& mem, uintptr_t entAddr, float gameTime = 0.f) {
        addr  = entAddr;
        valid = false;

        health    = mem.rpm<int>(addr + Offsets::DT_Player::m_iHealth);
        maxHealth = mem.rpm<int>(addr + Offsets::DT_Player::m_iMaxHealth);
        if (health <= 0 || health > 500 || maxHealth <= 0) return;

        shield    = mem.rpm<int>(addr + Offsets::DT_BaseCombatCharacter::m_shieldHealth);
        maxShield = mem.rpm<int>(addr + Offsets::DT_BaseCombatCharacter::m_shieldHealthMax);
        squadID   = mem.rpm<int>(addr + Offsets::DT_BaseCombatCharacter::m_squadID);

        origin   = mem.rpm<Vec3>(addr + Offsets::Misc::m_vecAbsOrigin);
        velocity = mem.rpm<Vec3>(addr + Offsets::C_Player::m_vecAbsVelocity);

        float voz = mem.rpm<float>(addr + Offsets::DT_BaseCombatCharacter::m_vecViewOffset_z);
        headPos   = { origin.x, origin.y, origin.z + voz };

        aimPitch = mem.rpm<float>(addr + Offsets::C_Player::m_animAimPitch);
        aimYaw   = mem.rpm<float>(addr + Offsets::C_Player::m_animAimYaw);

        lastVisible  = mem.rpm<float>(addr + Offsets::Misc::lastVisibleTime);
        isVisible    = (gameTime > 0.f && lastVisible > 0.f && (gameTime - lastVisible) < 0.1f);

        float cloakEnd  = mem.rpm<float>(addr + Offsets::DT_BaseCombatCharacter::m_cloakEndTime);
        float phaseEnd  = mem.rpm<float>(addr + Offsets::DT_BaseCombatCharacter::m_phaseShiftTimeEnd);
        cloaked       = (cloakEnd > gameTime && gameTime > 0.f);
        phaseShifted  = (phaseEnd > gameTime && gameTime > 0.f);

        uint32_t wHandle = mem.rpm<uint32_t>(addr + Offsets::DT_BaseCombatCharacter::m_selectedWeapons);
        int wIdx = (int)(wHandle & 0xFFFF);
        if (wIdx > 0 && wIdx < Offsets::kMaxEntities) {
            weaponPtr = getEntityPtr(mem, wIdx);
            if (weaponPtr) {
                ammoClip  = mem.rpm<int>(weaponPtr + Offsets::CWeaponX::m_ammoInClip);
                ammoStock = mem.rpm<int>(weaponPtr + Offsets::CWeaponX::m_ammoInStockpile);
                inReload  = mem.rpm<bool>(weaponPtr + Offsets::CWeaponX::m_bInReload);
                isFiring  = mem.rpm<bool>(weaponPtr + Offsets::CWeaponX::m_weaponIsActivelyFiring);
            }
        }

        valid = true;
    }

    bool readBones(Mem& mem) {
        uintptr_t hdr = mem.rpm<uintptr_t>(addr + Offsets::DT_BaseAnimating::studioHdr);
        if (!hdr) { hasBones = false; return false; }
        uintptr_t boneBase = hdr + 0x4980;
        hasBones = mem.readBuf(boneBase, &boneMatrix, sizeof(BoneMatrix));
        return hasBones;
    }
};

struct LocalPlayer : public Entity {
    Vec3 viewAngles;
    Vec3 camPos;

    void read(Mem& mem, float gameTime = 0.f) {
        uintptr_t ptr = mem.rpm<uintptr_t>(mem.base + Offsets::Misc::LocalPlayer);
        if (!ptr) { valid = false; return; }

        Entity::read(mem, ptr, gameTime);
        local = true;

        uintptr_t vaAddr = ptr + Offsets::Misc::m_viewangle;
        viewAngles.x = mem.rpm<float>(vaAddr);
        viewAngles.y = mem.rpm<float>(vaAddr + 4);
        viewAngles.z = mem.rpm<float>(vaAddr + 8);

        camPos = mem.rpm<Vec3>(ptr + Offsets::Misc::camera_origin);
    }
};

inline uintptr_t getEntityPtr(const Mem& mem, int i) {
    uintptr_t chunk = mem.rpm<uintptr_t>(
        mem.base + Offsets::kEntityList + (uintptr_t)(i >> 6) * 8);
    if (!chunk) return 0;
    uintptr_t p = mem.rpm<uintptr_t>(chunk + (uintptr_t)(i & 0x3F) * 8);
    if (!p || (p >> 48) != 0) return 0;
    return p;
}

inline std::vector<Entity> readEntities(Mem& mem, const LocalPlayer& lp,
                                        bool includeTeam, float gameTime) {
    std::vector<Entity> out;
    if (!lp.valid) return out;

    for (int i = 1; i < 70; i++) {
        uintptr_t ptr = getEntityPtr(mem, i);
        if (!ptr || ptr == lp.addr) continue;

        int hp = mem.rpm<int>(ptr + Offsets::DT_Player::m_iHealth);
        if (hp <= 0 || hp > 500) continue;

        Entity e;
        e.read(mem, ptr, gameTime);
        if (!e.valid) continue;
        if (!includeTeam && e.squadID == lp.squadID) continue;

        Vec3 diff = e.origin - lp.origin;
        e.distance = diff.len() * 0.0254f;
        out.push_back(e);
    }
    return out;
}

struct DeathBox {
    uintptr_t addr    = 0;
    Vec3      origin;
    bool      valid   = false;
    Vec2      screen;
    bool      onScreen = false;
    float     distance = 0.f;

    void read(Mem& mem, uintptr_t entAddr) {
        addr   = entAddr;
        int model = mem.rpm<int>(entAddr + 0x64);
        if (!model) return;
        origin = mem.rpm<Vec3>(entAddr + Offsets::Misc::m_vecAbsOrigin);
        valid  = true;
    }
};

inline std::vector<uintptr_t> readSpectators(Mem& mem, const LocalPlayer& lp) {
    std::vector<uintptr_t> specs;
    if (!lp.valid) return specs;
    uintptr_t obsBase = mem.base + Offsets::Misc::observerList;
    int count = mem.rpm<int>(obsBase);
    count = count < 0 ? 0 : (count > 16 ? 16 : count);
    for (int i = 0; i < count; i++) {
        uintptr_t obs = mem.rpm<uintptr_t>(obsBase + 0x8 + i * 8);
        if (obs && obs != lp.addr) specs.push_back(obs);
    }
    return specs;
}
