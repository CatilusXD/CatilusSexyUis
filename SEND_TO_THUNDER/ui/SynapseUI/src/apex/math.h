#pragma once
#include <cmath>
#include <algorithm>

#ifndef M_PI
#define M_PI 3.14159265358979323846f
#endif

// -----------------------------------------------------------------------
// Vec2 / Vec3
// -----------------------------------------------------------------------
struct Vec2 {
    float x = 0.f, y = 0.f;

    float len()  const { return sqrtf(x*x + y*y); }
    Vec2 operator+(const Vec2& o) const { return {x+o.x, y+o.y}; }
    Vec2 operator-(const Vec2& o) const { return {x-o.x, y-o.y}; }
    Vec2 operator*(float s) const { return {x*s, y*s}; }
};

struct Vec3 {
    float x = 0.f, y = 0.f, z = 0.f;

    Vec3 operator+(const Vec3& o) const { return {x+o.x, y+o.y, z+o.z}; }
    Vec3 operator-(const Vec3& o) const { return {x-o.x, y-o.y, z-o.z}; }
    Vec3 operator*(float s)       const { return {x*s, y*s, z*s}; }
    float len()   const { return sqrtf(x*x + y*y + z*z); }
    float len2d() const { return sqrtf(x*x + y*y); }
    float dot(const Vec3& o) const { return x*o.x + y*o.y + z*o.z; }
    Vec3  norm()  const { float l = len(); return l > 0.f ? Vec3{x/l,y/l,z/l} : Vec3{}; }
};

// -----------------------------------------------------------------------
// 4x4 view matrix (row-major, Apex format)
// -----------------------------------------------------------------------
struct Matrix44 {
    float m[4][4] = {};
};

// Apex bone matrix: each bone stored as 3x4 row-major float array (12 floats)
struct BoneMatrix {
    struct Bone { float m[3][4]; };
    static constexpr int MAX_BONES = 256;
    Bone bones[MAX_BONES];

    Vec3 getBonePos(int idx) const {
        auto& b = bones[idx];
        return { b.m[0][3], b.m[1][3], b.m[2][3] };
    }
};

// -----------------------------------------------------------------------
// World-to-screen
// Returns true if the point is in front of the camera.
// -----------------------------------------------------------------------
inline bool worldToScreen(const Matrix44& vm, const Vec3& world,
                           Vec2& screen, float sw, float sh) {
    // Apex's ViewMatrix is row-major [row][col]:
    //   clip_x = m[0]*world + m[1]*world + m[2]*world + m[3]
    float w  = vm.m[3][0]*world.x + vm.m[3][1]*world.y + vm.m[3][2]*world.z + vm.m[3][3];
    if (w < 0.01f) return false;
    float cx = vm.m[0][0]*world.x + vm.m[0][1]*world.y + vm.m[0][2]*world.z + vm.m[0][3];
    float cy = vm.m[1][0]*world.x + vm.m[1][1]*world.y + vm.m[1][2]*world.z + vm.m[1][3];
    screen.x = (sw * 0.5f) * (1.f + cx / w);
    screen.y = (sh * 0.5f) * (1.f - cy / w);
    return true;
}

// -----------------------------------------------------------------------
// Angle from view-angles to target point, for FOV checks
// -----------------------------------------------------------------------
inline float fovToTarget(const Vec3& viewAngles, const Vec3& camPos, const Vec3& target) {
    Vec3 diff = target - camPos;
    float yaw   = atan2f(diff.y, diff.x) * (180.f / (float)M_PI);
    float dist2 = diff.len2d();
    float pitch = -atan2f(diff.z, dist2) * (180.f / (float)M_PI);
    float dy = yaw   - viewAngles.y;
    float dp = pitch - viewAngles.x;
    while (dy >  180.f) dy -= 360.f;
    while (dy < -180.f) dy += 360.f;
    return sqrtf(dy*dy + dp*dp);
}

// -----------------------------------------------------------------------
// Angle needed to look from camPos to target
// -----------------------------------------------------------------------
inline Vec3 calcAngle(const Vec3& camPos, const Vec3& target) {
    Vec3 diff = target - camPos;
    float dist2 = diff.len2d();
    float yaw   = atan2f(diff.y, diff.x) * (180.f / (float)M_PI);
    float pitch = -atan2f(diff.z, dist2)  * (180.f / (float)M_PI);
    return { pitch, yaw, 0.f };
}

// Normalize angle into [-180, 180]
inline float normAngle(float a) {
    while (a >  180.f) a -= 360.f;
    while (a < -180.f) a += 360.f;
    return a;
}

// Linear interpolation
inline float lerp(float a, float b, float t) { return a + (b - a) * t; }

// Clamp
template<typename T>
inline T clamp(T v, T lo, T hi) { return v < lo ? lo : (v > hi ? hi : v); }
