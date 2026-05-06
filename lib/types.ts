export interface DrinkType {
  name: string;
  price: number;
  emoji?: string;
}

export interface RoomMember {
  nickname: string;
  drinks: number;
  totalSpent: number;
  joinedAt: number;
}

export interface Room {
  id: string;
  name: string;
  createdAt: number;
  drinkTypes: DrinkType[];
  members: { [nickname: string]: RoomMember };
}
