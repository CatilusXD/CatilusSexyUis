#pragma once
#include <cstdint>

// All values taken from:
//   NEW PROJECT ONLY WORK ON THIS/SEND_TO_THUNDER/ui/offsets.txt
// All offsets are `inline` so the runtime scanner can patch them if needed.

namespace Offsets {

    // ---------------------------------------------------------------------
    // [Mics] — module-level pointers (base + offset)
    // ---------------------------------------------------------------------
    namespace Misc {
        inline uintptr_t CHLClient            = 0x4068648;
        inline uintptr_t ClientState          = 0x3623d50;
        inline uintptr_t GlobalVars           = 0x3623aa0;
        inline uintptr_t InputSystem          = 0x36dacc0;
        inline uintptr_t LevelName            = 0x3623f2c;
        inline uintptr_t LocalPlayer          = 0x3e77998;
        inline uintptr_t ModelNames           = 0x364d088;
        inline uintptr_t NameList             = 0x9e2fba0;
        inline uintptr_t NetworkVarTablePtr   = 0xa0ae2c0;
        inline uintptr_t SignonState          = 0x3623e14;
        inline uintptr_t ViewMatrix           = 0x11a390;
        inline uintptr_t ViewRender           = 0x5ab2c30;
        inline uintptr_t WeaponNames          = 0x5ab2c70;
        inline uintptr_t WeaponSettingsMeta_base = 0x18f8;
        inline uintptr_t camera_origin        = 0x1f74;
        inline uintptr_t cinput               = 0x78e7988;
        inline uintptr_t commandNumber        = 0x364cb64;
        inline uintptr_t highlightSetting     = 0x7b22fc0;
        inline uintptr_t lastVisibleTime      = 0x1a64;
        inline uintptr_t localplayerHandle    = 0x3d05e60;
        inline uintptr_t m_scriptName         = 0x590;
        inline uintptr_t m_vecAbsOrigin       = 0x170;
        inline uintptr_t m_viewangle          = 0x25c0;
        inline uintptr_t m_weaponClassName    = 0x18b0;
        inline uintptr_t netChannel           = 0x3623db8;
        inline uintptr_t observerList         = 0x58D6AF8;
        inline uintptr_t observer_index       = 0x974;
        inline uintptr_t studioHdr            = 0xfd0;
    }

    // ---------------------------------------------------------------------
    // [DT_Player]
    // ---------------------------------------------------------------------
    namespace DT_Player {
        constexpr uintptr_t m_iHealth               = 0x330;
        constexpr uintptr_t m_iMaxHealth            = 0x470;
        constexpr uintptr_t m_fFlags                = 0xc8;
        constexpr uintptr_t m_flMaxspeed            = 0x334;
        constexpr uintptr_t m_inventory             = 0x1958;
        constexpr uintptr_t m_title                 = 0x4200;
        constexpr uintptr_t m_squadID               = 0x34c;
        constexpr uintptr_t m_teamMemberIndex       = 0x348;
        constexpr uintptr_t m_lifeState             = 0x698;
        constexpr uintptr_t m_bleedoutState         = 0x27a0;
        constexpr uintptr_t m_bleedoutStartTime     = 0x27a4;
        constexpr uintptr_t m_bZooming              = 0x1cb1;
        constexpr uintptr_t m_flDeathTime           = 0x370c;
        constexpr uintptr_t m_duckState             = 0x2aa0;
        constexpr uintptr_t m_fIsSprinting          = 0x2a54;
        constexpr uintptr_t m_extraShieldHealth     = 0x3030;
        constexpr uintptr_t m_extraShieldTier       = 0x3034;
        constexpr uintptr_t m_armorType             = 0x48d8;
        constexpr uintptr_t m_ammoPoolCapacity      = 0x25d4;
        constexpr uintptr_t m_activeZipline         = 0x2f54;
    }

    // ---------------------------------------------------------------------
    // [DT_BaseCombatCharacter]
    // ---------------------------------------------------------------------
    namespace DT_BaseCombatCharacter {
        constexpr uintptr_t m_shieldHealth          = 0x18c;
        constexpr uintptr_t m_shieldHealthMax       = 0x190;
        constexpr uintptr_t m_squadID               = 0x34c;
        constexpr uintptr_t m_teamMemberIndex       = 0x348;
        constexpr uintptr_t m_lastFiredTime         = 0x1930;
        constexpr uintptr_t m_lastFiredWeapon       = 0x1934;
        constexpr uintptr_t m_selectedWeapons       = 0x19c0;
        constexpr uintptr_t m_latestPrimaryWeapons  = 0x19c4;
        constexpr uintptr_t m_nameVisibilityFlags   = 0x868;
        constexpr uintptr_t m_cloakEndTime          = 0x1b8;
        constexpr uintptr_t m_cloakFadeInDuration   = 0x1c4;
        constexpr uintptr_t m_cloakFadeInEndTime    = 0x1bc;
        constexpr uintptr_t m_cloakFadeOutStartTime = 0x1c0;
        constexpr uintptr_t m_cloakFlickerAmount    = 0x1c8;
        constexpr uintptr_t m_cloakFlickerEndTime   = 0x1cc;
        constexpr uintptr_t m_phaseShiftTimeEnd     = 0x1aa8;
        constexpr uintptr_t m_phaseShiftTimeStart   = 0x1aa4;
        constexpr uintptr_t m_phaseShiftType        = 0x1aa0;
        constexpr uintptr_t m_minimapData           = 0x818;
        constexpr uintptr_t m_sharedEnergy          = 0x193c;
        constexpr uintptr_t m_sharedEnergyMax       = 0x1940;
        constexpr uintptr_t m_sharedEnergyRegenRate = 0x194c;
        constexpr uintptr_t m_sharedEnergyRegenDelay= 0x1950;
        constexpr uintptr_t m_sharedEnergyLockoutThreshold = 0x1944;
        constexpr uintptr_t m_vecViewOffset_x       = 0x4c;
        constexpr uintptr_t m_vecViewOffset_y       = 0x50;
        constexpr uintptr_t m_vecViewOffset_z       = 0x54;
        constexpr uintptr_t m_deathVelocity         = 0x368;
        constexpr uintptr_t m_bIsPlayerOverheating  = 0x1910;
        constexpr uintptr_t m_playerOverheatValue   = 0x1914;
    }

    // ---------------------------------------------------------------------
    // [DT_BaseEntity]
    // ---------------------------------------------------------------------
    namespace DT_BaseEntity {
        constexpr uintptr_t HighlightSettings       = 0x0;
        constexpr uintptr_t m_Collision             = 0x3c8;
        constexpr uintptr_t m_CollisionGroup        = 0x438;
        constexpr uintptr_t m_contents              = 0x43c;
        constexpr uintptr_t m_fEffects              = 0x58;
        constexpr uintptr_t m_hOwnerEntity          = 0x3a4;
        constexpr uintptr_t m_iName                 = 0x481;
        constexpr uintptr_t m_cellX                 = 0x0;
        constexpr uintptr_t m_cellY                 = 0x8;
        constexpr uintptr_t m_cellZ                 = 0x10;
    }

    // ---------------------------------------------------------------------
    // C_Player — client-side player state (from offsets.txt player sections)
    // ---------------------------------------------------------------------
    namespace C_Player {
        constexpr uintptr_t m_vecAbsVelocity        = 0x160;
        constexpr uintptr_t m_vecVelocity           = 0x384;
        constexpr uintptr_t m_fFlags                = 0xc8;
        constexpr uintptr_t m_sliding               = 0x2DE5;
        constexpr uintptr_t m_grappleActive         = 0x2DC0;
        constexpr uintptr_t m_animAimPitch          = 0x2B14;
        constexpr uintptr_t m_animAimYaw            = 0x2B18;
        constexpr uintptr_t m_bIsStickySprinting    = 0x2DFA;
        constexpr uintptr_t m_dodging               = 0x3755;
        constexpr uintptr_t m_flFriction            = 0x39C;
        constexpr uintptr_t m_vecPunchBase_Angle    = 0x24B8;
        constexpr uintptr_t m_vecPunchWeapon_Angle  = 0x24D0;
    }

    namespace DT_Local {
        constexpr uintptr_t m_flFallVelocity        = 0x44;
        constexpr uintptr_t m_bDrawViewmodel        = 0x5f;
        constexpr uintptr_t m_iHideHUD              = 0x14;
        constexpr uintptr_t m_viewangle             = 0x25c0;
    }

    // ---------------------------------------------------------------------
    // CWeaponX — networked weapon state
    // ---------------------------------------------------------------------
    namespace CWeaponX {
        constexpr uintptr_t m_ammoInClip            = 0x1600;
        constexpr uintptr_t m_ammoInStockpile       = 0x1604;
        constexpr uintptr_t m_weaponOwner           = 0x15D0;
        constexpr uintptr_t m_bInReload             = 0x161A;
        constexpr uintptr_t m_nextPrimaryAttackTime = 0x15DC;
        constexpr uintptr_t m_lastPrimaryAttackTime = 0x15D4;
        constexpr uintptr_t m_weapState             = 0x1614;
        constexpr uintptr_t m_heatValue             = 0x1634;
        constexpr uintptr_t m_chargeStartTime       = 0x1750;
        constexpr uintptr_t m_chargeEndTime         = 0x1754;
        constexpr uintptr_t m_ActiveState           = 0x15FC;
        constexpr uintptr_t m_weaponIsActivelyFiring = 0x3054;
    }

    namespace DT_WeaponPlayerData {
        constexpr uintptr_t m_curZoomFOV            = 0xC0;
        constexpr uintptr_t m_targetZoomFOV         = 0xC4;
        constexpr uintptr_t m_zoomFOVLerpTime       = 0xC8;
        constexpr uintptr_t m_kickScaleBasePitch    = 0x24;
        constexpr uintptr_t m_kickScaleBaseYaw      = 0x28;
        constexpr uintptr_t m_spreadStartFracADS    = 0x14;
        constexpr uintptr_t m_spreadStartFracHip    = 0x10;
    }

    // ---------------------------------------------------------------------
    // [DT_HighlightSettings] — glow/outline control
    // ---------------------------------------------------------------------
    namespace DT_HighlightSettings {
        constexpr uintptr_t m_highlightFadeDuration   = 0x2ac;
        constexpr uintptr_t m_highlightFadeParity     = 0x2b4;
        constexpr uintptr_t m_highlightFocused        = 0x2a8;
        constexpr uintptr_t m_highlightGenericContexts = 0x2a0;
        constexpr uintptr_t m_highlightTeamBits       = 0x1e4;
        constexpr uintptr_t m_highlightTeamIndex      = 0x1d4;
    }

    // ---------------------------------------------------------------------
    // [DT_GrappleData]
    // ---------------------------------------------------------------------
    namespace DT_GrappleData {
        constexpr uintptr_t m_grappleAttached       = 0x48;
        constexpr uintptr_t m_grapplePulling        = 0x49;
        constexpr uintptr_t m_grappleSwinging       = 0x4A;
        constexpr uintptr_t m_grappleActivateTime   = 0x54;
        constexpr uintptr_t m_grappleAttachTime     = 0x5C;
    }

    // ---------------------------------------------------------------------
    // [DT_BaseAnimating]
    // ---------------------------------------------------------------------
    namespace DT_BaseAnimating {
        constexpr uintptr_t m_nBody                 = 0xd5c;
        constexpr uintptr_t m_nSkin                 = 0xd50;
        constexpr uintptr_t m_camoIndex             = 0xd60;
        constexpr uintptr_t m_flModelScale          = 0xe10;
        constexpr uintptr_t m_nForceBone            = 0xda0;
        constexpr uintptr_t studioHdr               = 0xfd0;
        constexpr uintptr_t m_SequenceTransitioner  = 0xb20;
        constexpr uintptr_t m_animPlaybackRate      = 0x10;
    }

    // ---------------------------------------------------------------------
    // [Buttons] — write 5 to press, 4 to release
    // ---------------------------------------------------------------------
    namespace Buttons {
        constexpr uintptr_t btn_attack    = 0x5ab3518;  // +attack
        constexpr uintptr_t btn_backward  = 0x5ab2cd8;  // +backward
        constexpr uintptr_t btn_break     = 0x5ab3718;  // +break
        constexpr uintptr_t btn_dodge     = 0x5ab3660;  // +dodge
        constexpr uintptr_t btn_duck      = 0x5ab3708;  // +duck
        constexpr uintptr_t btn_forward   = 0x5ab2cb0;  // +forward
        constexpr uintptr_t btn_jump      = 0x5ab3610;  // +jump
        constexpr uintptr_t btn_left      = 0x5ab35e0;  // +left
        constexpr uintptr_t btn_lookdown  = 0x5ab3628;  // +lookdown
        constexpr uintptr_t btn_lookup    = 0x5ab3728;  // +lookup
        constexpr uintptr_t btn_melee     = 0x5ab2d10;  // +melee
        constexpr uintptr_t btn_moveleft  = 0x5ab2ca0;  // +moveleft
        constexpr uintptr_t btn_moveright = 0x5ab2cc8;  // +moveright
        constexpr uintptr_t btn_offhand0  = 0x5ab2d20;  // +offhand0 (tactical)
        constexpr uintptr_t btn_offhand1  = 0x5ab35d0;  // +offhand1
        constexpr uintptr_t btn_offhand2  = 0x5ab3670;  // +offhand2
        constexpr uintptr_t btn_offhand3  = 0x5ab36a0;  // +offhand3 (ult)
        constexpr uintptr_t btn_offhand4  = 0x5ab36b8;  // +offhand4
        constexpr uintptr_t btn_ping      = 0x5ab2d50;  // +ping
        constexpr uintptr_t btn_reload    = 0x5ab3558;  // +reload
        constexpr uintptr_t btn_right     = 0x5ab3600;  // +right
        constexpr uintptr_t btn_sprint    = 0x5ab2ce8;  // +speed
        constexpr uintptr_t btn_use       = 0x5ab3680;  // +use
        constexpr uintptr_t btn_useAndReload = 0x5ab36e8;  // +useAndReload
        constexpr uintptr_t btn_use_alt   = 0x5ab3528;  // +use_alt
        constexpr uintptr_t btn_zoom      = 0x5ab3690;  // +zoom
        constexpr uintptr_t btn_toggle_zoom = 0x5ab3578;
        constexpr uintptr_t btn_toggle_duck = 0x5ab3538;
    }

    // ---------------------------------------------------------------------
    // Entity list
    // ---------------------------------------------------------------------
    inline    uintptr_t kEntityList                 = 0x73b5ed8;
    constexpr int       kEntityStride               = 0x20;
    constexpr int       kMaxEntities                = 2048;

    // ---------------------------------------------------------------------
    // Bone IDs for aimbot
    // ---------------------------------------------------------------------
    enum BoneID : int {
        BONE_HEAD       = 0,
        BONE_NECK       = 7,
        BONE_CHEST      = 6,
        BONE_SPINE      = 5,
        BONE_STOMACH    = 4,
        BONE_HIP        = 3,
        BONE_L_SHOULDER = 8,
        BONE_R_SHOULDER = 35,
        BONE_L_ELBOW    = 9,
        BONE_R_ELBOW    = 36,
        BONE_L_HAND     = 10,
        BONE_R_HAND     = 37,
        BONE_L_KNEE     = 22,
        BONE_R_KNEE     = 25,
        BONE_L_FOOT     = 23,
        BONE_R_FOOT     = 26,
    };
}
