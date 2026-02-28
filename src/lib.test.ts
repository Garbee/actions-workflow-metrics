import { describe, it, mock } from "node:test";
import * as assert from "node:assert/strict";
import { getRootMountPoint, parseMacOsVmStat } from "./lib.ts";

describe("getRootMountPoint", () => {
  it("should return '/' for Linux (linux platform)", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
      configurable: true
    });

    const result = getRootMountPoint();
    assert.strictEqual(result, '/');

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
  });

  it("should return 'C:' for Windows (win32 platform)", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
      configurable: true
    });

    const result = getRootMountPoint();
    assert.strictEqual(result, 'C:');

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
  });

  it("should return '/System/Volumes/Data' for macOS (darwin platform)", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
      configurable: true
    });

    const result = getRootMountPoint();
    assert.strictEqual(result, '/System/Volumes/Data');

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
  });

  it("should return '/' for other Unix-like platforms", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'freebsd',
      writable: true,
      configurable: true
    });

    const result = getRootMountPoint();
    assert.strictEqual(result, '/');

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
  });
});

describe("parseMacOsVmStat", () => {
  const totalMemory14GB = 14 * 1024 * 1024 * 1024; // 14 GB

  it("should parse vm_stat output with 4KB pages (Intel)", () => {
    const vmStatOutput = `Mach Virtual Memory Statistics: (page size of 4096 bytes)
Pages free:                              400000.
Pages active:                           1800000.
Pages inactive:                          800000.
Pages speculative:                        50000.
Pages throttled:                              0.
Pages wired down:                        600000.
Pages purgeable:                         100000.
"Translation faults":                  12345678.
Pages copy-on-write:                     678901.
Pages zero filled:                      2345678.
Pages reactivated:                       123456.
Pages purged:                             67890.
File-backed pages:                       234567.
Anonymous pages:                         345678.
Pages stored in compressor:                   0.
Pages occupied by compressor:                 0.
Decompressions:                               0.
Compressions:                                 0.
Pageins:                                 345678.
Pageouts:                                 12345.
Swapins:                                      0.
Swapouts:                                     0.`;

    const result = parseMacOsVmStat(vmStatOutput, totalMemory14GB);

    // available = (400000 + 800000 + 100000 + 50000) * 4096 = 1350000 * 4096
    const expectedAvailable = 1350000 * 4096;
    assert.strictEqual(result.available, expectedAvailable);
    assert.strictEqual(result.active, totalMemory14GB - expectedAvailable);
    assert.ok(result.available > 0);
    assert.ok(result.active > 0);
    assert.strictEqual(result.active + result.available, totalMemory14GB);
  });

  it("should parse vm_stat output with 16KB pages (Apple Silicon)", () => {
    const totalMemory7GB = 7 * 1024 * 1024 * 1024;
    const vmStatOutput = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               50000.
Pages active:                            200000.
Pages inactive:                          100000.
Pages speculative:                        10000.
Pages throttled:                              0.
Pages wired down:                         80000.
Pages purgeable:                          20000.
"Translation faults":                   1234567.
Pages copy-on-write:                      67890.
Pages zero filled:                       234567.
Pages reactivated:                        12345.
Pages purged:                              6789.
File-backed pages:                        23456.
Anonymous pages:                          34567.
Pages stored in compressor:                   0.
Pages occupied by compressor:                 0.
Decompressions:                               0.
Compressions:                                 0.
Pageins:                                  34567.
Pageouts:                                  1234.
Swapins:                                      0.
Swapouts:                                     0.`;

    const result = parseMacOsVmStat(vmStatOutput, totalMemory7GB);

    // available = (50000 + 100000 + 20000 + 10000) * 16384 = 180000 * 16384
    const expectedAvailable = 180000 * 16384;
    assert.strictEqual(result.available, expectedAvailable);
    assert.strictEqual(result.active, totalMemory7GB - expectedAvailable);
  });

  it("should include purgeable and speculative pages in available", () => {
    const vmStatOutput = `Mach Virtual Memory Statistics: (page size of 4096 bytes)
Pages free:                              100000.
Pages active:                            500000.
Pages inactive:                          200000.
Pages speculative:                        30000.
Pages wired down:                        100000.
Pages purgeable:                          50000.`;

    const total = 4 * 1024 * 1024 * 1024;
    const result = parseMacOsVmStat(vmStatOutput, total);

    // available includes free + inactive + purgeable + speculative
    const expectedAvailable = (100000 + 200000 + 50000 + 30000) * 4096;
    assert.strictEqual(result.available, expectedAvailable);
  });

  it("should handle missing page categories gracefully", () => {
    const vmStatOutput = `Mach Virtual Memory Statistics: (page size of 4096 bytes)
Pages free:                              300000.
Pages active:                           1000000.`;

    const result = parseMacOsVmStat(vmStatOutput, totalMemory14GB);

    // Only free pages counted since inactive/purgeable/speculative are missing
    const expectedAvailable = 300000 * 4096;
    assert.strictEqual(result.available, expectedAvailable);
    assert.strictEqual(result.active, totalMemory14GB - expectedAvailable);
  });

  it("should default to 16KB page size if header is malformed", () => {
    const vmStatOutput = `Some unexpected header line
Pages free:                              100000.
Pages inactive:                           50000.`;

    const total = 8 * 1024 * 1024 * 1024;
    const result = parseMacOsVmStat(vmStatOutput, total);

    // Default 16KB page size
    const expectedAvailable = (100000 + 50000) * 16384;
    assert.strictEqual(result.available, expectedAvailable);
  });

  it("should clamp available to total memory", () => {
    // Scenario where page counts would exceed total (shouldn't happen normally)
    const smallTotal = 1 * 1024 * 1024 * 1024; // 1 GB
    const vmStatOutput = `Mach Virtual Memory Statistics: (page size of 4096 bytes)
Pages free:                              500000.
Pages inactive:                          500000.
Pages purgeable:                         500000.
Pages speculative:                       500000.`;

    const result = parseMacOsVmStat(vmStatOutput, smallTotal);

    // Should be clamped to total
    assert.strictEqual(result.available, smallTotal);
    assert.strictEqual(result.active, 0);
  });

  it("should produce used + available equal to total", () => {
    const vmStatOutput = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               25000.
Pages active:                            150000.
Pages inactive:                           75000.
Pages speculative:                         5000.
Pages wired down:                         50000.
Pages purgeable:                          10000.`;

    const total = 7 * 1024 * 1024 * 1024;
    const result = parseMacOsVmStat(vmStatOutput, total);

    assert.strictEqual(result.active + result.available, total);
  });
});
