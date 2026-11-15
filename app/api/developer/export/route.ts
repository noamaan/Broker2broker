import ExcelJS from "exceljs";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError } from "@/lib/server/http";
export const runtime="nodejs";
type ExportData={exportedAt:string;summary:Record<string,number|string|unknown>;byPlan:{plan:string;approvedPayments:number;revenue:number}[];monthlyTrend:{month:string;revenue:number;payments:number}[]};
export async function GET(request:Request){try{const actor=await requireUser(["DEVELOPER"]);const data=await backendRequest<ExportData>("developer.exportData",{actorID:actor.userID});const format=new URL(request.url).searchParams.get("format")||"csv";
  if(format==="xlsx"){
    const workbook=new ExcelJS.Workbook();workbook.creator="Broker2Broker";workbook.created=new Date();
    const summary=workbook.addWorksheet("Financial summary");summary.addRows([["Metric","Value"],...["totalPaymentRequests","pendingVerification","approvedPayments","rejectedPayments","monthlyMembershipRevenue","yearlyMembershipRevenue","totalCollectedRevenue","activeSubscribers","expiredSubscribers","subscriptionRenewals","renewalRate"].map(k=>[k,data.summary[k]??""]) ]);summary.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};summary.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF102744"}};summary.columns=[{width:34},{width:24}];
    const plans=workbook.addWorksheet("By plan");plans.addRow(["Plan","Approved payments","Revenue (INR)"]);data.byPlan.forEach(r=>plans.addRow([r.plan,r.approvedPayments,r.revenue]));plans.getRow(1).font={bold:true};plans.columns=[{width:22},{width:24},{width:24}];
    const trend=workbook.addWorksheet("Monthly trend");trend.addRow(["Month","Approved payments","Revenue (INR)"]);data.monthlyTrend.forEach(r=>trend.addRow([r.month,r.payments,r.revenue]));trend.getRow(1).font={bold:true};trend.columns=[{width:20},{width:24},{width:24}];
    const buffer=await workbook.xlsx.writeBuffer();return new Response(Buffer.from(buffer),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":"attachment; filename=broker2broker-financial-summary.xlsx","Cache-Control":"no-store"}});
  }
  const rows:(string|number)[][]=[["Metric","Value"],...["totalPaymentRequests","pendingVerification","approvedPayments","rejectedPayments","monthlyMembershipRevenue","yearlyMembershipRevenue","totalCollectedRevenue","activeSubscribers","expiredSubscribers","subscriptionRenewals","renewalRate"].map(k=>[k,String(data.summary[k]??"")])];
  const escape=(v:string|number)=>`"${String(v).replace(/"/g,'""')}"`;const csv=rows.map(r=>r.map(escape).join(",")).join("\r\n")+"\r\n\r\nPlan,Approved payments,Revenue INR\r\n"+data.byPlan.map(r=>[r.plan,r.approvedPayments,r.revenue].map(escape).join(",")).join("\r\n")+"\r\n\r\nMonth,Approved payments,Revenue INR\r\n"+data.monthlyTrend.map(r=>[r.month,r.payments,r.revenue].map(escape).join(",")).join("\r\n");return new Response("\uFEFF"+csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=broker2broker-financial-summary.csv","Cache-Control":"no-store"}});
}catch(e){return apiError(e);}}
