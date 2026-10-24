import { expect, test } from "@playwright/test";
import { answerCorrectly, horizontalOverflow } from "./helpers";

test("mobile layout has no horizontal scroll and keeps the answer field reachable", async ({ page }) => {
  for (const path of ["/", "/categories", "/garage", "/stats", "/settings", "/credits"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
  }

  await page.goto("/play?mode=classic");
  const input = page.getByLabel("Marque et modèle");
  await expect(input).toBeInViewport();
  await expect(page.getByRole("button", { name: "Valider" })).toBeInViewport();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  // Touch targets: the main buttons are at least 44px tall.
  const submit = await page.getByRole("button", { name: "Valider" }).boundingBox();
  expect(submit!.height).toBeGreaterThanOrEqual(44);

  await answerCorrectly(page);
  await expect(page.getByRole("button", { name: "Voiture suivante" })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
