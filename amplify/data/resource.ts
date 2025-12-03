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

			// TEMPORARY FOR DEBUGGING: Allows unauthenticated (guest) read access using the API Key.
			// This is an alternative to 'a.allow.public()' for older versions of @aws-amplify/backend.
			// REMEMBER TO REMOVE THIS LINE AND RUN 'amplify sandbox'/'amplify deploy' AFTER DEBUGGING.
			allow.guest().to(["read"]), // Changed from .public() to .guest()
		]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
	schema,
	authorizationModes: {
		// TEMPORARY: Change the default auth mode to a Cognito-based one (e.g., userPool)
		// This prevents CloudFormation from trying to update the missing API Key resource.
		defaultAuthorizationMode: "userPool",
		// defaultAuthorizationMode: "apiKey", // <-- TEMPORARILY REMOVED FOR CLEANUP PUSH
		// apiKeyAuthorizationMode: { // <-- TEMPORARILY REMOVED FOR CLEANUP PUSH
		//   expiresInDays: 30, // <-- TEMPORARILY REMOVED FOR CLEANUP PUSH
		// }, // <-- TEMPORARILY REMOVED FOR CLEANUP PUSH
	},
});