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
      { slug: "cb-125f", name: "CB 125F", popularity: 80 },
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
      { slug: "ybr-125g", name: "YBR 125G", popularity: 84 },
      { slug: "yb-125z", name: "YB 125Z", popularity: 78 },
      { slug: "ybr-125z-dx", name: "YBR 125Z DX", popularity: 70 },
    ],
  },
  {
    slug: "suzuki",
    name: "Suzuki",
    countryOfOrigin: "japanese",
    popularity: 82,
    models: [
      { slug: "gs-150", name: "GS 150", popularity: 84 },
      { slug: "gd-110s", name: "GD 110S", popularity: 80 },
      { slug: "gr-150", name: "GR 150", popularity: 66 },
      { slug: "gsx-125", name: "GSX 125", popularity: 58 },
    ],
  },
  {
    slug: "united",
    name: "United",
    countryOfOrigin: "chinese",
    popularity: 74,
    models: [
      { slug: "us-70", name: "US 70", popularity: 78 },
      { slug: "us-125", name: "US 125", popularity: 70 },
      { slug: "us-150", name: "US 150", popularity: 56 },
    ],
  },
  {
    slug: "road-prince",
    name: "Road Prince",
    countryOfOrigin: "chinese",
    popularity: 66,
    models: [
      { slug: "rp-70", name: "RP 70", popularity: 68 },
      { slug: "rp-110", name: "RP 110", popularity: 58 },
    ],
  },
  {
    slug: "hi-speed",
    name: "Hi Speed",
    countryOfOrigin: "chinese",
    popularity: 60,
    models: [
      { slug: "infinity-150", name: "Infinity 150", popularity: 64 },
      { slug: "sr-70", name: "SR 70", popularity: 54 },
    ],
  },
  {
    slug: "super-power",
    name: "Super Power",
    countryOfOrigin: "chinese",
    popularity: 56,
    models: [
      { slug: "sp-70", name: "SP 70", popularity: 58 },
      { slug: "sp-125", name: "SP 125", popularity: 48 },
    ],
  },
  {
    slug: "unique",
    name: "Unique",
    countryOfOrigin: "chinese",
    popularity: 52,
    models: [
      { slug: "ud-70", name: "UD 70", popularity: 54 },
      { slug: "ud-100", name: "UD 100", popularity: 44 },
    ],
  },
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
    ],
  },
  { slug: "bike-parts", name: "Bike Parts", popularity: 72 },
  { slug: "tools-garage", name: "Tools & Garage", popularity: 60 },
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

  { slug: "air-conditioning", name: "Air Conditioning", groupName: "comfort" },
  { slug: "climate-control", name: "Climate Control", groupName: "comfort" },
  { slug: "power-steering", name: "Power Steering", groupName: "comfort" },
  { slug: "power-windows", name: "Power Windows", groupName: "comfort" },
  { slug: "cruise-control", name: "Cruise Control", groupName: "comfort", isIndexableFacet: true },
  { slug: "keyless-entry", name: "Keyless Entry", groupName: "comfort" },
  { slug: "push-start", name: "Push Start", groupName: "comfort" },
  { slug: "heated-seats", name: "Heated Seats", groupName: "comfort" },

  { slug: "leather-seats", name: "Leather Seats", groupName: "interior", isIndexableFacet: true },
  { slug: "navigation", name: "Navigation System", groupName: "interior", isIndexableFacet: true },
  { slug: "usb-aux", name: "USB and Auxiliary Cable", groupName: "interior" },
  { slug: "cd-player", name: "CD Player", groupName: "interior" },

  { slug: "abs", name: "ABS", groupName: "safety", isIndexableFacet: true },
  { slug: "airbags", name: "Air Bags", groupName: "safety", isIndexableFacet: true },
  { slug: "immobilizer", name: "Immobilizer Key", groupName: "safety" },
  { slug: "rear-camera", name: "Rear Camera", groupName: "safety" },
  { slug: "360-camera", name: "360 Degree Camera", groupName: "safety", isIndexableFacet: true },
  { slug: "traction-control", name: "Traction Control", groupName: "safety" },
];

export const BIKE_FEATURES: FeatureSeed[] = [
  { slug: "self-start", name: "Self Start", groupName: "comfort" },
  { slug: "disc-brake", name: "Disc Brake", groupName: "safety" },
  { slug: "alloy-rims", name: "Alloy Rims", groupName: "exterior" },
  { slug: "digital-meter", name: "Digital Meter", groupName: "interior" },
];
