/**
 * VEHICLE TAXONOMY SEED — Pakistan market.
 *
 * This is Phase 0 and it is the highest-value boring work in the project.
 * Everything downstream (facet pages, price analytics, comparisons, the
 * listing wizard's dropdowns) is only as good as this dataset.
 *
 * What is here covers the models that carry the overwhelming majority of
 * real transactions. It is a starting point, not a finished catalogue —
 * budget a few days of a careful person's time to extend variants per model
 * and verify launch prices. Cheap to expand later, expensive to get wrong
 * in structure.
 */

import type { BodyType, Fuel, Transmission } from "./types";

export interface VariantSeed {
  slug: string;
  name: string;
  engineCc?: number;
  transmission?: Transmission;
  fuel?: Fuel;
  bodyType?: BodyType;
  yearFrom?: number;
  yearTo?: number;
}

export interface ModelSeed {
  slug: string;
  name: string;
  bodyType?: BodyType;
  popularity: number;
  variants?: VariantSeed[];
}

export interface MakeSeed {
  slug: string;
  name: string;
  countryOfOrigin: string;
  popularity: number;
  models: ModelSeed[];
}

// ---------------------------------------------------------------------------
// CARS
// ---------------------------------------------------------------------------

export const CAR_MAKES: MakeSeed[] = [
  {
    slug: "suzuki",
    name: "Suzuki",
    countryOfOrigin: "japanese",
    popularity: 100,
    models: [
      {
        slug: "alto",
        name: "Alto",
        bodyType: "hatchback",
        popularity: 98,
        variants: [
          { slug: "vx", name: "VX 660", engineCc: 660, transmission: "manual", fuel: "petrol", bodyType: "hatchback", yearFrom: 2019 },
          { slug: "vxr", name: "VXR 660", engineCc: 660, transmission: "manual", fuel: "petrol", bodyType: "hatchback", yearFrom: 2019 },
          { slug: "vxl-ags", name: "VXL AGS 660", engineCc: 660, transmission: "automatic", fuel: "petrol", bodyType: "hatchback", yearFrom: 2019 },
        ],
      },
      {
        slug: "cultus",
        name: "Cultus",
        bodyType: "hatchback",
        popularity: 95,
        variants: [
          { slug: "vxr", name: "VXR 1.0", engineCc: 1000, transmission: "manual", fuel: "petrol", bodyType: "hatchback", yearFrom: 2017 },
          { slug: "vxl", name: "VXL 1.0", engineCc: 1000, transmission: "manual", fuel: "petrol", bodyType: "hatchback", yearFrom: 2017 },
          { slug: "ags", name: "AGS 1.0", engineCc: 1000, transmission: "automatic", fuel: "petrol", bodyType: "hatchback", yearFrom: 2018 },
        ],
      },
      {
        slug: "wagon-r",
        name: "Wagon R",
        bodyType: "hatchback",
        popularity: 92,
        variants: [
          { slug: "vxr", name: "VXR 1.0", engineCc: 1000, transmission: "manual", fuel: "petrol", bodyType: "hatchback", yearFrom: 2014 },
          { slug: "vxl", name: "VXL 1.0", engineCc: 1000, transmission: "manual", fuel: "petrol", bodyType: "hatchback", yearFrom: 2014 },
          { slug: "ags", name: "AGS 1.0", engineCc: 1000, transmission: "automatic", fuel: "petrol", bodyType: "hatchback", yearFrom: 2020 },
        ],
      },
      { slug: "mehran", name: "Mehran", bodyType: "hatchback", popularity: 90, variants: [
        { slug: "vx", name: "VX 800", engineCc: 800, transmission: "manual", fuel: "petrol", bodyType: "hatchback", yearFrom: 1989, yearTo: 2019 },
        { slug: "vxr", name: "VXR 800", engineCc: 800, transmission: "manual", fuel: "petrol", bodyType: "hatchback", yearFrom: 1989, yearTo: 2019 },
      ]},
      { slug: "swift", name: "Swift", bodyType: "hatchback", popularity: 80, variants: [
        { slug: "gl", name: "GL 1.2", engineCc: 1200, transmission: "manual", fuel: "petrol", bodyType: "hatchback", yearFrom: 2022 },
        { slug: "glx-cvt", name: "GLX CVT 1.2", engineCc: 1200, transmission: "automatic", fuel: "petrol", bodyType: "hatchback", yearFrom: 2022 },
      ]},
      { slug: "bolan", name: "Bolan", bodyType: "van", popularity: 72 },
      { slug: "ravi", name: "Ravi", bodyType: "pickup", popularity: 65 },
      { slug: "every", name: "Every", bodyType: "van", popularity: 55 },
      { slug: "jimny", name: "Jimny", bodyType: "suv", popularity: 60 },
      { slug: "khyber", name: "Khyber", bodyType: "hatchback", popularity: 35 },
      { slug: "baleno", name: "Baleno", bodyType: "sedan", popularity: 30 },
    ],
  },
  {
    slug: "toyota",
    name: "Toyota",
    countryOfOrigin: "japanese",
    popularity: 99,
    models: [
      {
        slug: "corolla",
        name: "Corolla",
        bodyType: "sedan",
        popularity: 100,
        variants: [
          { slug: "gli-1-3", name: "GLi 1.3", engineCc: 1300, transmission: "manual", fuel: "petrol", bodyType: "sedan", yearFrom: 2014 },
          { slug: "gli-1-3-automatic", name: "GLi 1.3 Automatic", engineCc: 1300, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2015 },
          { slug: "xli-1-3", name: "XLi 1.3", engineCc: 1300, transmission: "manual", fuel: "petrol", bodyType: "sedan", yearFrom: 2014 },
          { slug: "altis-1-6", name: "Altis 1.6", engineCc: 1600, transmission: "manual", fuel: "petrol", bodyType: "sedan", yearFrom: 2014 },
          { slug: "altis-automatic-1-6", name: "Altis Automatic 1.6", engineCc: 1600, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2014 },
          { slug: "altis-grande-1-8", name: "Altis Grande 1.8 CVT", engineCc: 1800, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2014 },
          { slug: "altis-x-1-6", name: "Altis X 1.6", engineCc: 1600, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2021 },
        ],
      },
      {
        slug: "yaris",
        name: "Yaris",
        bodyType: "sedan",
        popularity: 88,
        variants: [
          { slug: "gli-1-3-mt", name: "GLi 1.3 MT", engineCc: 1300, transmission: "manual", fuel: "petrol", bodyType: "sedan", yearFrom: 2020 },
          { slug: "ativ-1-3-cvt", name: "ATIV 1.3 CVT", engineCc: 1300, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2020 },
          { slug: "ativ-x-1-5-cvt", name: "ATIV X 1.5 CVT", engineCc: 1500, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2020 },
        ],
      },
      { slug: "vitz", name: "Vitz", bodyType: "hatchback", popularity: 85, variants: [
        { slug: "f-1-0", name: "F 1.0", engineCc: 1000, transmission: "automatic", fuel: "petrol", bodyType: "hatchback" },
        { slug: "jewela-1-0", name: "Jewela 1.0", engineCc: 1000, transmission: "automatic", fuel: "petrol", bodyType: "hatchback" },
        { slug: "rs-1-5", name: "RS 1.5", engineCc: 1500, transmission: "automatic", fuel: "petrol", bodyType: "hatchback" },
      ]},
      { slug: "aqua", name: "Aqua", bodyType: "hatchback", popularity: 78, variants: [
        { slug: "s-1-5-hybrid", name: "S 1.5 Hybrid", engineCc: 1500, transmission: "automatic", fuel: "hybrid", bodyType: "hatchback" },
        { slug: "g-1-5-hybrid", name: "G 1.5 Hybrid", engineCc: 1500, transmission: "automatic", fuel: "hybrid", bodyType: "hatchback" },
      ]},
      { slug: "prius", name: "Prius", bodyType: "hatchback", popularity: 70 },
      { slug: "passo", name: "Passo", bodyType: "hatchback", popularity: 68 },
      { slug: "premio", name: "Premio", bodyType: "sedan", popularity: 66 },
      { slug: "fortuner", name: "Fortuner", bodyType: "suv", popularity: 82, variants: [
        { slug: "g-2-7", name: "G 2.7 Petrol", engineCc: 2700, transmission: "automatic", fuel: "petrol", bodyType: "suv" },
        { slug: "v-2-7", name: "V 2.7 Petrol", engineCc: 2700, transmission: "automatic", fuel: "petrol", bodyType: "suv" },
        { slug: "sigma-4-2-8", name: "Sigma 4 2.8 Diesel", engineCc: 2800, transmission: "automatic", fuel: "diesel", bodyType: "suv" },
        { slug: "legender-2-8", name: "Legender 2.8 Diesel", engineCc: 2800, transmission: "automatic", fuel: "diesel", bodyType: "suv" },
      ]},
      { slug: "hilux", name: "Hilux", bodyType: "pickup", popularity: 76, variants: [
        { slug: "revo-g-2-8", name: "Revo G 2.8", engineCc: 2800, transmission: "automatic", fuel: "diesel", bodyType: "pickup" },
        { slug: "revo-v-2-8", name: "Revo V 2.8", engineCc: 2800, transmission: "automatic", fuel: "diesel", bodyType: "pickup" },
        { slug: "rocco-2-8", name: "Rocco 2.8", engineCc: 2800, transmission: "automatic", fuel: "diesel", bodyType: "pickup" },
      ]},
      { slug: "prado", name: "Prado", bodyType: "suv", popularity: 74 },
      { slug: "land-cruiser", name: "Land Cruiser", bodyType: "suv", popularity: 62 },
      { slug: "corolla-cross", name: "Corolla Cross", bodyType: "crossover", popularity: 72 },
      { slug: "rush", name: "Rush", bodyType: "suv", popularity: 58 },
      { slug: "raize", name: "Raize", bodyType: "crossover", popularity: 50 },
      { slug: "surf", name: "Surf", bodyType: "suv", popularity: 40 },
    ],
  },
  {
    slug: "honda",
    name: "Honda",
    countryOfOrigin: "japanese",
    popularity: 97,
    models: [
      {
        slug: "civic",
        name: "Civic",
        bodyType: "sedan",
        popularity: 96,
        variants: [
          { slug: "vti-oriel-1-8", name: "VTi Oriel 1.8", engineCc: 1800, transmission: "automatic", fuel: "petrol", bodyType: "sedan" },
          { slug: "vti-1-8", name: "VTi 1.8", engineCc: 1800, transmission: "manual", fuel: "petrol", bodyType: "sedan" },
          { slug: "turbo-1-5", name: "1.5 Turbo", engineCc: 1500, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2016 },
          { slug: "rs-turbo-1-5", name: "RS Turbo 1.5", engineCc: 1500, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2022 },
          { slug: "oriel-1-8-i-vtec-cvt", name: "1.8 i-VTEC CVT", engineCc: 1800, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2016 },
        ],
      },
      {
        slug: "city",
        name: "City",
        bodyType: "sedan",
        popularity: 94,
        variants: [
          { slug: "1-2-mt", name: "1.2L M/T", engineCc: 1200, transmission: "manual", fuel: "petrol", bodyType: "sedan", yearFrom: 2021 },
          { slug: "1-2-cvt", name: "1.2L CVT", engineCc: 1200, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2021 },
          { slug: "aspire-1-5-cvt", name: "Aspire 1.5 CVT", engineCc: 1500, transmission: "automatic", fuel: "petrol", bodyType: "sedan", yearFrom: 2021 },
          { slug: "ivtec-1-3", name: "i-VTEC 1.3", engineCc: 1300, transmission: "manual", fuel: "petrol", bodyType: "sedan", yearTo: 2021 },
        ],
      },
      { slug: "br-v", name: "BR-V", bodyType: "crossover", popularity: 74 },
      { slug: "hr-v", name: "HR-V", bodyType: "crossover", popularity: 70 },
      { slug: "vezel", name: "Vezel", bodyType: "crossover", popularity: 76, variants: [
        { slug: "z-1-5-hybrid", name: "Z 1.5 Hybrid", engineCc: 1500, transmission: "automatic", fuel: "hybrid", bodyType: "crossover" },
        { slug: "x-1-5-hybrid", name: "X 1.5 Hybrid", engineCc: 1500, transmission: "automatic", fuel: "hybrid", bodyType: "crossover" },
      ]},
      { slug: "fit", name: "Fit", bodyType: "hatchback", popularity: 64 },
      { slug: "accord", name: "Accord", bodyType: "sedan", popularity: 48 },
      { slug: "n-wgn", name: "N Wgn", bodyType: "hatchback", popularity: 44 },
      { slug: "n-box", name: "N Box", bodyType: "hatchback", popularity: 42 },
    ],
  },
  {
    slug: "kia",
    name: "KIA",
    countryOfOrigin: "korean",
    popularity: 86,
    models: [
      { slug: "sportage", name: "Sportage", bodyType: "suv", popularity: 88, variants: [
        { slug: "alpha-2-0", name: "Alpha 2.0", engineCc: 2000, transmission: "automatic", fuel: "petrol", bodyType: "suv", yearFrom: 2019 },
        { slug: "fwd-2-0", name: "FWD 2.0", engineCc: 2000, transmission: "automatic", fuel: "petrol", bodyType: "suv", yearFrom: 2019 },
        { slug: "awd-2-0", name: "AWD 2.0", engineCc: 2000, transmission: "automatic", fuel: "petrol", bodyType: "suv", yearFrom: 2019 },
      ]},
      { slug: "picanto", name: "Picanto", bodyType: "hatchback", popularity: 78 },
      { slug: "stonic", name: "Stonic", bodyType: "crossover", popularity: 72 },
      { slug: "sorento", name: "Sorento", bodyType: "suv", popularity: 66 },
      { slug: "carnival", name: "Carnival", bodyType: "mpv", popularity: 54 },
    ],
  },
  {
    slug: "hyundai",
    name: "Hyundai",
    countryOfOrigin: "korean",
    popularity: 84,
    models: [
      { slug: "tucson", name: "Tucson", bodyType: "suv", popularity: 82, variants: [
        { slug: "gls-2-0", name: "GLS 2.0", engineCc: 2000, transmission: "automatic", fuel: "petrol", bodyType: "suv" },
        { slug: "ultimate-awd-2-0", name: "Ultimate AWD 2.0", engineCc: 2000, transmission: "automatic", fuel: "petrol", bodyType: "suv" },
      ]},
      { slug: "elantra", name: "Elantra", bodyType: "sedan", popularity: 74 },
      { slug: "sonata", name: "Sonata", bodyType: "sedan", popularity: 62 },
      { slug: "porter", name: "Porter", bodyType: "pickup", popularity: 50 },
      { slug: "santa-fe", name: "Santa Fe", bodyType: "suv", popularity: 44 },
    ],
  },
  {
    slug: "changan",
    name: "Changan",
    countryOfOrigin: "chinese",
    popularity: 76,
    models: [
      { slug: "alsvin", name: "Alsvin", bodyType: "sedan", popularity: 80, variants: [
        { slug: "comfort-1-3", name: "Comfort 1.3", engineCc: 1300, transmission: "manual", fuel: "petrol", bodyType: "sedan" },
        { slug: "comfort-1-5-dct", name: "Comfort 1.5 DCT", engineCc: 1500, transmission: "automatic", fuel: "petrol", bodyType: "sedan" },
        { slug: "lumiere-1-5-dct", name: "Lumiere 1.5 DCT", engineCc: 1500, transmission: "automatic", fuel: "petrol", bodyType: "sedan" },
      ]},
      { slug: "oshan-x7", name: "Oshan X7", bodyType: "suv", popularity: 70 },
      { slug: "karvaan", name: "Karvaan", bodyType: "van", popularity: 58 },
      { slug: "m9", name: "M9", bodyType: "pickup", popularity: 40 },
    ],
  },
  {
    slug: "mg",
    name: "MG",
    countryOfOrigin: "chinese",
    popularity: 72,
    models: [
      { slug: "hs", name: "HS", bodyType: "suv", popularity: 74 },
      { slug: "zs", name: "ZS", bodyType: "crossover", popularity: 66 },
      { slug: "zs-ev", name: "ZS EV", bodyType: "crossover", popularity: 60, variants: [
        { slug: "ev", name: "EV", transmission: "automatic", fuel: "electric", bodyType: "crossover" },
      ]},
      { slug: "mg-5", name: "MG 5", bodyType: "sedan", popularity: 52 },
    ],
  },
  {
    slug: "haval",
    name: "Haval",
    countryOfOrigin: "chinese",
    popularity: 68,
    models: [
      { slug: "jolion", name: "Jolion", bodyType: "crossover", popularity: 72, variants: [
        { slug: "1-5-turbo", name: "1.5 Turbo", engineCc: 1500, transmission: "automatic", fuel: "petrol", bodyType: "crossover" },
        { slug: "hev-1-5", name: "HEV 1.5", engineCc: 1500, transmission: "automatic", fuel: "hybrid", bodyType: "crossover" },
      ]},
      { slug: "h6", name: "H6", bodyType: "suv", popularity: 66 },
    ],
  },
  {
    slug: "prince",
    name: "Prince",
    countryOfOrigin: "chinese",
    popularity: 60,
    models: [
      { slug: "pearl", name: "Pearl", bodyType: "hatchback", popularity: 62 },
      { slug: "k07", name: "K07", bodyType: "van", popularity: 44 },
    ],
  },
  {
    slug: "united",
    name: "United",
    countryOfOrigin: "chinese",
    popularity: 56,
    models: [
      { slug: "bravo", name: "Bravo", bodyType: "hatchback", popularity: 58 },
      { slug: "alpha", name: "Alpha", bodyType: "van", popularity: 46 },
    ],
  },
  {
    slug: "faw",
    name: "FAW",
    countryOfOrigin: "chinese",
    popularity: 54,
    models: [
      { slug: "v2", name: "V2", bodyType: "hatchback", popularity: 56 },
      { slug: "x-pv", name: "X-PV", bodyType: "van", popularity: 48 },
    ],
  },
  {
    slug: "daihatsu",
    name: "Daihatsu",
    countryOfOrigin: "japanese",
    popularity: 64,
    models: [
      { slug: "mira", name: "Mira", bodyType: "hatchback", popularity: 70 },
      { slug: "move", name: "Move", bodyType: "hatchback", popularity: 60 },
      { slug: "cuore", name: "Cuore", bodyType: "hatchback", popularity: 52 },
      { slug: "hijet", name: "Hijet", bodyType: "van", popularity: 46 },
      { slug: "tanto", name: "Tanto", bodyType: "hatchback", popularity: 44 },
    ],
  },
  {
    slug: "nissan",
    name: "Nissan",
    countryOfOrigin: "japanese",
    popularity: 58,
    models: [
      { slug: "dayz", name: "Dayz", bodyType: "hatchback", popularity: 60 },
      { slug: "note", name: "Note", bodyType: "hatchback", popularity: 54 },
      { slug: "juke", name: "Juke", bodyType: "crossover", popularity: 46 },
      { slug: "sunny", name: "Sunny", bodyType: "sedan", popularity: 38 },
    ],
  },
  {
    slug: "mitsubishi",
    name: "Mitsubishi",
    countryOfOrigin: "japanese",
    popularity: 48,
    models: [
      { slug: "ek-wagon", name: "EK Wagon", bodyType: "hatchback", popularity: 50 },
      { slug: "mirage", name: "Mirage", bodyType: "hatchback", popularity: 44 },
      { slug: "pajero", name: "Pajero", bodyType: "suv", popularity: 42 },
    ],
  },
  {
    slug: "bmw",
    name: "BMW",
    countryOfOrigin: "german",
    popularity: 46,
    models: [
      { slug: "3-series", name: "3 Series", bodyType: "sedan", popularity: 48 },
      { slug: "5-series", name: "5 Series", bodyType: "sedan", popularity: 44 },
      { slug: "x5", name: "X5", bodyType: "suv", popularity: 40 },
    ],
  },
  {
    slug: "mercedes-benz",
    name: "Mercedes Benz",
    countryOfOrigin: "german",
    popularity: 45,
    models: [
      { slug: "c-class", name: "C Class", bodyType: "sedan", popularity: 46 },
      { slug: "e-class", name: "E Class", bodyType: "sedan", popularity: 42 },
      { slug: "s-class", name: "S Class", bodyType: "sedan", popularity: 36 },
    ],
  },
  {
    slug: "audi",
    name: "Audi",
    countryOfOrigin: "german",
    popularity: 42,
    models: [
      { slug: "a4", name: "A4", bodyType: "sedan", popularity: 44 },
      { slug: "a6", name: "A6", bodyType: "sedan", popularity: 40 },
      { slug: "e-tron", name: "e-tron", bodyType: "suv", popularity: 34, variants: [
        { slug: "ev", name: "e-tron EV", transmission: "automatic", fuel: "electric", bodyType: "suv" },
      ]},
    ],
  },
  {
    slug: "byd",
    name: "BYD",
    countryOfOrigin: "chinese",
    popularity: 50,
    models: [
      { slug: "atto-3", name: "Atto 3", bodyType: "crossover", popularity: 52, variants: [
        { slug: "ev", name: "Atto 3 EV", transmission: "automatic", fuel: "electric", bodyType: "crossover" },
      ]},
      { slug: "seal", name: "Seal", bodyType: "sedan", popularity: 48, variants: [
        { slug: "ev", name: "Seal EV", transmission: "automatic", fuel: "electric", bodyType: "sedan" },
      ]},
    ],
  },
  {
    slug: "proton",
    name: "Proton",
    countryOfOrigin: "japanese",
    popularity: 44,
    models: [
      { slug: "saga", name: "Saga", bodyType: "sedan", popularity: 48 },
      { slug: "x70", name: "X70", bodyType: "suv", popularity: 44 },
    ],
  },
  {
    slug: "dfsk",
    name: "DFSK",
    countryOfOrigin: "chinese",
    popularity: 38,
    models: [
      { slug: "glory-580", name: "Glory 580", bodyType: "suv", popularity: 40 },
      { slug: "glory-500", name: "Glory 500", bodyType: "suv", popularity: 34 },
    ],
  },
  { slug: "mazda", name: "Mazda", countryOfOrigin: "japanese", popularity: 36, models: [
    { slug: "rx8", name: "RX-8", bodyType: "coupe", popularity: 44 }, { slug: "axela", name: "Axela", bodyType: "sedan", popularity: 38 },
    { slug: "demio", name: "Demio", bodyType: "hatchback", popularity: 40 }, { slug: "cx-5", name: "CX-5", bodyType: "crossover", popularity: 30 },
  ]},
  { slug: "subaru", name: "Subaru", countryOfOrigin: "japanese", popularity: 32, models: [
    { slug: "stella", name: "Stella", bodyType: "hatchback", popularity: 40 }, { slug: "pleo", name: "Pleo", bodyType: "hatchback", popularity: 34 },
    { slug: "impreza", name: "Impreza", bodyType: "sedan", popularity: 32 }, { slug: "forester", name: "Forester", bodyType: "crossover", popularity: 30 },
  ]},
  { slug: "lexus", name: "Lexus", countryOfOrigin: "japanese", popularity: 40, models: [
    { slug: "lx570", name: "LX 570", bodyType: "suv", popularity: 48 }, { slug: "rx450h", name: "RX 450h", bodyType: "crossover", popularity: 38 },
    { slug: "ct200h", name: "CT 200h", bodyType: "hatchback", popularity: 36 }, { slug: "ls", name: "LS", bodyType: "sedan", popularity: 30 },
  ]},
  { slug: "chevrolet", name: "Chevrolet", countryOfOrigin: "american", popularity: 28, models: [
    { slug: "exclusive", name: "Exclusive", bodyType: "hatchback", popularity: 34 }, { slug: "joy", name: "Joy", bodyType: "hatchback", popularity: 32 },
    { slug: "optra", name: "Optra", bodyType: "sedan", popularity: 30 }, { slug: "spark", name: "Spark", bodyType: "hatchback", popularity: 25 },
  ]},
  { slug: "ford", name: "Ford", countryOfOrigin: "american", popularity: 26, models: [
    { slug: "mustang", name: "Mustang", bodyType: "coupe", popularity: 34 }, { slug: "ranger", name: "Ranger", bodyType: "pickup", popularity: 32 },
    { slug: "f150", name: "F-150", bodyType: "pickup", popularity: 28 }, { slug: "focus", name: "Focus", bodyType: "hatchback", popularity: 22 },
  ]},
  { slug: "volkswagen", name: "Volkswagen", countryOfOrigin: "german", popularity: 25, models: [
    { slug: "beetle", name: "Beetle", bodyType: "hatchback", popularity: 30 }, { slug: "golf", name: "Golf", bodyType: "hatchback", popularity: 26 },
    { slug: "passat", name: "Passat", bodyType: "sedan", popularity: 22 },
  ]},
  { slug: "renault", name: "Renault", countryOfOrigin: "french", popularity: 22, models: [
    { slug: "duster", name: "Duster", bodyType: "crossover", popularity: 28 }, { slug: "kwid", name: "Kwid", bodyType: "hatchback", popularity: 24 },
  ]},
  { slug: "peugeot", name: "Peugeot", countryOfOrigin: "french", popularity: 48, models: [
    { slug: "2008", name: "2008", bodyType: "crossover", popularity: 52 }, { slug: "3008", name: "3008", bodyType: "crossover", popularity: 35 },
    { slug: "5008", name: "5008", bodyType: "suv", popularity: 30 },
  ]},
  { slug: "isuzu", name: "Isuzu", countryOfOrigin: "japanese", popularity: 52, models: [
    { slug: "d-max", name: "D-Max", bodyType: "pickup", popularity: 58 }, { slug: "trooper", name: "Trooper", bodyType: "suv", popularity: 30 },
  ]},
  { slug: "jac", name: "JAC", countryOfOrigin: "chinese", popularity: 38, models: [
    { slug: "t9-hunter", name: "T9 Hunter", bodyType: "pickup", popularity: 45 }, { slug: "x200", name: "X200", bodyType: "pickup", popularity: 35 },
  ]},
  { slug: "chery", name: "Chery", countryOfOrigin: "chinese", popularity: 44, models: [
    { slug: "tiggo-4-pro", name: "Tiggo 4 Pro", bodyType: "crossover", popularity: 48 }, { slug: "tiggo-8-pro", name: "Tiggo 8 Pro", bodyType: "suv", popularity: 46 },
    { slug: "qq", name: "QQ", bodyType: "hatchback", popularity: 30 },
  ]},
  { slug: "baic", name: "BAIC", countryOfOrigin: "chinese", popularity: 34, models: [
    { slug: "bj40-plus", name: "BJ40 Plus", bodyType: "suv", popularity: 40 }, { slug: "x25", name: "X25", bodyType: "crossover", popularity: 28 },
  ]},
  { slug: "seres", name: "SERES", countryOfOrigin: "chinese", popularity: 36, models: [
    { slug: "3", name: "SERES 3", bodyType: "crossover", popularity: 40, variants: [{ slug: "ev", name: "SERES 3 EV", transmission: "automatic", fuel: "electric", bodyType: "crossover" }] },
  ]},
  { slug: "tesla", name: "Tesla", countryOfOrigin: "american", popularity: 30, models: [
    { slug: "model-3", name: "Model 3", bodyType: "sedan", popularity: 38, variants: [{ slug: "electric", name: "Model 3 Electric", transmission: "automatic", fuel: "electric", bodyType: "sedan" }] },
    { slug: "model-y", name: "Model Y", bodyType: "crossover", popularity: 36, variants: [{ slug: "electric", name: "Model Y Electric", transmission: "automatic", fuel: "electric", bodyType: "crossover" }] },
  ]},
];

// ---------------------------------------------------------------------------
// BIKES
// ---------------------------------------------------------------------------

export const BIKE_MAKES: MakeSeed[] = [
  {
    slug: "honda",
    name: "Honda",
    countryOfOrigin: "japanese",
    popularity: 100,
    models: [
      { slug: "cg-125", name: "CG 125", popularity: 100, variants: [
        { slug: "standard", name: "CG 125 Standard", engineCc: 125, transmission: "manual", fuel: "petrol" },
        { slug: "self-start", name: "CG 125 Self Start", engineCc: 125, transmission: "manual", fuel: "petrol" },
      ]},
      { slug: "cd-70", name: "CD 70", popularity: 98, variants: [
        { slug: "standard", name: "CD 70 Standard", engineCc: 70, transmission: "manual", fuel: "petrol" },
        { slug: "dream", name: "CD 70 Dream", engineCc: 70, transmission: "manual", fuel: "petrol" },
      ]},
      { slug: "pridor", name: "Pridor", popularity: 84, variants: [
        { slug: "100", name: "Pridor 100", engineCc: 100, transmission: "manual", fuel: "petrol" },
      ]},
      { slug: "cb-150f", name: "CB 150F", popularity: 82, variants: [
        { slug: "150", name: "CB 150F", engineCc: 150, transmission: "manual", fuel: "petrol" },
      ]},
      { slug: "cb-125f", name: "CB 125F", popularity: 80, variants: [{ slug: "standard", name: "CB 125F Standard", engineCc: 125, transmission: "manual", fuel: "petrol" }] },
    ],
  },
  {
    slug: "yamaha",
    name: "Yamaha",
    countryOfOrigin: "japanese",
    popularity: 88,
    models: [
      { slug: "ybr-125", name: "YBR 125", popularity: 90, variants: [
        { slug: "standard", name: "YBR 125", engineCc: 125, transmission: "manual", fuel: "petrol" },
      ]},
      { slug: "ybr-125g", name: "YBR 125G", popularity: 84, variants: [{ slug: "standard", name: "YBR 125G", engineCc: 125, transmission: "manual", fuel: "petrol" }] },
      { slug: "yb-125z", name: "YB 125Z", popularity: 78, variants: [{ slug: "standard", name: "YB 125Z", engineCc: 125, transmission: "manual", fuel: "petrol" }] },
      { slug: "ybr-125z-dx", name: "YBR 125Z DX", popularity: 70, variants: [{ slug: "standard", name: "YBR 125Z DX", engineCc: 125, transmission: "manual", fuel: "petrol" }] },
    ],
  },
  {
    slug: "suzuki",
    name: "Suzuki",
    countryOfOrigin: "japanese",
    popularity: 82,
    models: [
      { slug: "gs-150", name: "GS 150", popularity: 84, variants: [{ slug: "standard", name: "GS 150", engineCc: 150, transmission: "manual", fuel: "petrol" }] },
      { slug: "gd-110s", name: "GD 110S", popularity: 80, variants: [{ slug: "standard", name: "GD 110S", engineCc: 110, transmission: "manual", fuel: "petrol" }] },
      { slug: "gr-150", name: "GR 150", popularity: 66, variants: [{ slug: "standard", name: "GR 150", engineCc: 150, transmission: "manual", fuel: "petrol" }] },
      { slug: "gsx-125", name: "GSX 125", popularity: 58, variants: [{ slug: "standard", name: "GSX 125", engineCc: 125, transmission: "manual", fuel: "petrol" }] },
    ],
  },
  {
    slug: "united",
    name: "United",
    countryOfOrigin: "chinese",
    popularity: 74,
    models: [
      { slug: "us-70", name: "US 70", popularity: 78, variants: [{ slug: "standard", name: "US 70 Standard", engineCc: 70, transmission: "manual", fuel: "petrol" }] },
      { slug: "us-125", name: "US 125", popularity: 70, variants: [{ slug: "standard", name: "US 125 Standard", engineCc: 125, transmission: "manual", fuel: "petrol" }] },
      { slug: "us-150", name: "US 150", popularity: 56, variants: [{ slug: "standard", name: "US 150 Standard", engineCc: 150, transmission: "manual", fuel: "petrol" }] },
    ],
  },
  {
    slug: "road-prince",
    name: "Road Prince",
    countryOfOrigin: "chinese",
    popularity: 66,
    models: [
      { slug: "rp-70", name: "RP 70", popularity: 68, variants: [{ slug: "standard", name: "RP 70 Standard", engineCc: 70, transmission: "manual", fuel: "petrol" }] },
      { slug: "rp-110", name: "RP 110", popularity: 58, variants: [{ slug: "standard", name: "RP 110 Standard", engineCc: 110, transmission: "manual", fuel: "petrol" }] },
    ],
  },
  {
    slug: "hi-speed",
    name: "Hi Speed",
    countryOfOrigin: "chinese",
    popularity: 60,
    models: [
      { slug: "infinity-150", name: "Infinity 150", popularity: 64, variants: [{ slug: "standard", name: "Infinity 150", engineCc: 150, transmission: "manual", fuel: "petrol" }] },
      { slug: "sr-70", name: "SR 70", popularity: 54, variants: [{ slug: "standard", name: "SR 70 Standard", engineCc: 70, transmission: "manual", fuel: "petrol" }] },
    ],
  },
  {
    slug: "super-power",
    name: "Super Power",
    countryOfOrigin: "chinese",
    popularity: 56,
    models: [
      { slug: "sp-70", name: "SP 70", popularity: 58, variants: [{ slug: "standard", name: "SP 70 Standard", engineCc: 70, transmission: "manual", fuel: "petrol" }] },
      { slug: "sp-125", name: "SP 125", popularity: 48, variants: [{ slug: "standard", name: "SP 125 Standard", engineCc: 125, transmission: "manual", fuel: "petrol" }] },
    ],
  },
  {
    slug: "unique",
    name: "Unique",
    countryOfOrigin: "chinese",
    popularity: 52,
    models: [
      { slug: "ud-70", name: "UD 70", popularity: 54, variants: [{ slug: "standard", name: "UD 70 Standard", engineCc: 70, transmission: "manual", fuel: "petrol" }] },
      { slug: "ud-100", name: "UD 100", popularity: 44, variants: [{ slug: "standard", name: "UD 100 Standard", engineCc: 100, transmission: "manual", fuel: "petrol" }] },
    ],
  },
  {
    slug: "evee", name: "EVEE", countryOfOrigin: "pakistani", popularity: 86,
    models: ["S1 Air", "S1", "S1 3W", "GEN-Z", "GEN-Z Pro", "SQUBE", "LX", "Mito+", "Flipper"].map((name, index) => ({
      slug: name.toLowerCase().replaceAll("+", "-plus").replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 90 - index,
      variants: [{ slug: "electric", name: `${name} Electric`, transmission: "automatic", fuel: "electric" }],
    })),
  },
  {
    slug: "yadea", name: "Yadea", countryOfOrigin: "chinese", popularity: 84,
    models: ["GT30", "EPOC-H", "G5", "M3", "M3H", "Ruibin", "Ruibin S", "T5", "T5L", "Velax", "Keeness"].map((name, index) => ({
      slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 88 - index,
      variants: [{ slug: "electric", name: `${name} Electric`, transmission: "automatic", fuel: "electric" }],
    })),
  },
  {
    slug: "metro-ev", name: "Metro EV", countryOfOrigin: "pakistani", popularity: 82,
    models: ["Metrix", "Dabang", "M6 Empower", "T9 Sport", "Thrill Pro", "E8S Mountain Climber", "E8S Pro", "A7", "Miku Super", "Wonder Bike", "Super Bike", "X8 Foldable"].map((name, index) => ({
      slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 86 - index,
      variants: [{ slug: "electric", name: `${name} Electric`, transmission: "automatic", fuel: "electric" }],
    })),
  },
  {
    slug: "ezbike", name: "ezBike", countryOfOrigin: "pakistani", popularity: 74,
    models: ["Volt", "Spark", "Electron"].map((name, index) => ({
      slug: name.toLowerCase(), name, popularity: 80 - index,
      variants: [{ slug: "electric", name: `${name} Electric`, transmission: "automatic", fuel: "electric" }],
    })),
  },
  { slug: "benelli", name: "Benelli", countryOfOrigin: "italian", popularity: 45, models: ["TNT 25", "TNT 150i", "302S", "TRK 502"].map((name, i) => ({ slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 50 - i })) },
  { slug: "kawasaki", name: "Kawasaki", countryOfOrigin: "japanese", popularity: 44, models: ["Ninja 250R", "Ninja 300", "Ninja 400", "ZX-6R", "ZX-10R", "Z1000"].map((name, i) => ({ slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 52 - i })) },
  { slug: "ktm", name: "KTM", countryOfOrigin: "austrian", popularity: 38, models: ["Duke 125", "Duke 200", "Duke 390", "RC 200", "RC 390"].map((name, i) => ({ slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 45 - i })) },
  { slug: "bmw", name: "BMW Motorrad", countryOfOrigin: "german", popularity: 36, models: ["G 310 R", "G 310 GS", "S 1000 RR", "R 1250 GS"].map((name, i) => ({ slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 42 - i })) },
  { slug: "vespa", name: "Vespa", countryOfOrigin: "italian", popularity: 38, models: ["Primavera 150", "Sprint 150", "GTS 300"].map((name, i) => ({ slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 42 - i })) },
  { slug: "ravi", name: "Ravi", countryOfOrigin: "pakistani", popularity: 50, models: ["Humsafar 70", "Premium R1", "Piaggio Storm 125"].map((name, i) => ({ slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 55 - i })) },
  { slug: "super-star", name: "Super Star", countryOfOrigin: "pakistani", popularity: 48, models: ["SS 70", "SS 100", "SS 125", "Falcon 150"].map((name, i) => ({ slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 54 - i })) },
  { slug: "crown", name: "Crown", countryOfOrigin: "pakistani", popularity: 46, models: ["CR 70", "CR 100", "CR 125", "Fit 150"].map((name, i) => ({ slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 52 - i })) },
  { slug: "benling", name: "Benling", countryOfOrigin: "chinese", popularity: 70, models: ["Aura", "Falcon", "Icon", "Kriti", "Roshni"].map((name, i) => ({ slug: name.toLowerCase(), name, popularity: 75 - i, variants: [{ slug: "electric", name: `${name} Electric`, transmission: "automatic", fuel: "electric" }] })) },
  { slug: "vlektra", name: "Vlektra", countryOfOrigin: "pakistani", popularity: 68, models: ["Bolt", "Retro", "Velocity"].map((name, i) => ({ slug: name.toLowerCase(), name, popularity: 72 - i, variants: [{ slug: "electric", name: `${name} Electric`, transmission: "automatic", fuel: "electric" }] })) },
  { slug: "jolta", name: "Jolta Electric", countryOfOrigin: "pakistani", popularity: 66, models: ["JE-70D", "JE-70L", "JE-Scooty", "JE-125L"].map((name, i) => ({ slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, popularity: 70 - i, variants: [{ slug: "electric", name: `${name} Electric`, transmission: "automatic", fuel: "electric" }] })) },
];

// ---------------------------------------------------------------------------
// AUTO PARTS CATEGORIES
// ---------------------------------------------------------------------------

export interface PartCategorySeed {
  slug: string;
  name: string;
  popularity: number;
  children?: PartCategorySeed[];
}

export const PART_CATEGORIES: PartCategorySeed[] = [
  {
    slug: "exterior",
    name: "Exterior",
    popularity: 90,
    children: [
      { slug: "alloy-rims", name: "Alloy Rims", popularity: 95 },
      { slug: "tyres", name: "Tyres", popularity: 92 },
      { slug: "body-kits", name: "Body Kits", popularity: 70 },
      { slug: "lights", name: "Lights", popularity: 80 },
      { slug: "mirrors", name: "Mirrors", popularity: 60 },
      { slug: "bumpers", name: "Bumpers", popularity: 65 },
      { slug: "bonnets", name: "Bonnets & Hoods", popularity: 62 },
      { slug: "doors", name: "Doors & Panels", popularity: 62 },
      { slug: "fenders", name: "Fenders", popularity: 58 },
      { slug: "grilles", name: "Grilles", popularity: 58 },
      { slug: "windshields", name: "Windshields & Glass", popularity: 72 },
      { slug: "wipers", name: "Wipers & Washers", popularity: 70 },
      { slug: "spoilers", name: "Spoilers", popularity: 48 },
      { slug: "number-plate-accessories", name: "Number Plate Accessories", popularity: 42 },
    ],
  },
  {
    slug: "interior",
    name: "Interior",
    popularity: 88,
    children: [
      { slug: "seat-covers", name: "Seat Covers", popularity: 85 },
      { slug: "floor-mats", name: "Floor Mats", popularity: 78 },
      { slug: "steering-wheels", name: "Steering Wheels", popularity: 55 },
      { slug: "dash-cams", name: "Dash Cams", popularity: 72 },
      { slug: "dashboard-parts", name: "Dashboard Parts", popularity: 58 },
      { slug: "door-trims", name: "Door Trims & Handles", popularity: 52 },
      { slug: "gear-knobs", name: "Gear Knobs & Boots", popularity: 48 },
      { slug: "interior-mirrors", name: "Interior Mirrors", popularity: 48 },
      { slug: "armrests-consoles", name: "Armrests & Consoles", popularity: 46 },
      { slug: "sunshades", name: "Sunshades & Curtains", popularity: 54 },
    ],
  },
  {
    slug: "audio-video",
    name: "Audio & Video",
    popularity: 84,
    children: [
      { slug: "android-panels", name: "Android Panels", popularity: 90 },
      { slug: "speakers", name: "Speakers", popularity: 74 },
      { slug: "amplifiers", name: "Amplifiers", popularity: 58 },
      { slug: "reverse-cameras", name: "Reverse Cameras", popularity: 76 },
      { slug: "head-units", name: "Head Units & Stereos", popularity: 80 },
      { slug: "subwoofers", name: "Subwoofers", popularity: 62 },
      { slug: "car-antennas", name: "Antennas", popularity: 38 },
      { slug: "parking-sensors", name: "Parking Sensors", popularity: 68 },
      { slug: "trackers-security", name: "Trackers & Security Systems", popularity: 70 },
    ],
  },
  {
    slug: "engine-parts",
    name: "Engine Parts",
    popularity: 86,
    children: [
      { slug: "filters", name: "Filters", popularity: 82 },
      { slug: "spark-plugs", name: "Spark Plugs", popularity: 76 },
      { slug: "belts", name: "Belts", popularity: 62 },
      { slug: "engine-oil", name: "Engine Oil", popularity: 88 },
      { slug: "complete-engines", name: "Complete Engines", popularity: 76 },
      { slug: "engine-blocks-heads", name: "Engine Blocks & Cylinder Heads", popularity: 66 },
      { slug: "pistons-rings", name: "Pistons & Rings", popularity: 60 },
      { slug: "gaskets-seals", name: "Gaskets & Seals", popularity: 74 },
      { slug: "timing-components", name: "Timing Belts, Chains & Tensioners", popularity: 72 },
      { slug: "turbo-supercharger", name: "Turbochargers & Superchargers", popularity: 54 },
      { slug: "mounts", name: "Engine Mounts", popularity: 64 },
      { slug: "air-intake", name: "Air Intake Parts", popularity: 58 },
      { slug: "exhaust", name: "Exhaust Parts", popularity: 62 },
    ],
  },
  {
    slug: "electrical",
    name: "Electrical",
    popularity: 80,
    children: [
      { slug: "batteries", name: "Batteries", popularity: 92 },
      { slug: "alternators", name: "Alternators", popularity: 54 },
      { slug: "wiring", name: "Wiring", popularity: 44 },
      { slug: "starter-motors", name: "Starter Motors", popularity: 62 },
      { slug: "ecus", name: "ECUs & Control Modules", popularity: 54 },
      { slug: "sensors", name: "Sensors", popularity: 68 },
      { slug: "fuses-relays", name: "Fuses & Relays", popularity: 62 },
      { slug: "horns", name: "Horns", popularity: 56 },
      { slug: "ignition-coils", name: "Ignition Coils", popularity: 66 },
    ],
  },
  {
    slug: "suspension-brakes",
    name: "Suspension & Brakes",
    popularity: 78,
    children: [
      { slug: "shock-absorbers", name: "Shock Absorbers", popularity: 70 },
      { slug: "brake-pads", name: "Brake Pads", popularity: 80 },
      { slug: "suspension-kits", name: "Suspension Kits", popularity: 50 },
      { slug: "brake-discs-drums", name: "Brake Discs & Drums", popularity: 76 },
      { slug: "brake-calipers", name: "Brake Calipers", popularity: 62 },
      { slug: "master-cylinders", name: "Master Cylinders", popularity: 58 },
      { slug: "control-arms", name: "Control Arms", popularity: 64 },
      { slug: "ball-joints", name: "Ball Joints & Tie Rod Ends", popularity: 66 },
      { slug: "wheel-bearings", name: "Wheel Bearings & Hubs", popularity: 64 },
      { slug: "steering-racks", name: "Steering Racks & Pumps", popularity: 58 },
    ],
  },
  {
    slug: "bike-parts",
    name: "Bike Parts",
    popularity: 72,
    children: [
      { slug: "bike-engine", name: "Engine & Transmission", popularity: 72 },
      { slug: "bike-brakes", name: "Brakes & Suspension", popularity: 68 },
      { slug: "bike-electrical", name: "Electrical & Lighting", popularity: 64 },
      { slug: "bike-accessories", name: "Body & Accessories", popularity: 70 },
      { slug: "bike-tyres-wheels", name: "Tyres, Tubes & Wheels", popularity: 72 },
      { slug: "bike-chains-sprockets", name: "Chains & Sprockets", popularity: 70 },
      { slug: "bike-exhaust", name: "Exhausts", popularity: 54 },
      { slug: "bike-helmets-gear", name: "Helmets & Riding Gear", popularity: 74 },
      { slug: "ebike-batteries", name: "E-Bike Batteries", popularity: 76 },
      { slug: "ebike-motors", name: "E-Bike Motors & Controllers", popularity: 72 },
      { slug: "ebike-chargers", name: "E-Bike Chargers", popularity: 70 },
    ],
  },
  {
    slug: "tools-garage",
    name: "Tools & Garage",
    popularity: 60,
    children: [
      { slug: "hand-tools", name: "Hand Tools", popularity: 62 },
      { slug: "diagnostics", name: "Diagnostic Tools", popularity: 58 },
      { slug: "workshop-equipment", name: "Workshop Equipment", popularity: 56 },
      { slug: "car-care", name: "Car Care", popularity: 66 },
      { slug: "jacks-lifting", name: "Jacks & Lifting Equipment", popularity: 60 },
      { slug: "air-compressors", name: "Air Compressors", popularity: 56 },
      { slug: "battery-chargers", name: "Battery Chargers & Jump Starters", popularity: 62 },
    ],
  },
  {
    slug: "transmission-drivetrain", name: "Transmission & Drivetrain", popularity: 80,
    children: [
      { slug: "complete-transmissions", name: "Complete Transmissions", popularity: 76 },
      { slug: "clutch-kits", name: "Clutch Kits & Plates", popularity: 78 },
      { slug: "gearbox-parts", name: "Gearbox Parts", popularity: 66 },
      { slug: "cv-joints-axles", name: "CV Joints & Axles", popularity: 70 },
      { slug: "differentials", name: "Differentials", popularity: 54 },
      { slug: "driveshafts", name: "Drive Shafts", popularity: 58 },
      { slug: "transmission-oil", name: "Transmission & Gear Oil", popularity: 68 },
    ],
  },
  {
    slug: "cooling-heating-ac", name: "Cooling, Heating & AC", popularity: 78,
    children: [
      { slug: "radiators", name: "Radiators", popularity: 80 },
      { slug: "water-pumps", name: "Water Pumps", popularity: 70 },
      { slug: "cooling-fans", name: "Cooling Fans", popularity: 72 },
      { slug: "thermostats", name: "Thermostats", popularity: 60 },
      { slug: "ac-compressors", name: "AC Compressors", popularity: 78 },
      { slug: "condensers-evaporators", name: "Condensers & Evaporators", popularity: 66 },
      { slug: "heaters-blowers", name: "Heaters & Blower Motors", popularity: 58 },
      { slug: "coolants", name: "Coolants", popularity: 70 },
    ],
  },
  {
    slug: "fuel-system", name: "Fuel System", popularity: 76,
    children: [
      { slug: "fuel-pumps", name: "Fuel Pumps", popularity: 76 },
      { slug: "fuel-injectors", name: "Fuel Injectors", popularity: 74 },
      { slug: "carburetors", name: "Carburetors", popularity: 60 },
      { slug: "fuel-filters", name: "Fuel Filters", popularity: 72 },
      { slug: "fuel-tanks", name: "Fuel Tanks", popularity: 54 },
      { slug: "cng-lpg-parts", name: "CNG & LPG Parts", popularity: 56 },
    ],
  },
  {
    slug: "tyres-wheels", name: "Tyres & Wheels", popularity: 92,
    children: [
      { slug: "car-tyres", name: "Car Tyres", popularity: 96 },
      { slug: "alloy-wheels", name: "Alloy Wheels", popularity: 94 },
      { slug: "steel-rims", name: "Steel Rims", popularity: 72 },
      { slug: "wheel-covers", name: "Wheel Covers", popularity: 66 },
      { slug: "wheel-nuts-spacers", name: "Wheel Nuts, Spacers & Adapters", popularity: 54 },
      { slug: "puncture-repair", name: "Puncture Repair & Inflators", popularity: 58 },
    ],
  },
  {
    slug: "ev-hybrid-parts", name: "EV & Hybrid Parts", popularity: 74,
    children: [
      { slug: "traction-batteries", name: "Traction Batteries", popularity: 80 },
      { slug: "battery-modules", name: "Battery Modules & Cells", popularity: 76 },
      { slug: "inverters-converters", name: "Inverters & DC Converters", popularity: 70 },
      { slug: "electric-motors", name: "Electric Drive Motors", popularity: 70 },
      { slug: "onboard-chargers", name: "On-board Chargers", popularity: 64 },
      { slug: "charging-cables", name: "Charging Cables & Connectors", popularity: 72 },
      { slug: "bms", name: "Battery Management Systems", popularity: 62 },
      { slug: "hybrid-components", name: "Hybrid System Components", popularity: 68 },
    ],
  },
  {
    slug: "miscellaneous",
    name: "Miscellaneous & Other",
    popularity: 30,
    children: [
      { slug: "other-car-part", name: "Other Car Part (enter exact type)", popularity: 30 },
      { slug: "other-bike-part", name: "Other Bike Part (enter exact type)", popularity: 28 },
      { slug: "universal-accessory", name: "Other Universal Accessory", popularity: 26 },
    ],
  },
];

// ---------------------------------------------------------------------------
// FEATURES
// ---------------------------------------------------------------------------

export interface FeatureSeed {
  slug: string;
  name: string;
  groupName: string;
  isIndexableFacet?: boolean;
}

export const CAR_FEATURES: FeatureSeed[] = [
  // Only `sunroof` is an indexable facet to start — it has genuine standalone
  // search demand ("cars with sunroof in pakistan"). Promote others only when
  // Search Console shows impressions for them.
  { slug: "sunroof", name: "Sun Roof", groupName: "exterior", isIndexableFacet: true },
  { slug: "alloy-rims", name: "Alloy Rims", groupName: "exterior" },
  { slug: "fog-lights", name: "Fog Lights", groupName: "exterior" },
  { slug: "power-mirrors", name: "Power Mirrors", groupName: "exterior" },
  { slug: "rear-spoiler", name: "Rear Spoiler", groupName: "exterior" },
  { slug: "panoramic-roof", name: "Panoramic Roof", groupName: "exterior" },
  { slug: "led-headlights", name: "LED Headlights", groupName: "exterior" },
  { slug: "hid-headlights", name: "HID / Xenon Headlights", groupName: "exterior" },
  { slug: "daytime-running-lights", name: "Daytime Running Lights", groupName: "exterior" },
  { slug: "automatic-headlights", name: "Automatic Headlights", groupName: "exterior" },
  { slug: "rain-sensing-wipers", name: "Rain-sensing Wipers", groupName: "exterior" },
  { slug: "power-folding-mirrors", name: "Power-folding Mirrors", groupName: "exterior" },
  { slug: "heated-mirrors", name: "Heated Mirrors", groupName: "exterior" },
  { slug: "roof-rails", name: "Roof Rails", groupName: "exterior" },

  { slug: "air-conditioning", name: "Air Conditioning", groupName: "comfort" },
  { slug: "climate-control", name: "Climate Control", groupName: "comfort" },
  { slug: "power-steering", name: "Power Steering", groupName: "comfort" },
  { slug: "power-windows", name: "Power Windows", groupName: "comfort" },
  { slug: "cruise-control", name: "Cruise Control", groupName: "comfort", isIndexableFacet: true },
  { slug: "keyless-entry", name: "Keyless Entry", groupName: "comfort" },
  { slug: "push-start", name: "Push Start", groupName: "comfort" },
  { slug: "heated-seats", name: "Heated Seats", groupName: "comfort" },
  { slug: "dual-zone-climate", name: "Dual-zone Climate Control", groupName: "comfort" },
  { slug: "rear-ac-vents", name: "Rear AC Vents", groupName: "comfort" },
  { slug: "rear-ac", name: "Rear Air Conditioning", groupName: "comfort" },
  { slug: "central-locking", name: "Central Locking", groupName: "comfort" },
  { slug: "remote-start", name: "Remote Engine Start", groupName: "comfort" },
  { slug: "power-seats", name: "Power-adjustable Seats", groupName: "comfort" },
  { slug: "memory-seats", name: "Memory Seats", groupName: "comfort" },
  { slug: "ventilated-seats", name: "Ventilated Seats", groupName: "comfort" },
  { slug: "third-row-seats", name: "Third-row Seats", groupName: "comfort" },
  { slug: "electric-parking-brake", name: "Electric Parking Brake", groupName: "comfort" },
  { slug: "auto-brake-hold", name: "Auto Brake Hold", groupName: "comfort" },
  { slug: "hands-free-tailgate", name: "Hands-free Tailgate", groupName: "comfort" },

  { slug: "leather-seats", name: "Leather Seats", groupName: "interior", isIndexableFacet: true },
  { slug: "navigation", name: "Navigation System", groupName: "interior", isIndexableFacet: true },
  { slug: "usb-aux", name: "USB and Auxiliary Cable", groupName: "interior" },
  { slug: "cd-player", name: "CD Player", groupName: "interior" },
  { slug: "cassette-player", name: "Cassette Player", groupName: "interior" },
  { slug: "fabric-seats", name: "Fabric Seats", groupName: "interior" },
  { slug: "wood-trim", name: "Wood Interior Trim", groupName: "interior" },
  { slug: "android-auto", name: "Android Auto", groupName: "technology" },
  { slug: "apple-carplay", name: "Apple CarPlay", groupName: "technology" },
  { slug: "bluetooth", name: "Bluetooth Connectivity", groupName: "technology" },
  { slug: "touchscreen", name: "Touchscreen Infotainment", groupName: "technology" },
  { slug: "digital-cluster", name: "Digital Instrument Cluster", groupName: "technology" },
  { slug: "head-up-display", name: "Head-up Display", groupName: "technology" },
  { slug: "wireless-charging", name: "Wireless Phone Charging", groupName: "technology" },
  { slug: "steering-controls", name: "Steering-wheel Controls", groupName: "technology" },
  { slug: "paddle-shifters", name: "Paddle Shifters", groupName: "technology" },
  { slug: "drive-modes", name: "Multiple Drive Modes", groupName: "technology" },
  { slug: "ambient-lighting", name: "Ambient Lighting", groupName: "technology" },

  { slug: "abs", name: "ABS", groupName: "safety", isIndexableFacet: true },
  { slug: "airbags", name: "Air Bags", groupName: "safety", isIndexableFacet: true },
  { slug: "immobilizer", name: "Immobilizer Key", groupName: "safety" },
  { slug: "rear-camera", name: "Rear Camera", groupName: "safety" },
  { slug: "360-camera", name: "360 Degree Camera", groupName: "safety", isIndexableFacet: true },
  { slug: "traction-control", name: "Traction Control", groupName: "safety" },
  { slug: "ebd", name: "Electronic Brake-force Distribution (EBD)", groupName: "safety" },
  { slug: "brake-assist", name: "Brake Assist", groupName: "safety" },
  { slug: "stability-control", name: "Vehicle Stability Control", groupName: "safety" },
  { slug: "hill-start-assist", name: "Hill-start Assist", groupName: "safety" },
  { slug: "hill-descent-control", name: "Hill-descent Control", groupName: "safety" },
  { slug: "isofix", name: "ISOFIX Child-seat Anchors", groupName: "safety" },
  { slug: "parking-sensors", name: "Parking Sensors", groupName: "safety" },
  { slug: "front-camera", name: "Front Camera", groupName: "safety" },
  { slug: "tpms", name: "Tyre Pressure Monitoring", groupName: "safety" },
  { slug: "blind-spot-monitor", name: "Blind-spot Monitor", groupName: "driver-assistance" },
  { slug: "adaptive-cruise", name: "Adaptive Cruise Control", groupName: "driver-assistance" },
  { slug: "lane-departure-warning", name: "Lane-departure Warning", groupName: "driver-assistance" },
  { slug: "lane-keep-assist", name: "Lane-keep Assist", groupName: "driver-assistance" },
  { slug: "forward-collision-warning", name: "Forward-collision Warning", groupName: "driver-assistance" },
  { slug: "automatic-emergency-braking", name: "Automatic Emergency Braking", groupName: "driver-assistance" },
  { slug: "auto-high-beam", name: "Automatic High Beam", groupName: "driver-assistance" },
  { slug: "driver-attention-warning", name: "Driver-attention Warning", groupName: "driver-assistance" },
  { slug: "manual-steering", name: "Manual Steering", groupName: "classic-equipment" },
  { slug: "manual-windows", name: "Manual Windows", groupName: "classic-equipment" },
  { slug: "carburetor", name: "Carburetor Engine", groupName: "classic-equipment" },
  { slug: "manual-choke", name: "Manual Choke", groupName: "classic-equipment" },
  { slug: "cng-kit", name: "CNG Kit", groupName: "performance" },
  { slug: "turbocharged", name: "Turbocharged", groupName: "performance" },
  { slug: "four-wheel-drive", name: "Four-wheel Drive", groupName: "performance" },
  { slug: "limited-slip-differential", name: "Limited-slip Differential", groupName: "performance" },
  { slug: "regenerative-braking", name: "Regenerative Braking", groupName: "electric-hybrid" },
  { slug: "ev-charge-cable", name: "EV Charging Cable", groupName: "electric-hybrid" },
  { slug: "battery-health-report", name: "Battery Health Report", groupName: "electric-hybrid" },
];

export const BIKE_FEATURES: FeatureSeed[] = [
  { slug: "self-start", name: "Self Start", groupName: "comfort" },
  { slug: "disc-brake", name: "Disc Brake", groupName: "safety" },
  { slug: "alloy-rims", name: "Alloy Rims", groupName: "exterior" },
  { slug: "digital-meter", name: "Digital Meter", groupName: "interior" },
  { slug: "abs", name: "ABS", groupName: "safety" },
  { slug: "combined-braking", name: "Combined Braking System", groupName: "safety" },
  { slug: "traction-control", name: "Traction Control", groupName: "safety" },
  { slug: "tubeless-tyres", name: "Tubeless Tyres", groupName: "safety" },
  { slug: "led-headlight", name: "LED Headlight", groupName: "exterior" },
  { slug: "storage-space", name: "Under-seat Storage", groupName: "comfort" },
  { slug: "reverse-gear", name: "Reverse Gear", groupName: "electric" },
  { slug: "riding-modes", name: "Multiple Riding Modes", groupName: "electric" },
  { slug: "regenerative-braking", name: "Regenerative Braking", groupName: "electric" },
  { slug: "keyless-start", name: "Keyless Start", groupName: "electric" },
  { slug: "mobile-app", name: "Mobile App Connectivity", groupName: "electric" },
  { slug: "usb-charging", name: "USB Charging Port", groupName: "comfort" },
  { slug: "kick-start", name: "Kick Start", groupName: "classic-equipment" },
  { slug: "fuel-gauge", name: "Fuel Gauge", groupName: "instrumentation" },
  { slug: "gear-indicator", name: "Gear-position Indicator", groupName: "instrumentation" },
  { slug: "trip-meter", name: "Trip Meter", groupName: "instrumentation" },
  { slug: "tachometer", name: "Tachometer", groupName: "instrumentation" },
  { slug: "side-stand-cutoff", name: "Side-stand Engine Cut-off", groupName: "safety" },
  { slug: "immobilizer", name: "Immobilizer", groupName: "safety" },
  { slug: "anti-theft-alarm", name: "Anti-theft Alarm", groupName: "safety" },
  { slug: "hazard-lights", name: "Hazard Lights", groupName: "safety" },
  { slug: "crash-guard", name: "Crash Guard", groupName: "safety" },
  { slug: "passenger-footrests", name: "Passenger Footrests", groupName: "comfort" },
  { slug: "backrest", name: "Passenger Backrest", groupName: "comfort" },
  { slug: "windscreen", name: "Windscreen", groupName: "exterior" },
  { slug: "panniers", name: "Panniers / Side Boxes", groupName: "storage" },
  { slug: "top-box", name: "Top Box", groupName: "storage" },
  { slug: "fast-charging", name: "Fast Charging", groupName: "electric" },
  { slug: "battery-swap", name: "Swappable Battery", groupName: "electric" },
  { slug: "cruise-control", name: "Cruise Control", groupName: "electric" },
  { slug: "hill-hold", name: "Hill-hold Assist", groupName: "electric" },
];
