import type { Car } from "@/types/car";

/** A valid car for tests; override only what the test cares about. */
export function makeCar(overrides: Partial<Car> & Pick<Car, "id" | "make" | "model">): Car {
  return {
    years: { from: 1990, to: 2000 },
    region: "europe",
    bodyType: "coupe",
    tags: ["sports"],
    difficulty: 2,
    acceptedAnswers: [],
    clue: { fr: "Indice.", en: "Clue." },
    funFact: { fr: "Anecdote.", en: "Fun fact." },
    image: {
      src: `/cars/${overrides.id}`,
      width: 1200,
      height: 800,
      alt: { fr: "Photo", en: "Photo" },
      sourcePage: "https://commons.wikimedia.org/wiki/File:Example.jpg",
      author: "Someone",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    },
    ...overrides,
  };
}

export const FIXTURE_CARS: Car[] = [
  makeCar({ id: "bmw-m3-e46", make: "BMW", model: "M3", generation: "E46", acceptedAnswers: ["BMW E46 M3"] }),
  makeCar({ id: "bmw-m5", make: "BMW", model: "M5", difficulty: 3 }),
  makeCar({ id: "porsche-911", make: "Porsche", model: "911", generation: "993", acceptedAnswers: ["Porsche 993"] }),
  makeCar({ id: "mazda-mx5", make: "Mazda", model: "MX-5", generation: "NA", acceptedAnswers: ["Mazda Miata"], region: "japan", difficulty: 1 }),
  makeCar({ id: "lambo-countach", make: "Lamborghini", model: "Countach", region: "europe", tags: ["supercar"], difficulty: 1 }),
  makeCar({ id: "citroen-2cv", make: "Citroën", model: "2CV", region: "europe", tags: ["classic", "everyday"], difficulty: 1 }),
  makeCar({ id: "mercedes-300sl", make: "Mercedes-Benz", model: "300 SL", region: "europe", tags: ["classic"], difficulty: 2 }),
  makeCar({ id: "toyota-supra", make: "Toyota", model: "Supra", generation: "A80", region: "japan", difficulty: 2 }),
  makeCar({ id: "nissan-leaf", make: "Nissan", model: "Leaf", region: "japan", tags: ["electric", "everyday"], difficulty: 1 }),
  makeCar({ id: "ford-gt40", make: "Ford", model: "GT40", region: "usa", tags: ["racing"], difficulty: 2 }),
  makeCar({ id: "ford-gt", make: "Ford", model: "GT", region: "usa", tags: ["supercar"], difficulty: 3 }),
  makeCar({ id: "vw-golf", make: "Volkswagen", model: "Golf GTI", region: "europe", tags: ["everyday"], difficulty: 1 }),
];
