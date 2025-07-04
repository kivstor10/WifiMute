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
      // CORRECTED: Use ownerDefinedIn as per your TypeScript error
      allow.ownerDefinedIn("owner").to(["read", "create", "update", "delete"]),
      // Allow all authenticated users to read AND SUBSCRIBE to all device changes
      allow.authenticated().to(["read"]).subscriptions(["onUpdate", "onCreate", "onDelete"]),
      // If you needed public read *and* subscription (for unauthenticated users), you'd add:
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
    // If you are using Cognito User Pools for authentication (which is typical for `allow.authenticated`),
    // you MUST ensure userPools is configured here.
    // Example (uncomment and configure if applicable, if you ran `npx amplify add auth` it might be auto-generated):
    // userPools: true, // or specificUserPoolId: 'your_user_pool_id'
  },
});