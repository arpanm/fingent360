import type { FeedbackAudio } from '@fingent360/contracts';

export interface NativeBridge {
  takeAngelCallback?(): Promise<{ state: string; authToken: string } | null>;
  takeUpstoxCallback?(): Promise<{ state: string; code: string } | null>;
  takeKiteCallback?(): Promise<{ state: string; requestToken: string } | null>;
  sharePublicLink?(url: string): Promise<{ opened: boolean }>;
  getConfig(): string;
  getBuildInfo?(): string;
  saveFile(filename: string, mime: string, base64: string): void;
  setConnection(mode: string, webUrl: string, apiUrl: string): void;
  captureFeedback?(): Promise<string>;
  feedbackRead?(): Promise<{
    revision: number;
    records: unknown[];
    config: { enabled: boolean; apiOrigin: string };
  }>;
  feedbackWrite?(
    expectedRevision: number,
    state: {
      records: unknown[];
      config: { enabled: boolean; apiOrigin: string };
    },
  ): Promise<{ revision: number }>;
  sendFeedback?(
    apiOrigin: string,
    method: 'POST' | 'GET' | 'DELETE',
    id: string | null,
    receiptToken: string | null,
    body: unknown,
  ): Promise<{ status: number; body: unknown }>;
}
export interface IOSFeedbackBridge extends Pick<
  NativeBridge,
  | 'captureFeedback'
  | 'feedbackRead'
  | 'feedbackWrite'
  | 'sendFeedback'
  | 'takeKiteCallback'
  | 'takeUpstoxCallback'
  | 'takeAngelCallback'
> {
  saveFile?(
    filename: string,
    mime: string,
    base64: string,
  ): Promise<{ completed: boolean }>;
  armBroker?(
    broker: 'kite' | 'upstox' | 'angel',
    state: string,
    apiOrigin: string,
  ): Promise<{ armed: boolean }>;
  clearBroker?(
    broker: 'kite' | 'upstox' | 'angel',
  ): Promise<{ cleared: boolean }>;
  startFeedbackAudio(): Promise<{ recording: boolean }>;
  stopFeedbackAudio(): Promise<FeedbackAudio>;
  cancelFeedbackAudio(): Promise<{ cancelled: boolean }>;
}
declare global {
  interface Window {
    FingentAndroid?: NativeBridge;
    FingentIOS?: IOSFeedbackBridge;
    __fingentHandleBack?: () => boolean;
  }
}
