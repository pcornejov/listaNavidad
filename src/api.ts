import type { MyGift, OtherItem, OwnItem, Person } from "../shared/types";

const KEY = "listaNavidad.me";

export interface Me {
  id: number;
  name: string;
}

export function loadMe(): Me | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

export function saveMe(me: Me | null) {
  try {
    if (me) localStorage.setItem(KEY, JSON.stringify(me));
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: solo dura la pestaña */
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const me = loadMe();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(me ? { "X-Person-Id": String(me.id) } : {}),
      ...init.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Algo salió mal");
  return data as T;
}

export interface ItemInput {
  title: string;
  description: string;
  links: string[];
}

export const api = {
  people: () => req<Person[]>("/people"),
  me: () => req<Me>("/me"),
  logout: () => req("/logout", { method: "POST" }),
  enter: (name: string) => req<Me>("/people", { method: "POST", body: JSON.stringify({ name }) }),
  ownList: (id: number) => req<{ owner: Me; items: OwnItem[] }>(`/people/${id}/items`),
  otherList: (id: number) => req<{ owner: Me; items: OtherItem[] }>(`/people/${id}/items`),
  addItem: (i: ItemInput) => req<OwnItem>("/items", { method: "POST", body: JSON.stringify(i) }),
  addMany: (titles: string[]) =>
    req<{ added: number }>("/items/bulk", { method: "POST", body: JSON.stringify({ titles }) }),
  editItem: (id: number, i: ItemInput) =>
    req<OwnItem>(`/items/${id}`, { method: "PUT", body: JSON.stringify(i) }),
  deleteItem: (id: number) => req(`/items/${id}`, { method: "DELETE" }),
  gift: (id: number) => req(`/items/${id}/gift`, { method: "POST" }),
  ungift: (id: number) => req(`/items/${id}/gift`, { method: "DELETE" }),
  myGifts: () => req<MyGift[]>("/my-gifts"),
};
