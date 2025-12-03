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
			// Allows the owner of the record to perform all operations
			allow.ownerDefinedIn("owner").to(["read", "create", "update", "delete"]),

			// Allows any authenticated user to read devices
			allow.authenticated().to(["read"]),

			// RESTORED: This line requires an API Key to be present for guest/public reads.
			allow.guest().to(["read"]), 
		]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
	schema,
	authorizationModes: {
		defaultAuthorizationMode: "apiKey", 
		
		apiKeyAuthorizationMode: { 
			expiresInDays: 182, // Set to half of max (365) to prevent future expiration issues
		}, 
	},
});