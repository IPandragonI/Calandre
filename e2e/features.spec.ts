import { expect, test } from "@playwright/test";
import { answer, answerCorrectly, CARS, currentCar } from "./helpers";

test.describe("remote photos", () => {
  test("a photo that fails to load shows a fallback and can be swapped without penalty", async ({ page }) => {
    // Simulate Wikimedia Commons being unreachable.
    await page.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) => route.abort());
    await page.goto("/play?mode=classic");
    await expect(page.getByText("Cette photo n'a pas pu être chargée depuis Wikimedia Commons.")).toBeVisible();
    const before = await page.locator("[data-car-id]").getAttribute("data-car-id");
    await page.getByRole("button", { name: /Changer de voiture/ }).click();
    await expect(page.locator("[data-car-id]")).not.toHaveAttribute("data-car-id", before!);
    // Still the first car, nothing scored or lost.
    await expect(page.getByText("Voiture 1 sur 10")).toBeVisible();
    await expect(page.getByRole("button", { name: "Valider" })).toBeEnabled();
  });

  test("photos are hotlinked from Wikimedia, with attribution available", async ({ page }) => {
    await page.goto("/play?mode=classic");
    const img = page.locator("figure img").first();
    await expect(img).toHaveAttribute("src", /^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//);
    await expect(img).toHaveAttribute("alt", "Photo de la voiture à identifier");
    await page.getByRole("button", { name: "À propos de la photo" }).click();
    await expect(page.getByText(/^Licence/)).toBeVisible();
  });
});

test.describe("difficulty", () => {
  test("an easy game only shows easy cars, one per model", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Facile", { exact: true }).click();
    await page.getByRole("link", { name: "Jouer" }).click();
    await expect(page).toHaveURL(/difficulty=easy/);
    const seen = [];
    for (let i = 0; i < 10; i++) {
      seen.push(await currentCar(page));
      await answerCorrectly(page);
      await page.getByRole("button", { name: /Voiture suivante|Voir les résultats/ }).click();
    }
    expect(seen.every((c) => c.difficulty === 1)).toBe(true);
    expect(new Set(seen.map((c) => `${c.make} ${c.model}`)).size).toBe(seen.length);
  });
});

test.describe("new modes", () => {
  test("generations mode asks for the generation", async ({ page }) => {
    await page.goto("/play?mode=generation");
    const car = await currentCar(page);
    expect(car.generation).toBeTruthy();
    await answer(page, `${car.make} ${car.model}`);
    await expect(page.getByText(/Précisez maintenant la génération/)).toBeVisible();
    await answer(page, `${car.make} ${car.model} ${car.generation}`);
    await expect(page.getByText("Génération exacte, chapeau !")).toBeVisible();
  });

  test("zoom mode starts on a close-up that widens with each attempt", async ({ page }) => {
    await page.goto("/play?mode=zoom");
    const img = page.locator("figure img").first();
    await expect(img).toHaveAttribute("style", /scale\(2\.4\)/);
    await page.getByRole("button", { name: /Indice/ }).click();
    await expect(img).toHaveAttribute("style", /scale\(1\.8\)/);
  });

  test("brand challenges only show that brand, and the model alone is enough", async ({ page }) => {
    await page.goto("/categories");
    const firstBrand = page.locator('a[href*="make="]').first();
    const make = new URL((await firstBrand.getAttribute("href"))!, "http://x").searchParams.get("make")!;
    await firstBrand.click();
    await expect(page.getByText(`Défi ${make} : inutile de taper la marque`, { exact: false })).toBeVisible();
    for (let i = 0; i < 3; i++) {
      const car = await currentCar(page);
      expect(car.make).toBe(make);
      // No make typed: it is implied by the challenge.
      await answer(page, car.generation ? `${car.model} ${car.generation}` : car.model);
      await expect(page.getByText("Bien vu !")).toBeVisible();
      await page.getByRole("button", { name: "Voiture suivante" }).click();
    }
  });

  test("identified cars join the garage and open their own page", async ({ page }) => {
    await page.goto("/play?mode=classic");
    const car = await answerCorrectly(page);
    // "Stop" is offered while a question is open.
    await page.getByRole("button", { name: "Voiture suivante" }).click();
    await page.getByRole("button", { name: "Arrêter" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Arrêter" }).click();
    await expect(page.getByText("1 nouvelle voiture dans votre garage")).toBeVisible();
    await page.getByRole("link", { name: /nouvelle voiture/ }).click();
    await expect(page.getByText(/^1 sur .+ voitures$/)).toBeVisible();
    expect(CARS.some((c) => c.id === car.id)).toBe(true);

    // The card opens the car's own page, with a shareable URL and a way back.
    await page.locator(`a[href="/garage/${car.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/garage/${car.id}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(car.model);
    await expect(page.getByText(/Dans votre garage depuis le/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fiche" })).toBeVisible();
    await page.getByRole("link", { name: "Retour au garage" }).click();
    await expect(page).toHaveURL(/\/garage$/);
  });
});

test.describe("garage", () => {
  test("browses the whole catalogue with filters, sorting and reset", async ({ page }) => {
    await page.goto("/garage");
    await page.getByRole("radio", { name: "Tout le catalogue" }).click();
    const count = page.getByRole("status").filter({ hasText: /voitures?$/ });
    const total = await count.textContent();
    await page.getByLabel("Toutes les marques").selectOption("Ferrari");
    await expect(count).not.toHaveText(total!);
    for (const make of await page.locator("ul li a .eyebrow").allTextContents()) expect(make).toBe("Ferrari");
    await page.getByLabel("Trier").selectOption("oldest");
    await page.getByLabel("Rechercher dans le garage").fill("F40");
    await expect(page.locator('a[href^="/garage/"]').first()).toContainText("F40");
    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await expect(count).toHaveText(total!);
  });
});
