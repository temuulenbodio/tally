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

export interface GameState {
  id: string;
  type: "number-finder" | "shootout";
  status: "pending" | "active" | "finished";
  challenger: string;
  challenged: string;
  target: number;
  choices: number[];
  startedAt: number | null;
  winner: string | null;
  finishedAt: number | null;
}

export interface DrinkDebt {
  id: string;
  from: string;
  to: string;
  gameId: string;
  createdAt: number;
  settled: boolean;
}

export interface User {
  username: string;
  passwordHash: string;
  createdAt: number;
}

export interface DrinkRecord {
  roomId: string;
  roomName: string;
  drinkName: string;
  price: number;
  timestamp: number;
}

export interface Room {
  id: string;
  name: string;
  createdAt: number;
  drinkTypes: DrinkType[];
  members: { [nickname: string]: RoomMember };
  activeGame: GameState | null;
  debts: DrinkDebt[];
  endedAt: number | null;
}
