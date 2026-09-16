import type { brokerBridge } from './broker-native';
import type { IOSFeedbackBridge, NativeBridge } from './runtime';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;
type Bridge = NonNullable<ReturnType<typeof brokerBridge>>;

// SDLC-REPAIR-013-G: public declarations retain both platforms and no bridge.
export type BrokerBridgeReturn = Assert<
  Equal<
    ReturnType<typeof brokerBridge>,
    IOSFeedbackBridge | NativeBridge | undefined
  >
>;
export type KiteCallback = Assert<
  Equal<
    Awaited<ReturnType<NonNullable<Bridge['takeKiteCallback']>>>,
    { state: string; requestToken: string } | null
  >
>;
export type UpstoxCallback = Assert<
  Equal<
    Awaited<ReturnType<NonNullable<Bridge['takeUpstoxCallback']>>>,
    { state: string; code: string } | null
  >
>;
export type AngelCallback = Assert<
  Equal<
    Awaited<ReturnType<NonNullable<Bridge['takeAngelCallback']>>>,
    { state: string; authToken: string } | null
  >
>;
