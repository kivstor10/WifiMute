// amplify/backend/data/schema.ts
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Device: a
    .model({
      owner: a.string().required(),
      name: a.string(),
      staticIp: a.string(),
      wifiMac: a.string(),
      blockStatus: a.enum(["ON", "OFF"]),
      scheduleFrom: a.integer(),
      scheduleTo: a.integer(),
    })
    .authorization((allow) => [
      // Owner can do everything, including subscribing to their own updates
      allow.ownerDefinedIn("owner").to(["read", "create", "update", "delete"]),
      // Allow all authenticated users to read and SUBSCRIBE to all device changes
      // Include subscription operations directly if supported
      allow.authenticated().to(["read"]),
      // If your library supports subscriptions, you can add:
      // .subscriptions(["onUpdate", "onCreate", "onDelete"]),
      // If you needed public read *and* subscription, you'd add:
      // allow.public().to(["read"]).subscriptions(["onUpdate", "onCreate", "onDelete"]),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey", // API Key used for public rules (if any)
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
  // If you are using Cognito User Pools for authentication, ensure it's listed here
  // userPools: {
  //   // You'd typically connect your Cognito User Pool here
  // },
});