import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";

const file = path.join(process.cwd(), "data", "tickets.json");
const adapter = new JSONFile(file);
const defaultData = { tickets: [] };

let dbInstance = null;

export async function getDB() {
  if (dbInstance) return dbInstance;
  const db = new Low(adapter, defaultData);
  await db.read();
  db.data ||= defaultData;
  dbInstance = db;
  return db;
}

export async function saveTicketServer(ticket) {
  const db = await getDB();
  db.data.tickets.push(ticket);
  await db.write();
  return ticket;
}

export async function getTicketByOrderId(orderId) {
  const db = await getDB();
  return db.data.tickets.find((t) => t.orderId === orderId) || null;
}

export async function findTicketServer(query) {
  const db = await getDB();
  const q = query.trim().toLowerCase();
  return (
    db.data.tickets.find(
      (t) =>
        t.id.toLowerCase() === q ||
        t.email.toLowerCase() === q ||
        t.phone.replace(/\D/g, "").endsWith(q.replace(/\D/g, ""))
    ) || null
  );
}
