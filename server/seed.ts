import { nanoid } from "nanoid";
import type { AdminObject, ObjectInput } from "../shared/types";

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const createQrToken = () => nanoid(28);

const defaultRadius = 25;

export const seedObjectInputs: ObjectInput[] = [
  {
    name: "Fatimid Gold Dinar",
    imageUrl: "/artifacts/fatimid-dinar.svg",
    description: "A coin inspired by Mahdia's role as a Fatimid capital and maritime power.",
    historicalInfo:
      "Mahdia was founded in the early 10th century as a fortified Fatimid capital. Gold dinars symbolized political authority, trade reach, and the city's connection to Mediterranean exchange routes.",
    facts: [
      "The Fatimid dynasty founded Mahdia as a strategic coastal capital.",
      "Coinage helped communicate legitimacy across distant trade networks.",
      "Mahdia's sea walls protected both political power and commerce."
    ],
    category: "fatimid",
    points: 120,
    positionX: 23,
    positionY: 32,
    latitude: 35.50472,
    longitude: 11.0622,
    claimRadiusMeters: defaultRadius
  },
  {
    name: "Skifa el Kahla Gate",
    imageUrl: "/artifacts/skifa-gate.svg",
    description: "A monumental gateway that represents the historic entrance to Mahdia's medina.",
    historicalInfo:
      "Skifa el Kahla is one of Mahdia's most recognizable monuments. The gate reflects the defensive character of the old city and the importance of controlled entrances in medieval urban design.",
    facts: [
      "The gate is associated with Mahdia's fortified peninsula.",
      "Its long vaulted passage helped defend the medina entrance.",
      "Today it remains a strong visual symbol of the city."
    ],
    category: "architecture",
    points: 110,
    positionX: 52,
    positionY: 28,
    latitude: 35.50487,
    longitude: 11.06243,
    claimRadiusMeters: defaultRadius
  },
  {
    name: "Fishing Net",
    imageUrl: "/artifacts/fishing-net.svg",
    description: "A reminder of Mahdia's living fishing traditions and coastal economy.",
    historicalInfo:
      "Fishing has shaped Mahdia's daily life for generations. Nets, boats, and harbor rituals connect the city to the sea, sustaining local families and preserving practical maritime knowledge.",
    facts: [
      "Mahdia is known for an active fishing harbor.",
      "Fishing traditions connect craft, weather knowledge, and community life.",
      "Seafood remains central to local food culture."
    ],
    category: "maritime",
    points: 90,
    positionX: 78,
    positionY: 31,
    latitude: 35.50465,
    longitude: 11.06268,
    claimRadiusMeters: defaultRadius
  },
  {
    name: "Olive Oil Amphora",
    imageUrl: "/artifacts/amphora.svg",
    description: "A vessel representing agriculture, storage, and Mediterranean trade.",
    historicalInfo:
      "Olives and olive oil are central to the Sahel region around Mahdia. Ceramic vessels evoke older systems of storage, transport, and trade across North Africa and the Mediterranean.",
    facts: [
      "Olive groves are a defining landscape of Tunisia's Sahel.",
      "Amphorae were widely used to move goods by sea.",
      "Olive oil connected agriculture to regional commerce."
    ],
    category: "trade",
    points: 100,
    positionX: 31,
    positionY: 62,
    latitude: 35.50442,
    longitude: 11.06206,
    claimRadiusMeters: defaultRadius
  },
  {
    name: "Medina Door Knocker",
    imageUrl: "/artifacts/door-knocker.svg",
    description: "A crafted detail from traditional domestic architecture.",
    historicalInfo:
      "Decorated doors and metal knockers mark the threshold between public streets and private homes. Their forms reveal craft traditions, social customs, and the visual identity of the medina.",
    facts: [
      "Door details often reflect local craft identity.",
      "Thresholds are important social spaces in medina life.",
      "Metalwork combines function with ornament."
    ],
    category: "craft",
    points: 85,
    positionX: 50,
    positionY: 63,
    latitude: 35.50434,
    longitude: 11.06234,
    claimRadiusMeters: defaultRadius
  },
  {
    name: "Ottoman Tile Fragment",
    imageUrl: "/artifacts/ottoman-tile.svg",
    description: "A decorative fragment showing the layered history of Mahdia's built environment.",
    historicalInfo:
      "Mahdia's architecture carries traces from multiple periods. Ceramic tilework reflects changing tastes, craft networks, and the long dialogue between local and wider Mediterranean styles.",
    facts: [
      "Tiles preserve clues about trade, taste, and technique.",
      "Decorative ceramics often traveled through regional craft networks.",
      "Mahdia's heritage is layered across many historical periods."
    ],
    category: "art",
    points: 95,
    positionX: 73,
    positionY: 63,
    latitude: 35.5045,
    longitude: 11.0626,
    claimRadiusMeters: defaultRadius
  },
  {
    name: "Sea Silk Textile",
    imageUrl: "/artifacts/sea-silk.svg",
    description: "A textile inspired by rare coastal craft and the value of marine materials.",
    historicalInfo:
      "Sea silk, associated with fibers from Mediterranean pen shells, is one of the region's rarest craft traditions. The object invites visitors to connect natural materials, patience, and cultural memory.",
    facts: [
      "Sea silk is linked to rare Mediterranean shellfish fibers.",
      "The craft requires delicate cleaning, spinning, and weaving.",
      "It represents a close relationship between sea ecology and heritage."
    ],
    category: "craft",
    points: 130,
    positionX: 86,
    positionY: 53,
    latitude: 35.50477,
    longitude: 11.06282,
    claimRadiusMeters: defaultRadius
  }
];

export const buildSeedObjects = (): AdminObject[] =>
  seedObjectInputs.map((object) => ({
    id: nanoid(12),
    slug: slugify(object.name),
    qrToken: createQrToken(),
    status: "available",
    reservedPlayerId: undefined,
    foundPlayerId: undefined,
    foundAt: undefined,
    ...object,
    imageUrl: object.imageUrl ?? "/mahdia-map.svg"
  }));
