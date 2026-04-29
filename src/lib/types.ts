export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export type LocationRow = {
  user_id: string;
  latitude: number;
  longitude: number;
  room_key: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: string;
  room_key: string;
  user_id: string;
  body: string;
  created_at: string;
};
