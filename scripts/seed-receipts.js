#!/usr/bin/env node
/**
 * Seed script to create dummy receipt records with tiny placeholder images.
 * Each image is a 1x1 pixel PNG (~70 bytes) -- essentially zero bandwidth.
 * 
 * Prerequisites:
 * 1. Run schema-receipts.sql in Supabase SQL Editor
 * 2. Create a "receipts" storage bucket in Supabase Dashboard > Storage
 * 3. Run storage-policies.sql in Supabase SQL Editor
 * 
 * Usage: node scripts/seed-receipts.js <email> <password>
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// ── Load .env ──────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
});

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Tiny 1x1 pixel PNGs (base64-encoded, ~70 bytes each) ──
// These are valid PNG files verified to be displayable
const TINY_PNGS = {
  yellow: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8BQDwAEgAF/pooBPQAAAABJRU5ErkJggg==",
    "base64"
  ),
  blue: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPgPAAEDAQAIicLsAAAAASUVORK5CYII=",
    "base64"
  ),
  red: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8BQDwAEgAF/pooBPQAAAABJRU5ErkJggg==",
    "base64"
  ),
  green: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  ),
  gray: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
    "base64"
  ),
};

async function main() {
  console.log("🧾 Seeding dummy receipts...\n");

  // ── Authenticate ─────────────────────────────────────────
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: node scripts/seed-receipts.js <email> <password>");
    console.error("Example: node scripts/seed-receipts.js you@email.com yourpassword");
    process.exit(1);
  }

  console.log(`Signing in as ${email}...`);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    console.error("Sign-in failed:", signInError.message);
    process.exit(1);
  }
  console.log("Signed in!\n");

  // ── Get tenant_id ────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: tenantUser, error: tenantError } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (tenantError || !tenantUser) {
    console.error("Could not find tenant:", tenantError?.message);
    process.exit(1);
  }

  const tenantId = tenantUser.tenant_id;
  console.log("Tenant ID:", tenantId, "\n");

  // ── Dummy receipt definitions ────────────────────────────
  const dummyReceipts = [
    { name: "fuel-shell-receipt",       png: "yellow", status: "unprocessed", type: null,      daysAgo: 0 },
    { name: "hotel-holiday-inn",        png: "blue",   status: "unprocessed", type: null,      daysAgo: 1 },
    { name: "repair-tire-shop",         png: "red",    status: "unprocessed", type: null,      daysAgo: 2 },
    { name: "fuel-loves-truck-stop",    png: "yellow", status: "unprocessed", type: null,      daysAgo: 3 },
    { name: "tolls-ohio-turnpike",      png: "green",  status: "processed",   type: "expense", daysAgo: 5 },
    { name: "fuel-pilot-flying-j",      png: "yellow", status: "processed",   type: "fuel",    daysAgo: 7 },
  ];

  console.log(`Creating ${dummyReceipts.length} dummy receipts...\n`);

  let successCount = 0;

  for (const receipt of dummyReceipts) {
    const imageData = TINY_PNGS[receipt.png];
    const fileName = `${tenantId}/${receipt.name}-${Date.now()}.png`;

    // Upload tiny image to storage
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, imageData, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error(`  ✗ Upload failed for "${receipt.name}": ${uploadError.message}`);
      continue;
    }

    // Calculate past date
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - receipt.daysAgo);

    // Insert receipt record
    const { error: dbError } = await supabase.from("receipts").insert({
      tenant_id: tenantId,
      image_path: fileName,
      status: receipt.status,
      receipt_type: receipt.type,
      created_at: createdAt.toISOString(),
    });

    if (dbError) {
      console.error(`  ✗ DB insert failed for "${receipt.name}": ${dbError.message}`);
      continue;
    }

    const label = receipt.type ? `${receipt.status} - ${receipt.type}` : receipt.status;
    console.log(`  ✓ ${receipt.name} (${label})`);
    successCount++;

    // Small delay so timestamps differ
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`\n${successCount}/${dummyReceipts.length} receipts created successfully.`);
  console.log("Open the app and go to Receipts to see them!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
