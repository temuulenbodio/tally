import Pusher from "pusher";

let _pusher: Pusher | null = null;

function getPusher(): Pusher | null {
  if (
    !process.env.PUSHER_APP_ID ||
    !process.env.PUSHER_KEY ||
    !process.env.PUSHER_SECRET ||
    !process.env.PUSHER_CLUSTER
  ) return null;
  if (!_pusher) {
    _pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: true,
    });
  }
  return _pusher;
}

export async function triggerRoomEvent(
  roomId: string,
  event: string,
  data: unknown
): Promise<void> {
  const p = getPusher();
  if (!p) return;
  try {
    await p.trigger(`room-${roomId}`, event, data);
  } catch { /* non-fatal — clients fall back to polling */ }
}
