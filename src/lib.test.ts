import { describe, it, mock } from "node:test";
import * as assert from "node:assert/strict";
import { getRootMountPoint } from "./lib.ts";

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
