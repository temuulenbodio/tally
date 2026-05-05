export interface RoomMember {
  nickname: string;
  drinks: number;
  joinedAt: number;
}

export interface Room {
  id: string;
  name: string;
  createdAt: number;
  members: { [nickname: string]: RoomMember };
}
