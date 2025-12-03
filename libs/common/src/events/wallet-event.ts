import { EventType } from '../enums/event-type.enum';

export interface WalletEventPayload {
  walletId?: string | null;
  transferId?: string | null;
  amount?: number;
  fromWalletId?: string;
  toWalletId?: string;
  newBalance?: number;
  requestId?: string;
  [key: string]: any;
}

export interface WalletEventMessage {
  id: string;
  type: EventType;
  occurredAt: string;
  payload: WalletEventPayload;
}
