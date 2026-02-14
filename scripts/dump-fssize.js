#!/usr/bin/env node

import { fsSize } from "systeminformation";

async function main() {
  try {
    console.log("Fetching filesystem size information...\n");
    const data = await fsSize();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error fetching fsSize data:", error);
    process.exit(1);
  }
}

main();
