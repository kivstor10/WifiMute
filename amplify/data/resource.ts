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
      // Using ownerDefinedIn as your compiler indicated is correct for your version
      allow.ownerDefinedIn("owner").to(["read", "create", "update", "delete"]),

      // REMOVED: .subscriptions() call, as it's not supported in your current backend library version
      allow.authenticated().to(["read"]),

      // If you needed public read *and* subscription with an older version,
      // it might require a different, more global configuration or not be directly supported
      // for subscriptions on a per-model basis.
      // E.g., if you had 'allow.public().to(["read"])' then subscriptions might implicitly work if
      // your AppSync API is configured to allow public subscriptions for read, but that's
      // highly dependent on the exact Amplify CLI/backend version.
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
    // IMPORTANT: If you are using `allow.authenticated()`, you must have Amplify Auth configured
    // and a user logged in. If you've run `npx amplify add auth`, it will usually
    // automatically configure this. Otherwise, you might need to uncomment and
    // configure `userPools: true,` or similar here.
    // userPools: true,
  },
});