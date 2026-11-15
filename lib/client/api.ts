export class ClientApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
export async function apiFetch<T=any>(url:string, init:RequestInit={}) :Promise<T> {
  const response=await fetch(url,{...init,credentials:"same-origin",headers:{"Content-Type":"application/json",...(init.headers||{})},cache:"no-store"});
  const contentType=response.headers.get("content-type")||"";
  if(!contentType.includes("application/json")){
    if(!response.ok)throw new ClientApiError("The request could not be completed.",response.status);
    return undefined as T;
  }
  const payload=await response.json();
  if(!response.ok)throw new ClientApiError(payload?.error?.message||"The request could not be completed.",response.status,payload?.error?.code);
  return payload as T;
}
export const jsonBody=(value:unknown)=>JSON.stringify(value);
export const currency=(amount:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(amount||0);
export const dateLabel=(value?:string)=>value?new Intl.DateTimeFormat("en-IN",{dateStyle:"medium"}).format(new Date(value)):"—";
