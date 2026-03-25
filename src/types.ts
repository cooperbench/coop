export type PeerStatus = "online" | "offline";

export type SquadMember = {
  id: string;
  user_id: string;
  scope: string; // e.g. "arpan/cooperbench@macbook"
  status: PeerStatus;
  summary: string | null;
  last_seen: string;
  created_at: string;
};

export type Message = {
  id: string;
  from_scope: string;
  to_scope: string; // exact scope or wildcard e.g. "arpan/*"
  body: string;
  thread: string | null;
  read: boolean;
  created_at: string;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    user_metadata: {
      user_name: string; // GitHub username
    };
  };
};

export type ScopeInfo = {
  username: string;
  repo: string;
  machine: string;
  full: string; // "username/repo@machine" or "username/repo#2@machine"
};
