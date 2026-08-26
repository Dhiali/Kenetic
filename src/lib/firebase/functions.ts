import {
    getFunctions,
    httpsCallable,
    HttpsCallableResult,
} from "firebase/functions";
import { firebaseApp } from "./app";

export const functions = getFunctions(firebaseApp);

export async function callFunction<TData, TResult>(
  name: string,
  data: TData,
): Promise<TResult> {
  const callable = httpsCallable<TData, TResult>(functions, name);
  const result: HttpsCallableResult<TResult> = await callable(data);
  return result.data;
}
