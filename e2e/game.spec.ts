import { expect, test } from "@playwright/test";
import { answer, answerCorrectly, currentCar } from "./helpers";

test.describe("classic quiz", () => {
  test("plays a full game and shows the results", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await page.getByRole("link", { name: "Jouer", exact: true }).click();
    await expect(page.getByText("Voiture 1 sur 10")).toBeVisible();

    // 1: right first time (100).
    await answerCorrectly(page);
    await expect(page.getByText("Bien vu !")).toBeVisible();
    await expect(page.getByText("Le saviez-vous ?")).toBeVisible();
    await page.getByRole("button", { name: "Voiture suivante" }).click();

    // 2: one wrong attempt, then right (70).
    await answer(page, "Trabant 601");
    await expect(page.getByText(/Pas tout à fait\. Encore 2 essais/)).toBeVisible();
    await answerCorrectly(page);
    await page.getByRole("button", { name: "Voiture suivante" }).click();

    // 3: a hint, then reveal the answer (0).
    const third = await currentCar(page);
    await page.getByRole("button", { name: /Indice/ }).click();
    await expect(page.getByText(`Le constructeur est ${third.make}.`)).toBeVisible();
    await page.getByRole("button", { name: "Voir la réponse" }).click();
    await expect(page.getByText("Réponse révélée.")).toBeVisible();
    await page.getByRole("button", { name: "Voiture suivante" }).click();

    // 4–10: right first time; Enter submits and Enter moves on.
    for (let i = 4; i <= 10; i++) {
      await expect(page.getByText(`Voiture ${i} sur 10`)).toBeVisible();
      const car = await currentCar(page);
      await page.getByLabel("Marque et modèle").fill(`${car.make} ${car.model}`);
      await page.keyboard.press("Enter");
      const next = page.getByRole("button", { name: i === 10 ? "Voir les résultats" : "Voiture suivante" });
      await expect(next).toBeFocused();
      await page.keyboard.press("Enter");
    }

    await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible();
    await expect(page.getByText("870", { exact: true })).toBeVisible();
    await expect(page.getByText("9/10")).toBeVisible();
    await expect(page.getByText("Nouveau record !")).toBeVisible();
    await expect(page.locator("#breakdown-title + ol > li")).toHaveCount(10);

    // Statistics survive a reload.
    await page.goto("/stats");
    await page.reload();
    // French percentages use a narrow no-break space ("90 %").
    await expect(page.getByText(/^90\s%$/).first()).toBeVisible();
    await expect(page.getByText("870 pts", { exact: true })).toBeVisible();
  });

  test("near misses don't cost an attempt", async ({ page }) => {
    await page.goto("/play?mode=classic");
    const car = await currentCar(page);
    await answer(page, car.make);
    await expect(page.getByText(/Essai non décompté\./)).toBeVisible();
    await answerCorrectly(page);
    await expect(page.getByText("+100 pts").first()).toBeVisible();
  });

  test("resumes the game after a reload", async ({ page }) => {
    await page.goto("/play?mode=classic");
    await answerCorrectly(page);
    await page.getByRole("button", { name: "Voiture suivante" }).click();
    const second = await currentCar(page);
    await page.reload();
    await expect(page.getByText("Voiture 2 sur 10")).toBeVisible();
    expect((await currentCar(page)).id).toBe(second.id);
    await page.goto("/");
    await expect(page.getByText("Partie en cours")).toBeVisible();
  });
});

test.describe("preferences", () => {
  test("switches language mid-game without losing progress, and remembers it", async ({ page }) => {
    await page.goto("/play?mode=classic");
    await answerCorrectly(page);
    await page.getByRole("button", { name: "Voiture suivante" }).click();
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("Car 2 of 10")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Which car is this?" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Which car is this?" })).toBeVisible();
  });

  test("defaults to light, switches to dark, and applies it before first paint", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "calandre-light");
    await page.getByRole("button", { name: /Thème|Theme/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "calandre-dark");

    // The inline head script sets the theme before React hydrates.
    await page.reload({ waitUntil: "commit" });
    await page.waitForFunction(() => document.body !== null);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("calandre-dark");
    await page.waitForLoadState("load");
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe("rgb(18, 19, 21)");
  });

  test("resets statistics after confirmation", async ({ page }) => {
    await page.goto("/play?mode=endless");
    for (let i = 0; i < 3; i++) {
      await answer(page, "Trabant 601");
      await page.getByRole("button", { name: /Voiture suivante|Voir les résultats/ }).click();
    }
    await expect(page.getByRole("heading", { name: "Partie terminée" })).toBeVisible();
    await page.goto("/settings");
    await page.getByRole("button", { name: "Réinitialiser les statistiques" }).click();
    await page.getByRole("button", { name: "Réinitialiser", exact: true }).click();
    await expect(page.getByText("Statistiques réinitialisées.")).toBeVisible();
    await page.goto("/stats");
    await expect(page.getByText("Jouez une première partie")).toBeVisible();
  });
});

test.describe("other modes", () => {
  test("daily challenge is stable for the day and can only be completed once", async ({ page, browser }) => {
    await page.goto("/play?mode=daily");
    const first = await currentCar(page);
    await page.reload();
    expect((await currentCar(page)).id).toBe(first.id);

    // Same date, fresh storage: same sequence.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("http://localhost:3300/play?mode=daily");
    expect((await currentCar(otherPage)).id).toBe(first.id);
    await other.close();

    for (let i = 1; i <= 5; i++) {
      await answerCorrectly(page);
      await page.getByRole("button", { name: i === 5 ? "Voir les résultats" : "Voiture suivante" }).click();
    }
    await expect(page.getByRole("heading", { name: "Défi terminé" })).toBeVisible();
    await page.goto("/play?mode=daily");
    await expect(page.getByRole("heading", { name: "Défi terminé" })).toBeVisible();
    await expect(page.getByText("🟩🟩🟩🟩🟩")).toBeVisible();
  });

  test("time attack shows a running clock", async ({ page }) => {
    await page.goto("/play?mode=timed");
    await expect(page.getByRole("timer")).toHaveAttribute("aria-label", /secondes restantes/);
    await answerCorrectly(page);
    // Correct answers move on automatically.
    await expect(page.getByText("Voiture n° 2")).toBeVisible();
  });

  test("category games only ask cars from that category", async ({ page }) => {
    await page.goto("/categories");
    await page.getByRole("link", { name: /Japonaises/ }).click();
    for (let i = 0; i < 3; i++) {
      const car = await currentCar(page);
      expect(car.region).toBe("japan");
      await answerCorrectly(page);
      await page.getByRole("button", { name: "Voiture suivante" }).click();
    }
  });
});
