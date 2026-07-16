import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

// Minimal, dependency-free Discord IPC client.
// Talks to the local Discord desktop client over its named pipe / unix socket
// using the documented RPC frame format:
//   [int32LE opcode][int32LE payloadLength][utf8 JSON payload]

type Opcode = 0 | 1 | 2 | 3 | 4; // HANDSHAKE, FRAME, CLOSE, PING, PONG

export type RpcStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export type RpcStatusPayload = {
  status: RpcStatus;
  message: string;
};

export type DiscordActivity = {
  type?: number;
  details?: string;
  state?: string;
  timestamps?: { start?: number; end?: number };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  buttons?: Array<{ label: string; url: string }>;
  party?: { id?: string; size?: [number, number] };
  secrets?: { join?: string; spectate?: string; match?: string };
  instance?: boolean;
};

type StatusListener = (payload: RpcStatusPayload) => void;

function getIpcPath(id: number): string {
  if (process.platform === 'win32') {
    return `\\\\?\\pipe\\discord-ipc-${id}`;
  }
  const base =
    process.env.XDG_RUNTIME_DIR ||
    process.env.TMPDIR ||
    process.env.TMP ||
    process.env.TEMP ||
    os.tmpdir();
  return path.join(base, `discord-ipc-${id}`);
}

export class DiscordRpcClient {
  private socket: net.Socket | null = null;
  private clientId = '';
  private connected = false;
  private connecting = false;
  private readBuffer = Buffer.alloc(0);
  private currentActivity: DiscordActivity | null = null;
  private statusListener: StatusListener | null = null;

  onStatus(listener: StatusListener) {
    this.statusListener = listener;
  }

  isConnected() {
    return this.connected;
  }

  private emit(status: RpcStatus, message: string) {
    this.statusListener?.({ status, message });
  }

  /**
   * Connect + handshake with the Discord client for the given application id.
   * Resolves once Discord dispatches READY.
   */
  async connect(clientId: string): Promise<void> {
    this.clientId = clientId;

    // Reuse an existing connection if we're already live for this client.
    if (this.connected && this.socket) {
      return;
    }

    this.connecting = true;
    this.emit('connecting', 'Connecting to Discord…');

    const socket = await this.tryConnectSocket();
    if (!socket) {
      this.connecting = false;
      this.emit(
        'error',
        'Discord not detected. Open the Discord desktop app and sign in, then try again.'
      );
      throw new Error('Could not connect to Discord IPC pipe.');
    }

    this.socket = socket;
    this.wireSocket(socket);

    // Send the handshake and wait for READY.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out waiting for Discord handshake.'));
      }, 10000);

      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.readyResolvers = this.readyResolvers.filter((r) => r.resolve !== onReady);
      };

      this.readyResolvers.push({ resolve: onReady, reject: onError });

      this.send(0, { v: 1, client_id: clientId });
    });

    this.connected = true;
    this.connecting = false;
    this.emit('connected', 'Connected to Discord');
  }

  private readyResolvers: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

  private async tryConnectSocket(): Promise<net.Socket | null> {
    for (let id = 0; id < 10; id++) {
      const socket = await this.attemptSingle(getIpcPath(id));
      if (socket) return socket;
    }
    return null;
  }

  private attemptSingle(ipcPath: string): Promise<net.Socket | null> {
    return new Promise((resolve) => {
      const socket = net.createConnection(ipcPath);
      let settled = false;

      const onConnect = () => {
        if (settled) return;
        settled = true;
        socket.removeListener('error', onError);
        resolve(socket);
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(null);
      };

      socket.once('connect', onConnect);
      socket.once('error', onError);
    });
  }

  private wireSocket(socket: net.Socket) {
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.handleDisconnect('Connection to Discord closed.'));
    socket.on('error', () => this.handleDisconnect('Connection to Discord errored.'));
  }

  private handleDisconnect(message: string) {
    const wasConnected = this.connected || this.connecting;
    this.connected = false;
    this.connecting = false;
    this.socket = null;
    this.readBuffer = Buffer.alloc(0);

    // Reject any pending handshake waiters.
    const pending = this.readyResolvers;
    this.readyResolvers = [];
    pending.forEach((p) => p.reject(new Error(message)));

    if (wasConnected) {
      this.emit('disconnected', message);
    }
  }

  private onData(chunk: Buffer) {
    this.readBuffer = Buffer.concat([this.readBuffer, chunk]);

    // Parse as many complete frames as we have.
    while (this.readBuffer.length >= 8) {
      const opcode = this.readBuffer.readInt32LE(0);
      const length = this.readBuffer.readInt32LE(4);
      if (this.readBuffer.length < 8 + length) break;

      const payloadRaw = this.readBuffer.subarray(8, 8 + length).toString('utf8');
      this.readBuffer = this.readBuffer.subarray(8 + length);

      let payload: any = null;
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        payload = null;
      }
      this.handleFrame(opcode as Opcode, payload);
    }
  }

  private handleFrame(opcode: Opcode, payload: any) {
    if (opcode === 3) {
      // PING -> respond with PONG.
      this.send(4, payload);
      return;
    }

    if (opcode === 2) {
      // CLOSE frame from Discord.
      const msg = payload?.message ? `Discord closed the connection: ${payload.message}` : 'Discord closed the connection.';
      this.handleDisconnect(msg);
      return;
    }

    if (opcode === 1) {
      // FRAME dispatch.
      if (payload?.evt === 'READY') {
        const waiters = this.readyResolvers;
        this.readyResolvers = [];
        waiters.forEach((w) => w.resolve());
      } else if (payload?.evt === 'ERROR') {
        const message = payload?.data?.message || 'Discord returned an error.';
        // Surface handshake-time errors to any pending waiters.
        if (this.readyResolvers.length) {
          const waiters = this.readyResolvers;
          this.readyResolvers = [];
          waiters.forEach((w) => w.reject(new Error(message)));
        }
        this.emit('error', message);
      }
    }
  }

  private send(opcode: Opcode, payload: unknown) {
    if (!this.socket) return;
    const json = Buffer.from(JSON.stringify(payload), 'utf8');
    const header = Buffer.alloc(8);
    header.writeInt32LE(opcode, 0);
    header.writeInt32LE(json.length, 4);
    this.socket.write(Buffer.concat([header, json]));
  }

  async setActivity(activity: DiscordActivity): Promise<void> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to Discord.');
    }
    this.currentActivity = activity;
    this.send(1, {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity
      },
      nonce: this.makeNonce()
    });
  }

  async clearActivity(): Promise<void> {
    if (!this.connected || !this.socket) return;
    this.currentActivity = null;
    this.send(1, {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: null
      },
      nonce: this.makeNonce()
    });
  }

  disconnect() {
    const socket = this.socket;
    this.connected = false;
    this.connecting = false;
    this.currentActivity = null;
    this.socket = null;
    this.readBuffer = Buffer.alloc(0);
    if (socket) {
      try {
        socket.end();
        socket.destroy();
      } catch {
        // ignore
      }
    }
    this.emit('disconnected', 'Disconnected from Discord');
  }

  // A simple monotonic-ish nonce that does not rely on Math.random / Date.now
  // being unavailable in odd sandboxes; counter is fine for RPC nonces.
  private nonceCounter = 0;
  private makeNonce(): string {
    this.nonceCounter += 1;
    return `${process.pid}-${this.nonceCounter}`;
  }
}

export const discordRpcClient = new DiscordRpcClient();
