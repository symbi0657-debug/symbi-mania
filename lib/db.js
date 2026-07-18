import { Redis } from "@upstash/redis";

const kv = Redis.fromEnv();
const ALL_IDS_KEY = "tickets:all-ids";

export async function saveTicketServer(ticket) {
  await kv.set(`ticket:${ticket.id}`, ticket);
  await kv.set(`order:${ticket.orderId}`, ticket.id);
  await kv.sadd(ALL_IDS_KEY, ticket.id);
  return ticket;
}

export async function getTicketByOrderId(orderId) {
  const id = await kv.get(`order:${orderId}`);
  if (!id) return null;
  return (await kv.get(`ticket:${id}`)) || null;
}

export async function getTicketById(id) {
  return (await kv.get(`ticket:${id}`)) || null;
}

export async function findTicketServer(query) {
  const q = query.trim().toLowerCase();
  const ids = await kv.smembers(ALL_IDS_KEY);
  for (const id of ids) {
    const t = await kv.get(`ticket:${id}`);
    if (!t) continue;
    if (
      t.id.toLowerCase() === q ||
      t.email.toLowerCase() === q ||
      t.phone.replace(/\D/g, "").endsWith(q.replace(/\D/g, ""))
    ) {
      return t;
    }
  }
  return null;
}
