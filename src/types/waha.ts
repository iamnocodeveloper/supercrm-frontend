export interface WahaConnectionSummary {
  id: string;
  name: string;
  phone_number: string;
  status: string;
  connection_subtype?: string | null;
}

export interface WahaParticipant {
  id: string;
  role?: 'ADMIN' | 'SUPERADMIN' | 'PARTICIPANT' | 'left' | 'admin' | 'superadmin' | 'participant' | string;
  isAdmin?: boolean;
  // GOWS
  PhoneNumber?: string | null;
  JID?: string | null;
  LID?: string | null;
  IsAdmin?: boolean;
  IsSuperAdmin?: boolean;
  // WEBJS / WPP / NOWEB
  phoneNumber?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  Phone?: string | null;
  pushName?: string | null;
  PushName?: string | null;
  pushname?: string | null;
  name?: string | null;
  Name?: string | null;
  verifiedName?: string | null;
  VerifiedName?: string | null;
  displayName?: string | null;
  notifyName?: string | null;
}

export interface WahaGroup {
  id: string;
  subject: string;
  name?: string;
  displayName?: string;
  formattedTitle?: string;
  description?: string;
  picture?: string | null;
  invite?: string;
  participants?: WahaParticipant[];
  membersCanAddNewMember?: boolean;
  membersCanSendMessages?: boolean;
  newMembersApprovalRequired?: boolean;
  groupMetadata?: { subject?: string; name?: string; displayName?: string; participants?: WahaParticipant[] };
  connectionId: string;
  session: string;
}

export type WahaGroupAction = 'list' | 'get' | 'create' | 'refresh' | 'count' | 'join' |
  'inviteCode' | 'inviteCode.revoke' |
  'subject' | 'description' | 'picture' | 'picture.delete' |
  'participants.get' | 'participants.add' | 'participants.addAdmin' | 'participants.remove' |
  'participants.promote' | 'participants.demote' |
  'settings.infoAdminOnly' | 'settings.messagesAdminOnly' |
  'leave' | 'delete';

export interface WahaGroupRequest {
  action: WahaGroupAction;
  connectionId?: string;
  groupId?: string;
  name?: string;
  description?: string;
  pictureUrl?: string;
  participants?: string[];
  code?: string;
  limit?: number;
  offset?: number;
  excludeParticipants?: boolean;
  adminsOnly?: boolean;
}

export interface WhatsAppStatusPayload {
  connectionIds: string[];
  type: 'text' | 'image' | 'video' | 'delete';
  contacts?: string[];
  text?: string;
  caption?: string;
  fileUrl?: string;
  fileMimetype?: string;
  backgroundColor?: string;
  font?: number;
  queue?: boolean;
  statusId?: string;
}

export interface WahaStatusResult {
  connectionId: string;
  session: string;
  success: boolean;
  error?: string;
}

export interface WahaStatusQueueResult {
  success: boolean;
  queued?: boolean;
  jobId?: string;
  results?: WahaStatusResult[];
  partial?: boolean;
}
