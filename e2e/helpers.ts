import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { Car } from "../src/types/car";

/** The generated catalogue the game loads at runtime. */
export const CARS: Car[] = JSON.parse(readFileSync(new URL("../public/catalogue.json", import.meta.url), "utf8"));

/** A string that names no car at all. */
export const WRONG = "Zzyzx Qwerty 9999";

/** Identifies the car on screen from its remote photo URL, as a player with perfect knowledge would. */
export async function currentCar(page: Page): Promise<Car> {
  const src = await page.locator("figure img").first().getAttribute("src");
  const car = CARS.find((c) => c.image.url === src);
  if (!car) throw new Error(`No car for photo ${src}`);
  return car;
}

export async function answer(page: Page, text: string, submitLabel = "Valider") {
  await page.getByLabel(/Marque et modèle|Make and model|Marque, modèle et génération/).fill(text);
  await page.getByRole("button", { name: submitLabel }).click();
}

export async function answerCorrectly(page: Page, submitLabel?: string) {
  const car = await currentCar(page);
  await answer(page, `${car.make} ${car.model}${car.generation ? ` ${car.generation}` : ""}`, submitLabel);
  return car;
}

/** Positive when the page scrolls horizontally. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
