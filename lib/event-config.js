export const EVENT_CONFIG = {
  name: "FRESHO Mania 3.0",
  organizer: "Black Fox Entertainment Ent.",
  date: "2026-08-08T18:00:00+05:30",
  dateLabel: "8 August 2026",
  timeLabel: "6:00 PM onwards",
  venue: "Tantrumss The Luxury Club & Kitchen",
  venueMapsUrl:
    "https://www.google.com/maps/place/Tantrumss+The+Luxury+Club+%26+Kitchen/@18.5912297,73.747724,786m/data=!3m2!1e3!4b1!4m6!3m5!1s0x3bc2bbd1b54f6c49:0x8e3f199a31e129be!8m2!3d18.5912297!4d73.747724!16s%2Fg%2F11xdfs8v1t?hl=en&entry=ttu&g_ep=EgoyMDI2MDcyMC4wIKXMDSoASAFQAw%3D%3D",
  email: "symbi0657@gmail.com",
  address: "Lavale, Pune, Maharashtra – 412115",
  whatsapp: "919687062705",
  call: "919925253545",
  tagline: "PARTY  •  ALL FANDOM",
};

// How long a buyer has to complete payment before the order expires and its
// reserved seats go back into the pool. Also sent to Cashfree as the order
// expiry, so their hosted page stops accepting payment at the same moment.
export const ORDER_HOLD_MINUTES = 30;

export const MAX_QTY_PER_ORDER = 10;

// `left` used to be a hardcoded decoration. It's now derived from capacity
// minus what's actually reserved in Redis, so the number on the page is real.
export const PASS_TIERS = [
  {
    id: "male",
    name: "Male Pass",
    price: 500,
    entries: 1,
    capacity: 300,
    perks: ["1 Entry", "DJ Night Access", "All Fandom Party"],
  },
  {
    id: "female",
    name: "Female Pass",
    price: 400,
    entries: 1,
    capacity: 300,
    perks: ["1 Entry", "DJ Night Access", "All Fandom Party"],
  },
  {
    id: "couple",
    name: "Couple Pass",
    price: 700,
    entries: 2,
    capacity: 100,
    perks: ["2 Entries", "DJ Night Access", "Priority Entry Lane"],
    badge: "BEST VALUE",
  },
];

export function getTier(passId) {
  return PASS_TIERS.find((t) => t.id === passId) || null;
}

export const TICKET_STATUS = {
  PENDING: "pending", // order created, no Cashfree checkout opened yet
  SUBMITTED: "submitted", // handed off to Cashfree, payment in flight
  PAID: "paid", // Cashfree confirmed — the only status that admits at the gate
  REJECTED: "rejected", // legacy; nothing sets this since the gateway migration
  EXPIRED: "expired", // hold lapsed with no payment; seats returned to the pool
};
