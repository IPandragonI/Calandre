import type { Page } from "@playwright/test";
import cars from "../src/data/cars.json" with { type: "json" };

type Car = (typeof cars)[number];

/** Identifies the car on screen from its (opaque) photo URL, as a player with perfect knowledge would. */
export async function currentCar(page: Page): Promise<Car> {
  const src = await page.locator("figure img").first().getAttribute("src");
  const car = cars.find((c) => src?.startsWith(`${c.image.src}-`));
  if (!car) throw new Error(`No car for photo ${src}`);
  return car;
}

export async function answer(page: Page, text: string, submitLabel = "Valider") {
  await page.getByLabel(/Marque et modèle|Make and model/).fill(text);
  await page.getByRole("button", { name: submitLabel }).click();
}

export async function answerCorrectly(page: Page, submitLabel?: string) {
  const car = await currentCar(page);
  await answer(page, `${car.make} ${car.model}`, submitLabel);
  return car;
}

/** Positive when the page scrolls horizontally. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
