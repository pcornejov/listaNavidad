export interface Person {
  id: number;
  name: string;
  total: number;   // artículos en su lista
  gifted: number;  // artículos que alguien ya marcó para regalar
}

/** Artículo visto por su dueño: sin información de regalos. */
export interface OwnItem {
  id: number;
  title: string;
  description: string;
  links: string[];
}

/** Artículo visto por otro familiar. */
export interface OtherItem extends OwnItem {
  gifted: boolean;   // alguien (quien sea) ya lo va a regalar
  byMe: boolean;     // yo lo voy a regalar
}

export interface MyGift {
  itemId: number;
  title: string;
  ownerId: number;
  ownerName: string;
}
