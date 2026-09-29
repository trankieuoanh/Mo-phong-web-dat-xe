/**
 * Gui SMS. Moi noi trong app chi goi `getSmsSender().send(...)` — doi tu gia lap
 * sang SMS that la viet them MOT sender o day va dat `SMS_PROVIDER` trong
 * `.env.local`. Khong route hay giao dien nao phai sua.
 *
 * Them nha cung cap that (vd. eSMS.vn, SpeedSMS, Twilio): goi REST API cua ho
 * bang `fetch`, KHONG them SDK (CLAUDE.md quy tac 8).
 */
import 'server-only';

export interface SmsSender {
  /** `true` = khong gui tin that; route duoc phep tra ma ve cho giao dien dev. */
  readonly isMock: boolean;
  send(phone: string, text: string): Promise<void>;
}

/** Khong gui gi ca — in ra console cua `npm run dev`. Test duoc bang so that. */
const mockSender: SmsSender = {
  isMock: true,
  async send(phone, text) {
    console.log(`[sms:mock] -> ${phone}: ${text}`);
  },
};

export function getSmsSender(): SmsSender {
  const provider = process.env.SMS_PROVIDER ?? 'mock';
  switch (provider) {
    case 'mock':
      return mockSender;
    // case 'esms': return esmsSender;
    default:
      throw new Error(`SMS_PROVIDER khong hop le: "${provider}". Gia tri ho tro: mock`);
  }
}
