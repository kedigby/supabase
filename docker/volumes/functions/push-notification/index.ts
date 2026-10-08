import { withSupabase, type SupabaseContext } from 'npm:@supabase/server@^1'
import Onesignal from '@onesignal/node-onesignal';

const onesignalApiKey = Deno.env.get('ONESIGNAL_API_KEY')
const onesignalAppId = Deno.env.get('ONESIGNAL_API_APP_ID')
const dbUrl = Deno.env.get('SUPABASE_DB_URL')

const configuration = Onesignal.createConfiguration({ restApiKey: onesignalApiKey });
const apiInstance = new Onesignal.DefaultApi(configuration);
const aliasLabel: string = "supabase_id";

export default {
  fetch: withSupabase({ auth: 'user' }, async (req : Request, ctx : SupabaseContext) => {
    const { supabase, supabaseAdmin, userClaims, jwtClaims, authMode } = ctx

    console.log(`userClaims:`, userClaims)
    console.log(`onesignalApiKey:`, onesignalApiKey)
    console.log(`onesignalAppId:`, onesignalAppId)
    console.log(`dbUrl:`, dbUrl)

    if (!userClaims.id)
    {
      throw new Error(`userClaims:${userClaims.id} not found`)
    }

    let needToCreateUser = false;

    try {
      const response = await apiInstance.getUser(onesignalAppId, aliasLabel, userClaims?.id);
      console.log(response);
    } catch (e) {
      if (e instanceof Onesignal.ApiException && e.code === 404) {
        // No OneSignal user has this supabase_id alias yet
        console.log(`OneSignal user not found for ${aliasLabel}=${userClaims.id}`)
        needToCreateUser = true;
      } else if (e instanceof Onesignal.ApiException) {
        console.error(`getUser failed: HTTP ${e.code}`, e.errorMessages)
        return Response.json({ error: 'OneSignal request failed' }, { status: 502 })
      } else {
        throw e // network or SDK errors
      }
    }

    if (needToCreateUser)
    {
      const user: Onesignal.User = {
        properties: {
          email: userClaims.email
        },
        identity: {
          external_id: userClaims.id,
          [aliasLabel]: userClaims.id,
          email: userClaims.email
        },
        subscriptions: userClaims.email
          ? [{ type: 'Email', token: userClaims.email, enabled: true }]
          : [],
      };

      try {
        const response = await apiInstance.createUser(onesignalAppId, user);
        console.log(response);
      } catch (e) {
        if (e instanceof Onesignal.ApiException) {
          // `e.errorMessages` flattens any error-envelope shape to a `string[]`;
          // the raw parsed body remains on `e.body`.
          console.error("createUser failed: HTTP " + e.code, e.errorMessages);
        } else {
          throw e;
        }
      }

    }


    return Response.json({ message: `Hello World! ${userClaims?.email}`, some: "thing", onesignalApiKey})

    //try and get the user from onesignal:



  }),
}