import { WahaGroup } from '@/types/waha';

const stripUnderscoreSerialized = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const obj = value as Record<string, unknown>;
  if (typeof obj._serialized === 'string' && obj._serialized) return obj._serialized;
  if (typeof obj.id === 'string' && obj.id) return obj.id;
  if (typeof obj.user === 'string' && obj.user) return obj.user;
  return '';
};

export const extractGroupId = (raw: unknown): string => {
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw !== 'object') return '';
  const obj = raw as Record<string, unknown>;

  // Campos directos (lowercase, formato estandar WAHA)
  if (typeof obj.id === 'string' && obj.id) return obj.id;
  // GOWS y algunos engines usan JID en mayusculas
  if (typeof obj.JID === 'string' && obj.JID) return obj.JID;

  // gid y _serialized
  const gid = obj.gid as Record<string, unknown> | undefined;
  if (gid) {
    const fromGid = stripUnderscoreSerialized(gid);
    if (fromGid) return fromGid;
  }

  // groupMetadata anidado
  const meta = obj.groupMetadata as Record<string, unknown> | undefined;
  if (meta) {
    const fromMeta = stripUnderscoreSerialized(meta);
    if (fromMeta) return fromMeta;
    if (meta.gid) {
      const fromMetaGid = stripUnderscoreSerialized(meta.gid);
      if (fromMetaGid) return fromMetaGid;
    }
  }

  // Otros formatos
  if (typeof obj.jid === 'string' && obj.jid) return obj.jid;
  if (typeof obj._serialized === 'string' && obj._serialized) return obj._serialized;
  return '';
};

const extractStringField = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const obj = value as Record<string, unknown>;
  if (typeof obj.text === 'string') return obj.text.trim();
  if (typeof obj.value === 'string') return obj.value.trim();
  if (typeof obj.name === 'string') return obj.name.trim();
  return '';
};

export const extractGroupSubject = (raw: unknown): string => {
  if (!raw || typeof raw !== 'object') return '';
  const obj = raw as Record<string, unknown>;

  // subject como string u objeto
  const subjectStr = extractStringField(obj.subject);
  if (subjectStr) return subjectStr;
  // GOWS: Name en mayusculas
  const nameStr = extractStringField(obj.name);
  if (nameStr) return nameStr;
  if (typeof obj.displayName === 'string' && obj.displayName.trim()) return obj.displayName.trim();
  if (typeof obj.formattedTitle === 'string' && obj.formattedTitle.trim()) return obj.formattedTitle.trim();
  // GOWS: Topic como description
  const topicStr = extractStringField(obj.Topic);
  if (topicStr) return topicStr;

  // groupMetadata anidado
  const meta = obj.groupMetadata as Record<string, unknown> | undefined;
  if (meta) {
    const metaSubject = extractStringField(meta.subject) || extractStringField(meta.name) || extractStringField(meta.displayName) || extractStringField(meta.Topic);
    if (metaSubject) return metaSubject;
  }

  // _data.chat.subject (formato antiguo)
  const data = obj._data as Record<string, unknown> | undefined;
  if (data) {
    const chat = data.chat as Record<string, unknown> | undefined;
    if (chat) {
      const chatSubject = extractStringField(chat.subject) || extractStringField(chat.name);
      if (chatSubject) return chatSubject;
    }
  }
  return '';
};

const extractGroupDescription = (raw: unknown): string => {
  if (!raw || typeof raw !== 'object') return '';
  const obj = raw as Record<string, unknown>;
  if (typeof obj.description === 'string' && obj.description) return obj.description;
  // GOWS: Topic
  const topicStr = extractStringField(obj.Topic);
  if (topicStr) return topicStr;
  const meta = obj.groupMetadata as Record<string, unknown> | undefined;
  if (meta) {
    if (typeof meta.description === 'string' && meta.description) return meta.description;
    const metaTopic = extractStringField(meta.Topic);
    if (metaTopic) return metaTopic;
  }
  return '';
};

const extractGroupParticipants = (raw: unknown): unknown[] | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  // lowercase (estandar)
  if (Array.isArray(obj.participants)) return obj.participants;
  // GOWS: Participants en mayusculas
  if (Array.isArray(obj.Participants)) return obj.Participants;
  const meta = obj.groupMetadata as Record<string, unknown> | undefined;
  if (meta) {
    if (Array.isArray(meta.participants)) return meta.participants;
    if (Array.isArray(meta.Participants)) return meta.Participants;
  }
  return undefined;
};

export const extractParticipantId = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  const obj = item as Record<string, unknown>;
  if (typeof obj.id === 'string' && obj.id) return obj.id;
  if (typeof obj.JID === 'string' && obj.JID) return obj.JID;
  if (typeof obj.PhoneNumber === 'string' && obj.PhoneNumber) return obj.PhoneNumber;
  if (typeof obj.jid === 'string' && obj.jid) return obj.jid;
  if (typeof obj.phoneNumber === 'string' && obj.phoneNumber) return obj.phoneNumber;
  if (typeof obj.LID === 'string' && obj.LID) return obj.LID;
  return '';
};

export const extractParticipantRole = (item: unknown): string => {
  if (!item || typeof item !== 'object') return '';
  const obj = item as Record<string, unknown>;
  if (typeof obj.role === 'string' && obj.role) return obj.role;
  if (typeof obj.Role === 'string' && obj.Role) return obj.Role;
  if (obj.IsSuperAdmin === true || obj.isSuperAdmin === true) return 'superadmin';
  if (obj.IsAdmin === true || obj.isAdmin === true) return 'admin';
  return 'participant';
};

/**
 * Extrae el numero de telefono real (sin sufijo @c.us, @g.us, @lid)
 * desde cualquier campo disponible en el participante segun motor WAHA.
 * Si no encuentra campo explicito, intenta extraer digitos del JID.
 */
export const extractParticipantPhone = (item: unknown): string => {
  if (!item || typeof item !== 'object') return '';
  const obj = item as Record<string, unknown>;
  const candidates: unknown[] = [
    obj.PhoneNumber, obj.phoneNumber, obj.phone,
    obj.phone_number, obj.Phone, obj.phoneNumberAlt,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  // Fallback: extraer digitos del JID/id si no tiene sufijo
  const idLike = (obj.id ?? obj.JID ?? obj.jid ?? obj.LID) as string | undefined;
  if (typeof idLike === 'string') {
    const digits = idLike.split('@')[0].replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  }
  return '';
};

/**
 * Extrae el pushname (nombre del perfil de WhatsApp).
 * Busca en multiples campos segun motor WAHA (GOWS/WEBJS/WPP/NOWEB).
 */
export const extractParticipantName = (item: unknown): string => {
  if (!item || typeof item !== 'object') return '';
  const obj = item as Record<string, unknown>;
  const candidates: unknown[] = [
    obj.pushName, obj.PushName, obj.pushname,
    obj.name, obj.Name, obj.verifiedName, obj.VerifiedName,
    obj.displayName, obj.DisplayName, obj.notifyName, obj.NotifyName,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
};

export const normalizeWahaGroup = <T extends Record<string, unknown>>(raw: T): T => {
  const id = extractGroupId(raw);
  const subject = extractGroupSubject(raw);
  const description = extractGroupDescription(raw);
  const participants = extractGroupParticipants(raw);
  const result: Record<string, unknown> = { ...raw, id, subject };
  if (description && !raw.description) result.description = description;
  if (participants && !Array.isArray(raw.participants)) result.participants = participants;
  return result as T;
};

export const truncate = (text: string | null | undefined, max: number): string => {
  const value = (text ?? '').trim();
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd() + '…';
};

export const groupDisplayName = (group: Partial<WahaGroup> | null | undefined): string => {
  if (!group) return '';
  const meta = (group as unknown as { groupMetadata?: { subject?: string; name?: string; displayName?: string; Topic?: string } }).groupMetadata;
  const data = (group as unknown as { _data?: { chat?: { subject?: string; name?: string } } })._data;
  return (
    group.subject?.trim() ||
    group.name?.trim() ||
    group.displayName?.trim() ||
    (group as unknown as { formattedTitle?: string }).formattedTitle?.trim() ||
    (group as unknown as { Topic?: string }).Topic?.trim() ||
    meta?.subject?.trim() ||
    meta?.name?.trim() ||
    meta?.displayName?.trim() ||
    meta?.Topic?.trim() ||
    data?.chat?.subject?.trim() ||
    data?.chat?.name?.trim() ||
    group.id ||
    ''
  );
};
