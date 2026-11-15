import {scenarios,create,apply,allowed,reconcile} from "./engine.mjs";
const $=id=>document.getElementById(id);
const roles=[
  ["cardholder","Cardholder","Myke","👤"],["merchant","Merchant","Harbor Café","☕"],
  ["acquirer","Acquirer","Merchant side","🏛"],["visa","Payment network","Visa",""],
  ["issuer","Issuer","Cardholder’s bank","🏦"]
];
const labels={ready:"Ready",unknown:"Outcome unknown",authorized:"Authorized",declined:"Declined",captured:"Captured",cleared:"Cleared",settled:"Settled",refund_pending:"Refund pending",refunded:"Refunded"};
const commands={resolve:"Resolve original payment",capture:"Capture",clear:"Clear",settle:"Settle",refund:"Issue refund",refund_settle:"Complete refund",webhook:"Redeliver settlement webhook"};
const usd=cents=>(cents/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
function el(tag,text,cls){
  const x=document.createElement(tag);
  if (text!==undefined) x.textContent=text;
  if (cls) x.className=cls;
  return x;
}
function action(text,fn,cls){
  const b=el("button",text,cls);b.type="button";b.onclick=fn;return b;
}
let state=create(575,"approve"), cursor=0;
$("scenario").replaceChildren(...Object.entries(scenarios).map(([key,[label]])=>new Option(label,key)));
function updateForm(){
  const amount=$("amount").valueAsNumber;
  $("receipt-value").textContent=Number.isFinite(amount)?usd(Math.round(amount*100)):"—";
  $("description").textContent=scenarios[$("scenario").value][1];
}
function applyCommand(command,key){
  state=apply(state,command,key);
  advance();
}
function advance(){
  cursor=Math.min(cursor+1,state.events.length);
  render();
}
function render(){
  const pending=cursor<state.events.length;
  const latest=state.events[cursor-1];
  $("status").textContent=pending?"Showing messages":labels[state.status];
  $("status").dataset.status=pending?"active":state.status;
  $("flow").replaceChildren(...roles.map(([id,label,subtitle,icon])=>{
    const card=el("article",undefined,"role "+(id==="visa"?"network":""));
    if (latest?.to===id) card.classList.add("receiving");
    if (latest?.from===id) card.classList.add("sending");
    if (id==="visa"){
      const img=el("img");img.src="assets/visa.svg";img.alt="Visa";card.append(img);
    }else card.append(el("span",icon,"icon"));
    card.append(el("strong",label),el("small",subtitle));
    return card;
  }));
  const message=latest?[el("strong",latest.title),el("p",latest.detail)]:[el("p","Start a simulation to see the authorization request move through the network.")];
  $("message").replaceChildren(...message);
  $("events").replaceChildren(...state.events.slice(0,cursor).map(item=>{
    const row=el("li");const name=id=>roles.find(x=>x[0]===id)[1];
    row.append(el("strong",item.title),el("small",name(item.from)+" → "+name(item.to)));
    return row;
  }));
  $("step").disabled=$("finish").disabled=!pending;
  $("commands").replaceChildren();
  if (!pending&&state.status!=="ready") {
    const buttons=allowed(state).filter(c=>commands[c]).map(command=>action(commands[command],()=>applyCommand(command),"secondary"));
    if (state.status==="authorized"||state.status==="unknown"||state.status==="declined") {
      buttons.push(action("Retry same key",()=>applyCommand("authorize","payment-1"),"secondary"));
    }
    if (state.scenario==="refund"&&state.status==="authorized") {
      buttons.push(action("Run to completed refund",()=>{
        for (const cmd of ["capture","clear","settle","refund","refund_settle"]) state=apply(state,cmd);
        advance();
      },"primary"));
    }
    $("commands").replaceChildren(...buttons);
  }
  const rows=pending?state.ledger.filter(row=>{
    const titles={Clearing:"Clearing record delivered",Settlement:"Merchant payout recorded",Refund:"Issuer receives credit","Refund settlement":"Refund completes"};
    return state.events.slice(0,cursor).some(e=>e.title===titles[row.phase]);
  }):state.ledger;
  $("ledger").replaceChildren(...rows.map(r=>{
    const row=el("tr");
    for (const value of [r.phase,r.debit,r.credit,usd(r.cents)]) row.append(el("td",value));
    return row;
  }));
  if (!rows.length){
    const row=el("tr");const td=el("td","No merchant journal entries.");td.colSpan=4;row.append(td);$("ledger").append(row);
  }
  const {net,matched}=reconcile(state);
  $("reconcile").textContent=pending ? "Reconciliation updates after the messages finish." :
    "Net merchant cash "+usd(net)+" · "+(matched?"Matches expected cash":"Mismatch");
}
$("controls").onsubmit=e=>{
  e.preventDefault();
  state=create(Math.round($("amount").valueAsNumber*100),$("scenario").value);
  cursor=0;
  applyCommand("authorize","payment-1");
};
$("reset").onclick=()=>{
  $("controls").reset();cursor=0;state=create(575,"approve");updateForm();render();
};
$("controls").oninput=updateForm;
$("step").onclick=advance;
$("finish").onclick=()=>{cursor=state.events.length;render();};
updateForm();render();
