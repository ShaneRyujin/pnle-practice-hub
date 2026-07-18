/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// This client intentionally uses only Supabase's browser-safe publishable key.
// Row Level Security in the progress table keeps each student's records private.
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null;
