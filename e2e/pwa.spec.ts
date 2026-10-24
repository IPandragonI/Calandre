import { expect, test } from "@playwright/test";

test("serves a valid web app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ short_name: "Calandre", display: "standalone", start_url: "/" });
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
});

test("keeps the app shell and catalogue playable offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // Second visit goes through the active worker, filling its cache.
  await page.reload();
  await page.goto("/play?mode=classic");
  await expect(page.getByText("Voiture 1 sur 10")).toBeVisible();

  await context.setOffline(true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Quelle est cette voiture ?" })).toBeVisible();
  await expect(page.getByText(/Hors ligne/)).toBeVisible();

  // The game and its catalogue come from the service worker; photos are remote, so each one
  // either comes from the browser's HTTP cache or shows the offline explanation — never a broken page.
  await page.goto("/play?mode=classic");
  await expect(page.getByText("Voiture 1 sur 10")).toBeVisible();
  const photo = page.locator("figure img").first();
  const fallback = page.getByText(/Pas de connexion : cette photo est hébergée en ligne/);
  await expect(photo.or(fallback).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Valider" })).toBeVisible();
  await context.setOffline(false);
});
