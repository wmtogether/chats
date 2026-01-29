// Source/Library/utils/api.ts
import type { ChatType, ChatMetadata, NullString, NullInt64 } from '../types';

/**
 * Safely extracts the string value from a NullString type.
 * Returns an empty string if the NullString is invalid.
 */
export function getNullStringValue(ns: NullString | undefined): string {
  if (ns && ns.Valid) {
    return ns.String;
  }
  return '';
}

/**
 * Safely extracts the number value from a NullInt64 type.
 * Returns 0 if the NullInt64 is invalid.
 */
export function getNullInt64Value(ni: NullInt64 | undefined): number {
  if (ni && ni.Valid) {
    return ni.Int64;
  }
  return 0;
}

/**
 * Parses the metadata JSON string from a ChatType object.
 * Returns the parsed ChatMetadata object, or undefined if parsing fails.
 */
export function parseChatMetadata(chat: ChatType): ChatMetadata | undefined {
  if (!chat.metadata) {
    return undefined;
  }
  try {
    // The metadata string appears to be raw JSON, not base64 encoded.
    // If it were base64, we would use JSON.parse(atob(chat.metadata)).
    // Based on the provided example: "metadata":"eyJxdWV1ZUlkIjogMzk3LCA..." it IS base64 encoded.
    const decodedMetadata = atob(chat.metadata);
    const parsed = JSON.parse(decodedMetadata);
    return parsed as ChatMetadata;
  } catch (e) {
    console.error('Error parsing chat metadata:', e);
    return undefined;
  }
}

/**
 * Pre-processes a chat object to parse its metadata.
 */
export function preprocessChat(chat: ChatType): ChatType {
    const processedChat = { ...chat };
    processedChat.parsedMetadata = parseChatMetadata(chat);
    return processedChat;
}
