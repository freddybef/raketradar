export type RealtimeEventType =
  | "signal:new"
  | "ranking:update"
  | "alert:new"
  | "setup:decay"
  | "stream:heartbeat";

export interface RealtimeEvent<TPayload = unknown> {
  id: string;
  type: RealtimeEventType;
  payload: TPayload;
  timestamp: string;
}

type Listener<TPayload> = (event: RealtimeEvent<TPayload>) => void;

export class EventBus {
  private listeners = new Map<RealtimeEventType, Set<Listener<unknown>>>();

  subscribe<TPayload>(
    type: RealtimeEventType,
    listener: Listener<TPayload>
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as Listener<unknown>);
    this.listeners.set(type, listeners);

    return () => {
      listeners.delete(listener as Listener<unknown>);
    };
  }

  publish<TPayload>(type: RealtimeEventType, payload: TPayload) {
    const event: RealtimeEvent<TPayload> = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as RealtimeEvent<unknown>);
    }

    return event;
  }
}

export const intelligenceEventBus = new EventBus();
