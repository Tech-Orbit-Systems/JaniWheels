/**
 * Pakistan geography seed.
 *
 * `popularity` drives ordering in city pickers. `isMajor` decides which
 * cities get statically generated, indexable landing pages — the long tail
 * stays reachable and crawlable but is not pre-rendered, otherwise build
 * time and crawl budget both blow up for pages with four listings on them.
 */

export interface ProvinceSeed {
  slug: string;
  name: string;
  isIndexable: boolean;
}

export interface CitySeed {
  slug: string;
  name: string;
  province: string;
  lat?: number;
  lng?: number;
  popularity: number;
  isMajor: boolean;
}

export const PROVINCES: ProvinceSeed[] = [
  { slug: "punjab", name: "Punjab", isIndexable: true },
  { slug: "sindh", name: "Sindh", isIndexable: true },
  { slug: "kpk", name: "Khyber Pakhtunkhwa", isIndexable: true },
  { slug: "balochistan", name: "Balochistan", isIndexable: true },
  { slug: "islamabad", name: "Islamabad Capital Territory", isIndexable: true },
  { slug: "azad-kashmir", name: "Azad Kashmir", isIndexable: true },
  { slug: "gilgit-baltistan", name: "Gilgit-Baltistan", isIndexable: false },
];

export const CITIES: CitySeed[] = [
  // --- tier 1: the cities that will carry most of your supply -------------
  { slug: "karachi", name: "Karachi", province: "sindh", lat: 24.8607, lng: 67.0011, popularity: 100, isMajor: true },
  { slug: "lahore", name: "Lahore", province: "punjab", lat: 31.5204, lng: 74.3587, popularity: 99, isMajor: true },
  { slug: "islamabad", name: "Islamabad", province: "islamabad", lat: 33.6844, lng: 73.0479, popularity: 98, isMajor: true },
  { slug: "rawalpindi", name: "Rawalpindi", province: "punjab", lat: 33.5651, lng: 73.0169, popularity: 95, isMajor: true },

  // --- tier 2 ------------------------------------------------------------
  { slug: "faisalabad", name: "Faisalabad", province: "punjab", lat: 31.4187, lng: 73.0791, popularity: 88, isMajor: true },
  { slug: "multan", name: "Multan", province: "punjab", lat: 30.1575, lng: 71.5249, popularity: 86, isMajor: true },
  { slug: "peshawar", name: "Peshawar", province: "kpk", lat: 34.0151, lng: 71.5249, popularity: 85, isMajor: true },
  { slug: "gujranwala", name: "Gujranwala", province: "punjab", lat: 32.1877, lng: 74.1945, popularity: 82, isMajor: true },
  { slug: "sialkot", name: "Sialkot", province: "punjab", lat: 32.4945, lng: 74.5229, popularity: 80, isMajor: true },
  { slug: "hyderabad", name: "Hyderabad", province: "sindh", lat: 25.396, lng: 68.3578, popularity: 78, isMajor: true },
  { slug: "quetta", name: "Quetta", province: "balochistan", lat: 30.1798, lng: 66.975, popularity: 75, isMajor: true },
  { slug: "sargodha", name: "Sargodha", province: "punjab", lat: 32.0836, lng: 72.6711, popularity: 72, isMajor: true },
  { slug: "bahawalpur", name: "Bahawalpur", province: "punjab", lat: 29.3956, lng: 71.6836, popularity: 70, isMajor: true },
  { slug: "abbottabad", name: "Abbottabad", province: "kpk", lat: 34.1688, lng: 73.2215, popularity: 68, isMajor: true },
  { slug: "gujrat", name: "Gujrat", province: "punjab", lat: 32.5731, lng: 74.0789, popularity: 66, isMajor: true },
  { slug: "sukkur", name: "Sukkur", province: "sindh", lat: 27.7052, lng: 68.8574, popularity: 64, isMajor: true },
  { slug: "mardan", name: "Mardan", province: "kpk", lat: 34.198, lng: 72.0447, popularity: 62, isMajor: true },
  { slug: "sahiwal", name: "Sahiwal", province: "punjab", lat: 30.6682, lng: 73.1114, popularity: 60, isMajor: true },
  { slug: "wah-cantt", name: "Wah Cantt", province: "punjab", lat: 33.7715, lng: 72.7495, popularity: 58, isMajor: true },
  { slug: "rahim-yar-khan", name: "Rahim Yar Khan", province: "punjab", lat: 28.4202, lng: 70.2952, popularity: 56, isMajor: true },
  { slug: "jhelum", name: "Jhelum", province: "punjab", lat: 32.9425, lng: 73.7257, popularity: 54, isMajor: true },
  { slug: "okara", name: "Okara", province: "punjab", lat: 30.8138, lng: 73.4534, popularity: 52, isMajor: true },
  { slug: "mirpur", name: "Mirpur", province: "azad-kashmir", lat: 33.1478, lng: 73.7519, popularity: 50, isMajor: true },

  // --- tier 3: crawlable, not pre-rendered --------------------------------
  { slug: "sheikhupura", name: "Sheikhupura", province: "punjab", popularity: 45, isMajor: false },
  { slug: "kasur", name: "Kasur", province: "punjab", popularity: 44, isMajor: false },
  { slug: "chakwal", name: "Chakwal", province: "punjab", popularity: 43, isMajor: false },
  { slug: "attock", name: "Attock", province: "punjab", popularity: 42, isMajor: false },
  { slug: "nowshera", name: "Nowshera", province: "kpk", popularity: 41, isMajor: false },
  { slug: "kohat", name: "Kohat", province: "kpk", popularity: 40, isMajor: false },
  { slug: "swat", name: "Swat", province: "kpk", popularity: 39, isMajor: false },
  { slug: "larkana", name: "Larkana", province: "sindh", popularity: 38, isMajor: false },
  { slug: "nawabshah", name: "Nawabshah", province: "sindh", popularity: 37, isMajor: false },
  { slug: "jhang", name: "Jhang", province: "punjab", popularity: 36, isMajor: false },
  { slug: "chiniot", name: "Chiniot", province: "punjab", popularity: 35, isMajor: false },
  { slug: "khanewal", name: "Khanewal", province: "punjab", popularity: 34, isMajor: false },
  { slug: "vehari", name: "Vehari", province: "punjab", popularity: 33, isMajor: false },
  { slug: "dera-ghazi-khan", name: "Dera Ghazi Khan", province: "punjab", popularity: 32, isMajor: false },
  { slug: "mianwali", name: "Mianwali", province: "punjab", popularity: 31, isMajor: false },
  { slug: "hafizabad", name: "Hafizabad", province: "punjab", popularity: 30, isMajor: false },
  { slug: "mandi-bahauddin", name: "Mandi Bahauddin", province: "punjab", popularity: 29, isMajor: false },
  { slug: "narowal", name: "Narowal", province: "punjab", popularity: 28, isMajor: false },
  { slug: "toba-tek-singh", name: "Toba Tek Singh", province: "punjab", popularity: 27, isMajor: false },
  { slug: "muzaffargarh", name: "Muzaffargarh", province: "punjab", popularity: 26, isMajor: false },
  { slug: "lodhran", name: "Lodhran", province: "punjab", popularity: 25, isMajor: false },
  { slug: "bahawalnagar", name: "Bahawalnagar", province: "punjab", popularity: 24, isMajor: false },
  { slug: "pakpattan", name: "Pakpattan", province: "punjab", popularity: 23, isMajor: false },
  { slug: "khushab", name: "Khushab", province: "punjab", popularity: 22, isMajor: false },
  { slug: "layyah", name: "Layyah", province: "punjab", popularity: 21, isMajor: false },
  { slug: "gwadar", name: "Gwadar", province: "balochistan", popularity: 20, isMajor: false },
  { slug: "turbat", name: "Turbat", province: "balochistan", popularity: 19, isMajor: false },
  { slug: "muzaffarabad", name: "Muzaffarabad", province: "azad-kashmir", popularity: 18, isMajor: false },
  { slug: "gilgit", name: "Gilgit", province: "gilgit-baltistan", popularity: 17, isMajor: false },
  { slug: "skardu", name: "Skardu", province: "gilgit-baltistan", popularity: 16, isMajor: false },
  { slug: "dera-ismail-khan", name: "Dera Ismail Khan", province: "kpk", popularity: 15, isMajor: false },
  { slug: "bannu", name: "Bannu", province: "kpk", popularity: 14, isMajor: false },
  { slug: "haripur", name: "Haripur", province: "kpk", popularity: 13, isMajor: false },
  { slug: "mansehra", name: "Mansehra", province: "kpk", popularity: 12, isMajor: false },
  { slug: "jacobabad", name: "Jacobabad", province: "sindh", popularity: 11, isMajor: false },
  { slug: "mirpur-khas", name: "Mirpur Khas", province: "sindh", popularity: 10, isMajor: false },
  // --- broader district and market-town coverage -------------------------
  { slug: "nankana-sahib", name: "Nankana Sahib", province: "punjab", popularity: 20, isMajor: false },
  { slug: "muridke", name: "Muridke", province: "punjab", popularity: 20, isMajor: false },
  { slug: "kamoke", name: "Kamoke", province: "punjab", popularity: 20, isMajor: false },
  { slug: "wazirabad", name: "Wazirabad", province: "punjab", popularity: 20, isMajor: false },
  { slug: "daska", name: "Daska", province: "punjab", popularity: 19, isMajor: false },
  { slug: "sambrial", name: "Sambrial", province: "punjab", popularity: 18, isMajor: false },
  { slug: "kharian", name: "Kharian", province: "punjab", popularity: 20, isMajor: false },
  { slug: "lalamusa", name: "Lalamusa", province: "punjab", popularity: 18, isMajor: false },
  { slug: "taxila", name: "Taxila", province: "punjab", popularity: 22, isMajor: false },
  { slug: "hasan-abdal", name: "Hasan Abdal", province: "punjab", popularity: 17, isMajor: false },
  { slug: "talagang", name: "Talagang", province: "punjab", popularity: 17, isMajor: false },
  { slug: "bhalwal", name: "Bhalwal", province: "punjab", popularity: 17, isMajor: false },
  { slug: "bhakkar", name: "Bhakkar", province: "punjab", popularity: 20, isMajor: false },
  { slug: "jauharabad", name: "Jauharabad", province: "punjab", popularity: 18, isMajor: false },
  { slug: "kamalia", name: "Kamalia", province: "punjab", popularity: 17, isMajor: false },
  { slug: "gojra", name: "Gojra", province: "punjab", popularity: 18, isMajor: false },
  { slug: "samundri", name: "Samundri", province: "punjab", popularity: 17, isMajor: false },
  { slug: "jaranwala", name: "Jaranwala", province: "punjab", popularity: 19, isMajor: false },
  { slug: "shorkot", name: "Shorkot", province: "punjab", popularity: 16, isMajor: false },
  { slug: "kabirwala", name: "Kabirwala", province: "punjab", popularity: 16, isMajor: false },
  { slug: "mailsi", name: "Mailsi", province: "punjab", popularity: 16, isMajor: false },
  { slug: "burewala", name: "Burewala", province: "punjab", popularity: 19, isMajor: false },
  { slug: "arifwala", name: "Arifwala", province: "punjab", popularity: 16, isMajor: false },
  { slug: "chichawatni", name: "Chichawatni", province: "punjab", popularity: 17, isMajor: false },
  { slug: "haroonabad", name: "Haroonabad", province: "punjab", popularity: 15, isMajor: false },
  { slug: "hasilpur", name: "Hasilpur", province: "punjab", popularity: 15, isMajor: false },
  { slug: "ahmadpur-east", name: "Ahmadpur East", province: "punjab", popularity: 15, isMajor: false },
  { slug: "khanpur", name: "Khanpur", province: "punjab", popularity: 17, isMajor: false },
  { slug: "kot-addu", name: "Kot Addu", province: "punjab", popularity: 17, isMajor: false },
  { slug: "rajanpur", name: "Rajanpur", province: "punjab", popularity: 17, isMajor: false },
  { slug: "taunsa", name: "Taunsa", province: "punjab", popularity: 15, isMajor: false },

  { slug: "jamshoro", name: "Jamshoro", province: "sindh", popularity: 20, isMajor: false },
  { slug: "kotri", name: "Kotri", province: "sindh", popularity: 19, isMajor: false },
  { slug: "thatta", name: "Thatta", province: "sindh", popularity: 18, isMajor: false },
  { slug: "badin", name: "Badin", province: "sindh", popularity: 18, isMajor: false },
  { slug: "tando-allahyar", name: "Tando Allahyar", province: "sindh", popularity: 17, isMajor: false },
  { slug: "tando-muhammad-khan", name: "Tando Muhammad Khan", province: "sindh", popularity: 16, isMajor: false },
  { slug: "matiari", name: "Matiari", province: "sindh", popularity: 16, isMajor: false },
  { slug: "sanghar", name: "Sanghar", province: "sindh", popularity: 18, isMajor: false },
  { slug: "umerkot", name: "Umerkot", province: "sindh", popularity: 17, isMajor: false },
  { slug: "mithi", name: "Mithi", province: "sindh", popularity: 16, isMajor: false },
  { slug: "dadu", name: "Dadu", province: "sindh", popularity: 18, isMajor: false },
  { slug: "sehwan", name: "Sehwan", province: "sindh", popularity: 16, isMajor: false },
  { slug: "khairpur", name: "Khairpur", province: "sindh", popularity: 19, isMajor: false },
  { slug: "shikarpur", name: "Shikarpur", province: "sindh", popularity: 18, isMajor: false },
  { slug: "kandhkot", name: "Kandhkot", province: "sindh", popularity: 16, isMajor: false },
  { slug: "ghotki", name: "Ghotki", province: "sindh", popularity: 18, isMajor: false },
  { slug: "rohri", name: "Rohri", province: "sindh", popularity: 17, isMajor: false },

  { slug: "charsadda", name: "Charsadda", province: "kpk", popularity: 22, isMajor: false },
  { slug: "swabi", name: "Swabi", province: "kpk", popularity: 21, isMajor: false },
  { slug: "mingora", name: "Mingora", province: "kpk", popularity: 23, isMajor: false },
  { slug: "chitral", name: "Chitral", province: "kpk", popularity: 18, isMajor: false },
  { slug: "batkhela", name: "Batkhela", province: "kpk", popularity: 16, isMajor: false },
  { slug: "dir", name: "Dir", province: "kpk", popularity: 15, isMajor: false },
  { slug: "timergara", name: "Timergara", province: "kpk", popularity: 16, isMajor: false },
  { slug: "tank", name: "Tank", province: "kpk", popularity: 15, isMajor: false },
  { slug: "lakki-marwat", name: "Lakki Marwat", province: "kpk", popularity: 16, isMajor: false },
  { slug: "hangu", name: "Hangu", province: "kpk", popularity: 15, isMajor: false },
  { slug: "karak", name: "Karak", province: "kpk", popularity: 15, isMajor: false },
  { slug: "parachinar", name: "Parachinar", province: "kpk", popularity: 15, isMajor: false },

  { slug: "hub", name: "Hub", province: "balochistan", popularity: 21, isMajor: false },
  { slug: "chaman", name: "Chaman", province: "balochistan", popularity: 19, isMajor: false },
  { slug: "khuzdar", name: "Khuzdar", province: "balochistan", popularity: 19, isMajor: false },
  { slug: "sibi", name: "Sibi", province: "balochistan", popularity: 17, isMajor: false },
  { slug: "zhob", name: "Zhob", province: "balochistan", popularity: 17, isMajor: false },
  { slug: "loralai", name: "Loralai", province: "balochistan", popularity: 16, isMajor: false },
  { slug: "dera-murad-jamali", name: "Dera Murad Jamali", province: "balochistan", popularity: 17, isMajor: false },
  { slug: "ustad-muhammad", name: "Usta Muhammad", province: "balochistan", popularity: 15, isMajor: false },
  { slug: "nushki", name: "Nushki", province: "balochistan", popularity: 15, isMajor: false },
  { slug: "panjgur", name: "Panjgur", province: "balochistan", popularity: 15, isMajor: false },

  { slug: "kotli", name: "Kotli", province: "azad-kashmir", popularity: 18, isMajor: false },
  { slug: "bagh", name: "Bagh", province: "azad-kashmir", popularity: 17, isMajor: false },
  { slug: "rawalakot", name: "Rawalakot", province: "azad-kashmir", popularity: 18, isMajor: false },
  { slug: "bhimber", name: "Bhimber", province: "azad-kashmir", popularity: 16, isMajor: false },
  { slug: "pallandri", name: "Pallandri", province: "azad-kashmir", popularity: 15, isMajor: false },
  { slug: "hunza", name: "Hunza", province: "gilgit-baltistan", popularity: 18, isMajor: false },
  { slug: "chilas", name: "Chilas", province: "gilgit-baltistan", popularity: 15, isMajor: false },
  { slug: "ghizer", name: "Ghizer", province: "gilgit-baltistan", popularity: 15, isMajor: false },
];

/** Areas for the two biggest cities — enough to make the picker feel real. */
export const AREAS: Record<string, string[]> = {
  karachi: [
    "DHA Defence", "Clifton", "Gulshan-e-Iqbal", "North Nazimabad", "Gulistan-e-Jauhar",
    "PECHS", "Bahadurabad", "Malir", "Korangi", "Nazimabad", "Federal B Area",
    "Scheme 33", "Bahria Town Karachi", "KDA Scheme 1", "Saddar",
  ],
  lahore: [
    "DHA Lahore", "Model Town", "Gulberg", "Johar Town", "Bahria Town Lahore",
    "Wapda Town", "Faisal Town", "Iqbal Town", "Cantt", "Askari", "Valencia",
    "Garden Town", "Township", "Sabzazar", "Shadman",
  ],
  islamabad: [
    "F-6", "F-7", "F-8", "F-10", "F-11", "E-11", "G-9", "G-10", "G-11", "G-13",
    "I-8", "DHA Islamabad", "Bahria Town Islamabad", "Gulberg Islamabad",
  ],
  rawalpindi: [
    "Saddar", "Bahria Town Rawalpindi", "Chaklala Scheme 3", "Satellite Town",
    "Peshawar Road", "Adiala Road", "Gulraiz", "Westridge",
  ],
  faisalabad: ["D Ground", "Peoples Colony", "Madina Town", "Canal Road", "Susan Road", "Gulberg", "Jinnah Colony", "Samanabad", "Satiana Road", "Wapda City"],
  multan: ["Cantt", "Bosan Road", "Gulgasht Colony", "Shah Rukn-e-Alam", "Mumtazabad", "Wapda Town", "Vehari Road", "New Multan", "DHA Multan"],
  peshawar: ["Hayatabad", "University Town", "Cantt", "Saddar", "Ring Road", "Gulbahar", "Warsak Road", "DHA Peshawar", "Regi Model Town"],
  gujranwala: ["DC Colony", "Wapda Town", "Citi Housing", "Model Town", "Satellite Town", "Cantt", "Peoples Colony", "Garden Town"],
  sialkot: ["Cantt", "Model Town", "Citi Housing", "Paris Road", "Kashmir Road", "Defence Road", "Ugoki Road"],
  hyderabad: ["Latifabad", "Qasimabad", "Saddar", "Auto Bhan Road", "Citizen Colony", "Hirabad", "Kohsar"],
  quetta: ["Cantt", "Jinnah Town", "Satellite Town", "Samungli Road", "Brewery Road", "Sariab Road", "Shahbaz Town"],
  sargodha: ["Satellite Town", "University Road", "Cantt", "New Satellite Town", "Queens Road", "Khayaban-e-Sadiq"],
  bahawalpur: ["Model Town A", "Model Town B", "Satellite Town", "Cantt", "Yazman Road", "Jhangi Wala Road", "DHA Bahawalpur"],
  gujrat: ["Model Town", "Bhimber Road", "Jail Road", "Satellite Town", "Shadman Colony", "Cantt"],
  sukkur: ["Military Road", "Queens Road", "Barrage Road", "New Sukkur City", "Sindhi Cooperative Housing Society", "Airport Road"],
  abbottabad: ["Jinnahabad", "Supply", "Mandian", "Cantt", "Kakul Road", "Bilal Town", "Jhangi"],
  mardan: ["Sheikh Maltoon Town", "Cantt", "Baghdada", "Charsadda Road", "Bank Road", "Nowshera Road"],
  sahiwal: ["Farid Town", "High Street", "Canal Colony", "Jinnah Town", "College Road", "Pakpattan Road"],
  mirpur: ["New Mirpur City", "Sector F-1", "Sector F-2", "Sector F-3", "D-4", "Chakswari", "Mangla Hamlet"],
  muzaffarabad: ["Upper Chattar", "Lower Chattar", "Ambore", "Jalalabad", "Chehla Bandi", "Satellite Town"],
  gilgit: ["Jutial", "Danyore", "Kashrote", "Khomer", "Nomal Road", "Konodas"],
  skardu: ["New Ranga", "Hussainabad", "Gamba Skardu", "Satpara Road", "Airport Road", "Shigari Kalan"],
};
