import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Device: a
    .model({
      // Add 'owner' field which is required for owner-based authorization
      owner: a.string().required(), // New line: Make owner explicit and required
      name: a.string(),
      staticIp: a.string(),
      wifiMac: a.string(),
      blockStatus: a.enum(["ON", "OFF"]),
      scheduleFrom: a.integer(), // minutes since midnight
      scheduleTo: a.integer(),   // minutes since midnight
    })
    // Add authorization rules using .authorization()
    .authorization((allow) => [
      // Allow the owner of the record to create, read, update, and delete it
      allow.ownerDefinedIn("owner").to(["read", "create", "update", "delete"]),
      // Allow all authenticated users to read all Device records
      allow.authenticated().to(["read"]),
      // If you want unauthenticated users to read (e.g., for a public display)
      // allow.public().to(["read"]), // Uncomment this if public read access is desired
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    // API Key is used for a.allow.public() rules (if you uncomment allow.public() above)
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});