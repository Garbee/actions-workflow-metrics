#!/usr/bin/env node

/**
 * This script is intended to be independnet of the rest of
 * the codebase. It is used to determine if the native logic
 * works before making wider modifications throughout the codebase.
 */

import { statfs } from 'node:fs/promises';
import os from 'node:os';

const convertBytesToGB = (bytes: number) => (bytes / Math.pow(1024, 3)).toFixed(2);

console.group('CI Information');
console.log('CI:', process.env.CI);
console.log('GITHUB_ACTION:', process.env.GITHUB_ACTION);
console.log('GITHUB_WORKSPACE:', process.env.GITHUB_WORKSPACE);
console.groupEnd();

console.group('Memory')
console.log('Free memory:', convertBytesToGB(os.freemem()), 'GB');
console.log('Total memory:', convertBytesToGB(os.totalmem()), 'GB');
console.groupEnd();

console.group('Processor')
console.log('CPU architecture:', os.machine());
console.log('Number of CPU cores:', os.cpus().length);
console.log('Parallelism Cores:', os.availableParallelism());
console.groupEnd();

console.group('Operating System')
console.log('Type:', os.type());
console.log('Release:', os.release());
console.log('Version:', os.version());
console.groupEnd();

console.group('User');
const userInfo = os.userInfo();
console.log('Username:', userInfo.username);
console.log('Home directory:', userInfo.homedir);
console.log('Shell:', userInfo.shell);
console.log('UID:', userInfo.uid);
console.log('GID:', userInfo.gid);
console.groupEnd();

console.group('Disk');
let storagePath = process.env.RESOURCE_COLLECTION_STORAGE_PATH;
switch (os.platform()) {
  case 'win32': {
    // Windows x64 uses a D: drive. ARM uses C:.
    // So infer the drive letter from the GITHUB_WORKSPACE if possible, otherwise default to C: since it always exists.
    storagePath ??= process.env.GITHUB_WORKSPACE?.slice(0, 2) ?? 'C:';
  }
    break;
  case 'darwin':
    // On macOS, the root path is read-only, so we need to use the data volume.
    // This is the default so should work for most cases. If not, users need
    // to override with inputs.
    storagePath ??= '/System/Volumes/Data';
    break;
  case 'linux':
    storagePath ??= '/';
    break;
  default:
    break;
}

if (!storagePath) {
  console.warn('No storage path specified or discovered for disk information. Skipping disk information.');
  console.groupEnd();
  process.exit(0);
}

const diskInfo = await statfs(storagePath);
console.log('Total disk space:', convertBytesToGB(diskInfo.blocks * diskInfo.bsize), 'GB');
console.log('Free disk space:', convertBytesToGB(diskInfo.bfree * diskInfo.bsize), 'GB');
console.log('Available disk space:', convertBytesToGB(diskInfo.bavail * diskInfo.bsize), 'GB');


console.log();
console.groupEnd();
