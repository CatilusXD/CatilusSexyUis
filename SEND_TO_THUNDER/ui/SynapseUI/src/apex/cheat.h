#pragma once
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <atomic>
#include <mutex>
#include <thread>
#include <vector>
#include <string>
#include "entity.h"
#include "math.h"

// -----------------------------------------------------------------------
// All GUI-driven settings — read by the cheat thread, written by app.cpp
// -----------------------------------------------------------------------
struct CheatConfig {
    // --- Aimbot ---
    bool  aimEnabled    = false;
    int   aimKey        = VK_LBUTTON;
    float aimFOV        = 10.f;
    float aimSmooth     = 6.f;
    int   aimBone       = 0;         // 0=Head 1=Neck 2=Chest 3=Stomach
    bool  aimVisCheck   = true;
    bool  aimTeamCheck  = true;
    bool  aimHoldMode   = false;     // false=toggle, true=hold

    // --- Triggerbot ---
    bool  trigEnabled   = false;
    int   trigKey       = 0;
    float trigDelayMin  = 20.f;
    float trigDelayMax  = 80.f;
    float trigFOV       = 3.f;
    bool  trigVisCheck  = true;
    bool  trigTeamCheck = true;

    // --- Recoil Control ---
    bool  rcsEnabled    = false;
    float rcsHScale     = 60.f;
    float rcsVScale     = 60.f;
    int   rcsMode       = 0;         // 0=Compensate 1=Smooth

    // --- Player ESP ---
    bool  espEnabled    = false;
    int   espStyle      = 1;         // 0=Box 1=Corner 2=Outline 3=3D
    bool  espHealthBar  = true;
    bool  espShieldBar  = true;
    bool  espSkeleton   = false;
    bool  espName       = true;
    bool  espDistance   = true;
    float espMaxDist    = 300.f;     // metres
    bool  espSnapLines  = false;
    bool  espVisCheck   = false;
    bool  espTeamFilter = true;
    int   espColorVis   = 5;
    int   espColorInvis = 0;
    float espLineW      = 1.5f;
    bool  espAmmo       = false;

    // --- Item ESP ---
    bool  itemEnabled   = false;
    bool  itemWeapons   = true;
    bool  itemArmor     = true;
    bool  itemMeds      = true;
    bool  itemAmmo      = false;
    bool  itemGold      = true;
    uint32_t itemTierMask = 0b11110;
    float itemMaxDist   = 150.f;

    // --- Death Box ESP ---
    bool  dbEnabled     = false;
    bool  dbShowKiller  = true;
    int   dbColor       = 4;

    // --- Glow / Highlight ---
    bool  glowEnabled   = false;
    bool  glowTeam      = false;
    float glowIntensity = 1.f;
    int   glowMode      = 0;         // 0=Static 1=Team 2=Visible
    int   glowColor     = 5;

    // --- Radar ---
    bool  radarEnabled  = false;
    float radarSize     = 200.f;
    float radarZoom     = 1.5f;
    int   radarCorner   = 1;         // 0=TL 1=TR 2=BL 3=BR
    bool  radarEnemies  = true;
    bool  radarTeam     = false;
    bool  radarItems    = false;
    float radarOpacity  = 0.85f;

    // --- Crosshair ---
    bool  xhairEnabled  = false;
    int   xhairStyle    = 0;         // 0=Dot 1=Cross 2=Circle 3=Static
    float xhairSize     = 4.f;
    int   xhairColor    = 5;
    float xhairGap      = 3.f;
    float xhairThickness = 1.5f;

    // --- Bunny Hop ---
    bool  bhopEnabled   = false;
    int   bhopMode      = 0;         // 0=Always 1=On Key
    int   bhopKey       = VK_SPACE;
    float bhopChance    = 90.f;

    // --- Auto Sprint ---
    bool  sprintEnabled = false;
    bool  sprintOmni    = false;     // omnidirectional sprint

    // --- Super Glide ---
    bool  glideEnabled  = false;
    float glideWindow   = 60.f;      // ms timing window
    float glideChance   = 100.f;

    // --- No Recoil ---
    bool  noRecoilEnabled = false;
    float noRecoilH     = 100.f;
    float noRecoilV     = 100.f;

    // --- No Sway ---
    bool  noSwayEnabled = false;
    float noSwayScale   = 100.f;

    // --- Spectator List ---
    bool  specEnabled   = false;
    int   specCorner    = 1;         // 0=TL 1=TR
    int   specMax       = 8;
    float specOpacity   = 0.85f;

    // --- Stream Proof ---
    bool  streamMenu    = true;
    bool  streamOverlay = false;

    // --- FPS Cap ---
    bool  fpsCapEnabled = false;
    float fpsCap        = 240.f;

    // --- Panic ---
    bool  panicEnabled  = false;
    int   panicKey      = VK_DELETE;

    // --- Global ---
    int   menuKey       = VK_INSERT;
    float overlayOpacity = 1.f;
    bool  toastsOn      = true;
    bool  hideCapture   = true;
};

// -----------------------------------------------------------------------
// Live read-back game state — cheat thread writes, render thread reads
// -----------------------------------------------------------------------
struct GameState {
    bool               attached = false;
    LocalPlayer        local;
    std::vector<Entity>    entities;
    std::vector<DeathBox>  deathBoxes;
    std::vector<uintptr_t> spectators;
    Matrix44           viewMatrix;
    float              screenW = 1920.f;
    float              screenH = 1080.f;
    float              gameTime = 0.f;
};

// -----------------------------------------------------------------------
// Global cheat singleton
// -----------------------------------------------------------------------
class Cheat {
public:
    CheatConfig cfg;

    // State readable by the render thread (always lock stateMx)
    GameState   state;
    std::mutex  stateMx;

    std::atomic<bool> running{false};
    std::atomic<bool> panicNow{false};  // disable everything instantly

    void start();
    void stop();

private:
    std::thread worker;

    // RCS delta tracking
    float rcsPrevPitch_ = 0.f;
    float rcsPrevYaw_   = 0.f;

    // Triggerbot non-blocking state
    bool trigOnTarget_ = false;
    bool trigFiring_   = false;
    std::chrono::steady_clock::time_point trigAcquireTime_;
    std::chrono::steady_clock::time_point trigClickTime_;
    std::chrono::milliseconds trigFireDelay_{0};
    std::chrono::milliseconds trigHoldDuration_{0};

    void loop();
    void readState();
    void applyAimbot();
    void applyTriggerbot();
    void applyRCS();
    void applyBhop();
    void applyGlow();
};

inline Cheat g_cheat;
