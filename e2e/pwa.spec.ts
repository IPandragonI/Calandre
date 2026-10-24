import { expect, test } from "@playwright/test";
import { currentCar } from "./helpers";

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

test("works offline once the service worker has cached the app", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // Second visit goes through the active worker, filling the caches.
  await page.reload();
  await page.goto("/play?mode=classic");
  const car = await currentCar(page);
  await expect(page.locator("figure img").first()).toBeVisible();

  await context.setOffline(true);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Quelle est cette voiture ?" })).toBeVisible();
  await expect(page.getByText(/Hors ligne/)).toBeVisible();

  // The game page and the photo already seen still load from the caches.
  await page.goto("/play?mode=classic");
  await expect(page.getByText("Voiture 1 sur 10")).toBeVisible();
  expect((await currentCar(page)).id).toBe(car.id);
  const loaded = await page.locator("figure img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(loaded).toBe(true);
  await context.setOffline(false);
});
